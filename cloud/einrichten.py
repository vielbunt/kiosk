#!/usr/bin/env python3
"""
Richtet Python für die Cloud-Routinen ein und repariert, was das Cloud-Image kaputt mitbringt.

    python3 cloud/einrichten.py                      # Pakete aus requirements.txt
    python3 cloud/einrichten.py requests tzdata      # nur diese Pakete

Exit 0, wenn danach alle Module importierbar sind (letzte Zeile "Python bereit ..."), sonst Exit 1
mit der Fehlerzeile. Sind schon alle Module da, wird nichts installiert, dann dauert das nur
eine Sekunde.

Warum es das gibt: Am 06.10.2026 kam ein neues Cloud-Image, in dem `python3` Python 3.11 war, `pip`
aber zu Python 3.13 gehörte. Alles wurde ins falsche Python installiert und jede Routine brach mit
ModuleNotFoundError ab. Davor war schon das cryptography aus Debian kaputt (ohne cffi). Darum
installiert dieses Skript immer mit genau dem Python, mit dem es selbst gestartet wurde, prüft
danach jeden Import in einem frischen Prozess und versucht es notfalls ein zweites Mal mit
Neuinstallation aller Pakete. Nur Standardbibliothek, damit es auch in einem nackten Image läuft.

Die gleiche Datei liegt im postergenerator-Repo unter cloud/einrichten.py. Bei Änderungen bitte beide anpassen.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Paketname (klein) -> Modul, das importierbar sein muss. Sonst gilt der Paketname mit _ statt -.
MODULE = {
    "google-api-python-client": "googleapiclient.discovery",
    "google-auth": "google.oauth2.service_account",
    "google-auth-httplib2": "google_auth_httplib2",
    "pillow": "PIL.Image",
    "cryptography": "cryptography.hazmat.primitives.asymmetric.rsa",
    "cffi": "_cffi_backend",
    "playwright": "playwright.sync_api",
    "recurring-ical-events": "recurring_ical_events",
}
# Ohne eigene Versionen bricht google-auth am kaputten cryptography aus apt.
KRYPTO = ["cryptography>=43.0", "cffi>=1.16"]

# Bricht google-auth am kaputten cryptography, merkt man das erst beim Signieren. Darum wird
# einmal echt signiert, so wie es der Service-Account bei Google tut.
SIGNIERTEST = """
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from google.auth import crypt
schluessel = rsa.generate_private_key(public_exponent=65537, key_size=2048)
schluessel.sign(b"vielbunt", padding.PKCS1v15(), hashes.SHA256())
"""


def pakete_aus(datei, gesehen=None):
    gesehen = gesehen if gesehen is not None else set()
    if datei in gesehen or not datei.exists():
        return []
    gesehen.add(datei)
    pakete = []
    for zeile in datei.read_text().splitlines():
        zeile = zeile.split("#", 1)[0].strip()
        if not zeile:
            continue
        if zeile.startswith("-r "):
            pakete += pakete_aus((datei.parent / zeile[3:].strip()).resolve(), gesehen)
        else:
            pakete.append(zeile)
    return pakete


def modul(paket):
    name = re.split(r"[<>=!~\[; ]", paket, 1)[0].strip().lower()
    return MODULE.get(name, name.replace("-", "_"))


def pruefen(module, signieren):
    """Liefert None, wenn alles geht, sonst die erste Fehlerzeile."""
    code = "".join(f"import {m}\n" for m in module)
    if signieren:
        code += SIGNIERTEST
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    if r.returncode == 0:
        return None
    zeilen = [z for z in (r.stderr or r.stdout).strip().splitlines() if z.strip()]
    fehler = [z for z in zeilen if re.match(r"\w*(Error|Exception)\b", z)]
    return (fehler or zeilen or ["unbekannter Fehler"])[-1].strip()


def pip(*args):
    befehl = [sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", *args]
    r = subprocess.run(befehl, capture_output=True, text=True)
    if r.returncode != 0 and "externally-managed" in r.stderr:
        r = subprocess.run(befehl + ["--break-system-packages"], capture_output=True, text=True)
    if r.returncode != 0:
        letzte = (r.stderr.strip().splitlines() or ["?"])[-1]
        print(f"pip-Fehler: {letzte}")
    return r.returncode == 0


def pip_sicherstellen():
    if subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True).returncode == 0:
        return True
    print(f"{sys.executable} hat kein pip, versuche ensurepip")
    subprocess.run([sys.executable, "-m", "ensurepip", "--upgrade"], capture_output=True)
    return subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True).returncode == 0


def main():
    os.environ.setdefault("PIP_ROOT_USER_ACTION", "ignore")
    pakete = sys.argv[1:] or pakete_aus(ROOT / "requirements.txt")
    if not pakete:
        sys.exit("Keine Pakete angegeben und keine requirements.txt gefunden.")
    namen = {modul(p) for p in pakete}
    google = any(m.startswith("google.") for m in namen)
    if google:
        pakete = [p for p in pakete if modul(p) not in (modul(k) for k in KRYPTO)] + KRYPTO
    module = sorted({modul(p) for p in pakete})
    version = f"Python {sys.version.split()[0]} ({sys.executable})"

    fehler = pruefen(module, google)
    if fehler is None:
        print(f"Python bereit: {version}, nichts zu installieren")
        return

    print(f"Fehlt oder kaputt: {fehler}. Installiere für {version}")
    if not pip_sicherstellen():
        print(f"Einrichtung fehlgeschlagen: {sys.executable} hat kein pip und ensurepip ging nicht")
        sys.exit(1)

    # Runde 1: die eigenen Krypto-Pakete über die aus apt legen, dann der Rest
    if google:
        pip("--ignore-installed", *KRYPTO)
    pip(*pakete)
    fehler = pruefen(module, google)

    # Runde 2: alles frisch, ohne Cache, egal was schon da ist
    if fehler is not None:
        print(f"Immer noch: {fehler}. Installiere alles neu")
        pip("--ignore-installed", "--force-reinstall", "--no-cache-dir", *pakete)
        fehler = pruefen(module, google)

    if fehler is not None:
        print(f"Einrichtung fehlgeschlagen ({version}): {fehler}")
        sys.exit(1)
    print(f"Python bereit: {version}, repariert")


if __name__ == "__main__":
    main()
