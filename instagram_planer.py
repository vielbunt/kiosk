#!/usr/bin/env python3
"""
Postet die Beiträge aus dem Redaktionsplan zur geplanten Zeit auch auf Instagram.

Facebook-Posts plant vielbunt_publish.py (postergenerator-Repo) direkt bei Meta ein. Für Instagram
geht das über die API nicht, darum trägt der Scheduler Bilder und Text im Tab "Automatik" des
Redaktionsplans ein, und dieses Skript postet sie, wenn ihre Zeit gekommen ist. Läuft als
Cloud-Routine um 9, 15 und 19 Uhr (Darmstädter Zeit).

    python3 instagram_planer.py          # fällige Posts veröffentlichen
    python3 instagram_planer.py --dry    # nur anzeigen, was fällig ist

Sicherungen gegen doppelte Posts: Vor dem Veröffentlichen steht in "Instagram-ID" ein
"läuft seit ...". Bricht etwas mittendrin ab, wird die Zeile nicht nochmal angefasst, sondern
einmal gemeldet (danach steht "[gemeldet]" dahinter). Verpasste Posts (mehr als 3 Stunden über der
Zeit) werden einmal gemeldet und als "verpasst" vermerkt, nicht nachgeholt. Soll ein Post doch noch
raus, die Zelle "Instagram-ID" leeren und "Geplant für"/"Uhrzeit" auf einen neuen Termin setzen.

Zugangsdaten aus der Umgebung: META_ACCESS_TOKEN, FACEBOOK_PAGE_ID, INSTAGRAM_ACCOUNT_ID,
GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEETS_SPREADSHEET_ID. Lokal geht auch meta_config.py und
postergenerator/scheduler/ (service_account.json, config.py).
"""

import base64
import importlib.util
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BERLIN = ZoneInfo("Europe/Berlin")
GRAPH = "https://graph.facebook.com/v21.0"
TAB = "Automatik"
PLAN_TAB = "Formularantworten 1"
SPAETESTENS = timedelta(hours=3)
POSTERGENERATOR = Path(os.environ.get("VB_POSTERGENERATOR_DIR", Path.home() / "Documents/GitHub/postergenerator"))


# ── Einstellungen ──────────────────────────────────────────────────────────

def _lokal(pfad: Path):
    if not pfad.exists():
        return None
    spec = importlib.util.spec_from_file_location(pfad.stem + "_lokal", pfad)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


_META = _lokal(Path(__file__).parent / "meta_config.py")
_CONFIG = _lokal(POSTERGENERATOR / "scheduler" / "config.py")


def einstellung(name: str) -> str:
    wert = os.environ.get(name) or getattr(_META, name, None) or getattr(_CONFIG, name, None)
    if not wert:
        sys.exit(f"{name} fehlt (Umgebungsvariable oder lokale Konfiguration).")
    return wert


def sheets():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    roh = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if roh and not roh.startswith("{"):
        roh = base64.b64decode(roh).decode()
    info = json.loads(roh) if roh else json.loads((POSTERGENERATOR / "scheduler" / "service_account.json").read_text())
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"])
    return build("sheets", "v4", credentials=creds, cache_discovery=False).spreadsheets()


# ── Sheet ──────────────────────────────────────────────────────────────────

def _buchstabe(index: int) -> str:
    s, index = "", index + 1
    while index:
        index, rest = divmod(index - 1, 26)
        s = chr(65 + rest) + s
    return s


def lade_protokoll(sh, sid):
    werte = sh.values().get(spreadsheetId=sid, range=f"{TAB}!A:Z").execute().get("values", [])
    kopf = werte[0]
    for nr, zeile in enumerate(werte[1:], start=2):
        zeile = zeile + [""] * (len(kopf) - len(zeile))
        yield nr, dict(zip(kopf, zeile)), kopf


def schreibe(sh, sid, kopf, nr, spalte, wert):
    sh.values().update(spreadsheetId=sid, range=f"{TAB}!{_buchstabe(kopf.index(spalte))}{nr}",
                       valueInputOption="RAW", body={"values": [[wert]]}).execute()


def status_erledigt(sh, sid, canva_url: str) -> None:
    """Setzt im Redaktionsplan Status = Erledigt für die Zeile mit dieser Canva URL."""
    werte = sh.values().get(spreadsheetId=sid, range=f"'{PLAN_TAB}'!A:Z").execute().get("values", [])
    kopf = werte[0]
    s_url, s_status = kopf.index("Canva URL"), kopf.index("Status")
    for nr, zeile in enumerate(werte[1:], start=2):
        if len(zeile) > s_url and zeile[s_url].strip() == canva_url:
            if (zeile[s_status] if len(zeile) > s_status else "").strip() != "Erledigt":
                sh.values().update(spreadsheetId=sid, range=f"'{PLAN_TAB}'!{_buchstabe(s_status)}{nr}",
                                   valueInputOption="RAW", body={"values": [["Erledigt"]]}).execute()
                print(f"    ✓ Redaktionsplan Zeile {nr}: Status = Erledigt")
            return


# ── Instagram ──────────────────────────────────────────────────────────────

def _auth(token: str) -> dict:
    # Token im Header statt in der URL, sonst steht er in jeder Fehlermeldung
    return {"Authorization": f"Bearer {token}"}

def _sauber(text) -> str:
    """Entfernt Tokens aus Fehlermeldungen (requests hängt die URL samt Parametern an)."""
    return re.sub(r"((?:access|input)_token=)[^&\s'\"]+", r"\1***", str(text))


def seiten_token() -> str:
    r = requests.get(f"{GRAPH}/me/accounts", headers=_auth(einstellung("META_ACCESS_TOKEN")), timeout=30)
    r.raise_for_status()
    for seite in r.json().get("data", []):
        if seite.get("id") == einstellung("FACEBOOK_PAGE_ID"):
            return seite["access_token"]
    sys.exit("Facebook-Seite nicht in /me/accounts gefunden, Token prüfen.")


def _warten(container_id: str, token: str) -> None:
    for _ in range(36):  # bis zu 3 Minuten
        r = requests.get(f"{GRAPH}/{container_id}", params={"fields": "status_code"}, headers=_auth(token), timeout=30)
        r.raise_for_status()
        status = r.json().get("status_code")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise RuntimeError(f"Instagram konnte das Bild nicht verarbeiten: {r.text}")
        time.sleep(5)
    raise RuntimeError("Instagram hat das Bild nicht innerhalb von 3 Minuten verarbeitet.")


def _post(pfad: str, token: str, **daten) -> str:
    r = requests.post(f"{GRAPH}/{pfad}", data=daten, headers=_auth(token), timeout=60)
    if not r.ok:
        raise RuntimeError(f"Instagram-Fehler {r.status_code}: {r.text}")
    return r.json()["id"]


def _bild_container(konto, token, alt, **daten) -> str:
    """Legt einen Bild-Container an, mit Alt-Text. Lehnt Instagram das Feld ab, ohne."""
    try:
        return _post(f"{konto}/media", token, alt_text=alt, **daten)
    except RuntimeError as fehler:
        if "alt_text" not in str(fehler):
            raise
        return _post(f"{konto}/media", token, **daten)


def alt_texte(titel: str, anzahl: int) -> list[str]:
    # gleiche Texte wie in vielbunt_publish.py (postergenerator) für WordPress
    if anzahl == 1:
        return [f"Sharepic von vielbunt: {titel}"]
    return [f"Sharepic von vielbunt, Folie 1 von {anzahl}: {titel}"] + [
        f"Sharepic von vielbunt, Folie {i} von {anzahl}: Infos zu {titel} mit Datum, Uhrzeit, Ort und Beschreibung"
        for i in range(2, anzahl + 1)]


def veroeffentlichen(bilder: list[str], text: str, token: str, titel: str = "") -> str:
    konto = einstellung("INSTAGRAM_ACCOUNT_ID")
    alts = alt_texte(titel, len(bilder))
    if len(bilder) == 1:
        container = _bild_container(konto, token, alts[0], image_url=bilder[0], caption=text)
    else:
        kinder = []
        for url, alt in list(zip(bilder, alts))[:10]:  # Instagram erlaubt max. 10 Bilder pro Karussell
            kind = _bild_container(konto, token, alt, image_url=url, is_carousel_item="true")
            _warten(kind, token)
            kinder.append(kind)
        container = _post(f"{konto}/media", token, media_type="CAROUSEL", children=",".join(kinder), caption=text)
    _warten(container, token)
    return _post(f"{konto}/media_publish", token, creation_id=container)


# ── Ablauf ─────────────────────────────────────────────────────────────────

def lebenszeichen_pruefen(sh, sid, jetzt) -> None:
    """Warnt einmal am Tag, wenn die lokale Routine vielbunt-daily länger als 26 Stunden nicht lief."""
    try:
        werte = sh.values().get(spreadsheetId=sid, range="'Vorbereitung'!B6:C6").execute().get("values", [[]])[0]
    except Exception:
        return  # Tab fehlt: nix zu prüfen
    zuletzt = werte[0] if werte else ""
    gemeldet = werte[1] if len(werte) > 1 else ""
    try:
        seit = jetzt - datetime.strptime(zuletzt, "%Y-%m-%d %H:%M").replace(tzinfo=BERLIN)
    except ValueError:
        return
    if seit > timedelta(hours=26) and gemeldet != f"{jetzt:%Y-%m-%d}":
        print(f"⚠️  vielbunt-daily ist seit {zuletzt} nicht gelaufen (Mac aus oder Claude-App zu?). "
              "Bis zum nächsten Lauf werden keine Plakate gebaut und keine neuen Beiträge eingeplant.")
        sh.values().update(spreadsheetId=sid, range="'Vorbereitung'!C6", valueInputOption="RAW",
                           body={"values": [[f"{jetzt:%Y-%m-%d}"]]}).execute()


def main():
    trocken = "--dry" in sys.argv
    jetzt = datetime.now(BERLIN)
    sid = einstellung("GOOGLE_SHEETS_SPREADSHEET_ID")
    sh = sheets()
    token = None
    faellig = 0

    for nr, e, kopf in lade_protokoll(sh, sid):
        ig = e.get("Instagram-ID", "").strip()
        if e.get("Art") != "beitrag" or not e.get("Bilder"):
            continue  # ältere Einträge ohne Bilder hat Jan noch von Hand auf Instagram gebracht
        if ig.startswith(("läuft", "Fehler")):
            # nur einmal melden, sonst kommt 6x am Tag dieselbe Push-Nachricht
            if "[gemeldet]" not in ig and not trocken:
                print(f"⚠️  Zeile {nr} ({e['Titel']}): '{ig}'. Bitte auf Instagram prüfen "
                      "und die Zelle von Hand leeren, falls nochmal gepostet werden soll.")
                schreibe(sh, sid, kopf, nr, "Instagram-ID", f"{ig} [gemeldet]")
            continue
        if ig:
            continue
        try:
            geplant = datetime.strptime(f"{e['Geplant für']} {e.get('Uhrzeit') or '09:00'}", "%Y-%m-%d %H:%M").replace(tzinfo=BERLIN)
        except ValueError:
            print(f"⚠️  Zeile {nr} ({e['Titel']}): Zeit '{e['Geplant für']} {e.get('Uhrzeit')}' nicht lesbar.")
            continue
        if jetzt < geplant:
            continue
        if jetzt - geplant > SPAETESTENS:
            print(f"⚠️  Verpasst: {e['Titel']} war für {geplant:%d.%m. %H:%M} geplant. Nicht nachgeholt.")
            if not trocken:  # vermerken, damit es nur einmal gemeldet wird
                schreibe(sh, sid, kopf, nr, "Instagram-ID", f"verpasst (geplant {geplant:%d.%m. %H:%M})")
            continue

        faellig += 1
        bilder = e["Bilder"].split()
        print(f"📷 {e['Titel']} ({len(bilder)} Bild(er), geplant {geplant:%d.%m. %H:%M})")
        if trocken:
            print("    [DRY] würde jetzt posten")
            continue

        schreibe(sh, sid, kopf, nr, "Instagram-ID", f"läuft seit {jetzt:%Y-%m-%d %H:%M}")
        token = token or seiten_token()
        try:
            ig_id = veroeffentlichen(bilder, e.get("Text", ""), token, e.get("Titel", ""))
        except Exception as fehler:
            schreibe(sh, sid, kopf, nr, "Instagram-ID", f"Fehler {jetzt:%Y-%m-%d %H:%M}: {_sauber(fehler)[:200]}")
            print(f"    ✗ {_sauber(fehler)}")
            continue
        schreibe(sh, sid, kopf, nr, "Instagram-ID", ig_id)
        print(f"    ✓ Instagram-Post {ig_id}")
        try:
            status_erledigt(sh, sid, e["Schlüssel"])
        except Exception as fehler:
            print(f"    (Status nicht gesetzt: {_sauber(fehler)})")

    if not trocken:
        lebenszeichen_pruefen(sh, sid, jetzt)
    if not faellig:
        print(f"Nichts fällig ({jetzt:%d.%m. %H:%M %Z}).")


if __name__ == "__main__":
    main()
