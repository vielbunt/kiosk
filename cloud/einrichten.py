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
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Paketname (klein) -> Modul, das importierbar sein muss. Für alle anderen wird der Paketname mit _
# statt - probiert und, wenn es so kein Modul gibt, das echte Modul über die Paket-Metadaten gesucht
# (python-dateutil heißt z. B. dateutil). Hier muss also nur rein, was besonders gründlich geprüft
# werden soll.
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


NETZFEHLER = ("Retrying (Retry(", "ConnectTimeoutError", "ReadTimeoutError", "NewConnectionError",
              "ProxyError", "Temporary failure in name resolution", "Network is unreachable")

# Läuft im frischen Prozess: importiert ein Paket, notfalls über die Metadaten (anderer Modulname)
PAKETTEST = """
import importlib, importlib.metadata as md, re
def _norm(x):
    return re.sub(r"[-_.]+", "-", x).lower()
def paket(name, geraten, fest):
    try:
        importlib.import_module(geraten)
        return
    except ModuleNotFoundError as e:
        if fest or e.name not in (geraten, geraten.split(".")[0]):
            raise
    try:
        md.distribution(name)
    except md.PackageNotFoundError:
        raise ModuleNotFoundError(f"No module named {geraten!r} (Paket {name} nicht installiert)") from None
    module = [m for m, ds in md.packages_distributions().items()
              if _norm(name) in {_norm(d) for d in ds} and not m.startswith("_")]
    if not module:
        raise ModuleNotFoundError(f"No module named {geraten!r} (Paket {name} ohne importierbares Modul)")
    for m in module:
        importlib.import_module(m)
"""


def name_von(paket):
    return re.split(r"[<>=!~\[; ]", paket, 1)[0].strip().lower()


def modul(paket):
    name = name_von(paket)
    return MODULE.get(name, name.replace("-", "_"))


def pruefen(pakete, signieren):
    """Liefert None, wenn alles geht, sonst die erste Fehlerzeile."""
    code = PAKETTEST + "".join(
        f"paket({name_von(p)!r}, {modul(p)!r}, {name_von(p) in MODULE})\n" for p in pakete)
    if signieren:
        code += SIGNIERTEST
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    if r.returncode == 0:
        return None
    zeilen = [z for z in (r.stderr or r.stdout).strip().splitlines() if z.strip()]
    fehler = [z for z in zeilen if re.match(r"\w*(Error|Exception)\b", z)]
    return (fehler or zeilen or ["unbekannter Fehler"])[-1].strip()


class PaketquelleWeg(Exception):
    pass


def pip(*args):
    befehl = [sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", *args]
    for versuch in (1, 2):
        r = subprocess.run(befehl, capture_output=True, text=True)
        if r.returncode != 0 and "externally-managed" in r.stderr:
            befehl.append("--break-system-packages")
            r = subprocess.run(befehl, capture_output=True, text=True)
        if r.returncode == 0:
            return True
        letzte = (r.stderr.strip().splitlines() or ["?"])[-1]
        if not any(m in r.stderr for m in NETZFEHLER):
            print(f"pip-Fehler: {letzte}")
            return False
        if versuch == 2:
            raise PaketquelleWeg(letzte)
        print("Paketquelle antwortet nicht, neuer Versuch in 20 s")
        time.sleep(20)


def pip_sicherstellen():
    if subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True).returncode == 0:
        return True
    print(f"{sys.executable} hat kein pip, versuche ensurepip")
    subprocess.run([sys.executable, "-m", "ensurepip", "--upgrade"], capture_output=True)
    return subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True).returncode == 0


def versionen(pakete):
    code = ("import importlib.metadata as md\nfor n in %r:\n"
            "    try: print(n, md.version(n))\n    except Exception: print(n, '?')\n") % sorted({name_von(p) for p in pakete})
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    return ", ".join(r.stdout.split("\n")[:-1]) or "?"


def main():
    os.environ.setdefault("PIP_ROOT_USER_ACTION", "ignore")
    os.environ.setdefault("PIP_RETRIES", "2")
    try:
        einrichten()
    except PaketquelleWeg as fehler:
        print(f"Einrichtung fehlgeschlagen: Paketquelle nicht erreichbar ({fehler})")
        sys.exit(1)


def einrichten():
    pakete = sys.argv[1:] or pakete_aus(ROOT / "requirements.txt")
    if not pakete:
        sys.exit("Keine Pakete angegeben und keine requirements.txt gefunden.")
    namen = {modul(p) for p in pakete}
    google = any(m.startswith("google.") for m in namen)
    if google:
        pakete = [p for p in pakete if modul(p) not in (modul(k) for k in KRYPTO)] + KRYPTO
    pakete = list(dict.fromkeys(pakete))  # doppelte raus, Reihenfolge bleibt
    version = f"Python {sys.version.split()[0]} ({sys.executable})"

    fehler = pruefen(pakete, google)
    if fehler is None:
        print(f"Versionen: {versionen(pakete)}")
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
    fehler = pruefen(pakete, google)

    # Runde 2: alles frisch, ohne Cache, egal was schon da ist
    if fehler is not None:
        print(f"Immer noch: {fehler}. Installiere alles neu")
        pip("--ignore-installed", "--force-reinstall", "--no-cache-dir", *pakete)
        fehler = pruefen(pakete, google)

    if fehler is not None:
        print(f"Einrichtung fehlgeschlagen ({version}): {fehler}")
        sys.exit(1)
    print(f"Versionen: {versionen(pakete)}")
    print(f"Python bereit: {version}, repariert")


if __name__ == "__main__":
    main()
