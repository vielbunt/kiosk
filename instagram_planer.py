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
GRAPH = "https://graph.facebook.com/v25.0"  # gilt laut Meta bis etwa Juli 2028
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
    from googleapiclient.http import HttpRequest

    class Wiederholend(HttpRequest):  # wie postergenerator/google_dienste.py: 429/5xx bis zu 4 Mal
        def execute(self, http=None, num_retries=0):
            if num_retries == 0 and self.methodId != "sheets.spreadsheets.values.append":
                num_retries = 4  # append nie, sonst droht eine doppelte Zeile
            return super().execute(http=http, num_retries=num_retries)

    return build("sheets", "v4", credentials=creds, cache_discovery=False, requestBuilder=Wiederholend).spreadsheets()


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


class MetaVoruebergehend(RuntimeError):
    """Meta gerade nicht erreichbar (Netz, Timeout, 5xx). Der nächste Start versucht es wieder."""


def seiten_token() -> str:
    # nur lesend, darf also einmal wiederholt werden
    for versuch in (1, 2):
        try:
            r = requests.get(f"{GRAPH}/me/accounts", headers=_auth(einstellung("META_ACCESS_TOKEN")), timeout=30)
        except (requests.ConnectionError, requests.Timeout) as fehler:
            if versuch == 2:
                raise MetaVoruebergehend(_sauber(fehler)) from None
            time.sleep(20)
            continue
        if r.status_code >= 500:
            if versuch == 2:
                raise MetaVoruebergehend(f"Meta antwortet {r.status_code}")
            time.sleep(20)
            continue
        if not r.ok:
            raise RuntimeError(f"Meta lehnt den Token ab ({r.status_code}): {_sauber(r.text)[:200]}")
        for seite in r.json().get("data", []):
            if seite.get("id") == einstellung("FACEBOOK_PAGE_ID"):
                return seite["access_token"]
        raise RuntimeError("Facebook-Seite nicht in /me/accounts gefunden")


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


def veroeffentlichen(bilder: list[str], text: str, token: str, konto: str, titel: str = "") -> str:
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

# Lebenszeichen im Tab Vorbereitung (Zeile 6 daily, 7 AKÖ, 8 Instagram, 9 weekly), gleich wie in
# postergenerator/redaktionsplan.py. Spalte C merkt sich, an welchem Tag schon gewarnt wurde.
LEBENSZEICHEN = {
    6: ("vielbunt daily", timedelta(hours=26),
        "Bis zum nächsten Lauf werden keine Plakate gebaut und keine neuen Beiträge eingeplant."),
    7: ("AKÖ Vorbereitung", timedelta(hours=14), "Neue Einsendungen werden so lange nicht vorbereitet."),
}
INSTAGRAM_ZEILE = 8


def lebenszeichen_schreiben(sh, sid, jetzt) -> None:
    try:
        sh.values().update(spreadsheetId=sid, range=f"'Vorbereitung'!A{INSTAGRAM_ZEILE}:B{INSTAGRAM_ZEILE}",
                           valueInputOption="RAW",
                           body={"values": [["vielbunt Instagram zuletzt gelaufen", f"{jetzt:%Y-%m-%d %H:%M}"]]}).execute()
    except Exception as fehler:
        print(f"(Lebenszeichen nicht geschrieben: {_sauber(fehler)})")


def lebenszeichen_pruefen(sh, sid, jetzt) -> None:
    """Warnt einmal am Tag je Routine, wenn eine andere Cloud-Routine zu lange nicht lief."""
    try:
        werte = sh.values().get(spreadsheetId=sid, range="'Vorbereitung'!A6:C9").execute().get("values", [])
    except Exception:
        return  # Tab fehlt oder Sheet hakt: nicht 9x am Tag deswegen pushen
    for zeile, (name, grenze, folge) in LEBENSZEICHEN.items():
        z = (werte[zeile - 6] if len(werte) > zeile - 6 else []) + ["", "", ""]
        zuletzt, gemeldet = z[1], z[2]
        try:
            seit = jetzt - datetime.strptime(zuletzt, "%Y-%m-%d %H:%M").replace(tzinfo=BERLIN)
        except ValueError:
            continue  # noch nie eingetragen
        if seit > grenze and gemeldet != f"{jetzt:%Y-%m-%d}":
            print(f"⚠️  {name} ist seit {zuletzt} nicht gelaufen (Cloud-Routine nicht gestartet oder "
                  f"abgebrochen? Run-Log unter claude.ai/code/routines prüfen). {folge}")
            sh.values().update(spreadsheetId=sid, range=f"'Vorbereitung'!C{zeile}", valueInputOption="RAW",
                               body={"values": [[f"{jetzt:%Y-%m-%d}"]]}).execute()


def angehalten(sh, sid, jetzt) -> bool:
    """Notaus im Tab Vorbereitung (B10). Erinnert höchstens einmal am Tag (Datum in C10)."""
    try:
        werte = sh.values().get(spreadsheetId=sid, range="'Vorbereitung'!B10:C10",
                                valueRenderOption="UNFORMATTED_VALUE").execute().get("values", [[]])
    except Exception:
        return False
    z = (werte[0] if werte else []) + [False, ""]
    if z[0] is not True:
        return False
    if z[1] != f"{jetzt:%Y-%m-%d}":
        print("⚠️  Automatik im Sheet angehalten (Tab Vorbereitung, Zeile 10), Instagram postet nichts. "
              "Zum Weitermachen das Häkchen entfernen.")
        sh.values().update(spreadsheetId=sid, range="'Vorbereitung'!C10", valueInputOption="RAW",
                           body={"values": [[f"{jetzt:%Y-%m-%d}"]]}).execute()
    else:
        print("Automatik angehalten, nichts gepostet.")
    return True


def wochenschluessel(jetzt) -> str:
    """Die Wochenübersicht vom Sonntag zeigt die folgende Woche, der Schlüssel ist deren ISO-Woche."""
    jahr, woche, _ = (jetzt + timedelta(days=1)).isocalendar()
    return f"{jahr}-W{woche:02d}"


def wochenpost_pruefen(sh, sid, jetzt, zeilen) -> None:
    """Sonntags ab 14 Uhr: einmal melden, wenn vielbunt weekly social heute nichts gepostet hat."""
    if jetzt.weekday() != 6 or jetzt.hour < 14:
        return
    schluessel = wochenschluessel(jetzt)
    if any(e.get("Art") == "wochenpost" and e.get("Schlüssel") == schluessel for _, e, _ in zeilen):
        return
    print(f"⚠️  Wochenübersicht {schluessel} ist heute nicht gepostet worden. Nachholen: im Tab Automatik "
          f"die Zeile wochenpost {schluessel} löschen, dann lokal python3 weekly_social.py starten.")
    kopf = sh.values().get(spreadsheetId=sid, range=f"{TAB}!A1:Z1").execute().get("values", [[]])[0]
    if kopf:
        werte = {"Art": "wochenpost", "Schlüssel": schluessel, "Titel": f"Wochenübersicht {schluessel}",
                 "Verarbeitet am": f"{jetzt:%Y-%m-%d %H:%M}", "Facebook-ID": "verpasst [gemeldet]",
                 "Instagram-ID": "verpasst [gemeldet]"}
        sh.values().append(spreadsheetId=sid, range=f"{TAB}!A:{_buchstabe(len(kopf) - 1)}",
                           valueInputOption="RAW", insertDataOption="INSERT_ROWS",
                           body={"values": [[werte.get(k, "") for k in kopf]]}).execute()


def main():
    trocken = "--dry" in sys.argv
    jetzt = datetime.now(BERLIN)
    sid = einstellung("GOOGLE_SHEETS_SPREADSHEET_ID")
    sh = sheets()
    token = konto = None
    faellig = 0

    if not trocken and angehalten(sh, sid, jetzt):
        lebenszeichen_schreiben(sh, sid, jetzt)
        return
    zeilen = list(lade_protokoll(sh, sid))
    for nr, e, kopf in zeilen:
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

        # Zugang holen, bevor die Zeile gesperrt wird: scheitert das, bleibt sie frei und der
        # nächste Start im Zeitfenster versucht es nochmal (bis 3 h nach der geplanten Zeit)
        if token is None:
            try:
                token, konto = seiten_token(), einstellung("INSTAGRAM_ACCOUNT_ID")
            except MetaVoruebergehend as fehler:
                print(f"    ✗ Meta gerade nicht erreichbar ({fehler}), nichts gepostet. Der nächste Start versucht es wieder.")
                break
            except (Exception, SystemExit) as fehler:
                print(f"    ✗ Meta-Zugang nicht nutzbar ({_sauber(fehler)}), nichts gepostet. "
                      "META_ACCESS_TOKEN und Seitenzuordnung prüfen, der nächste Start versucht es wieder.")
                break

        schreibe(sh, sid, kopf, nr, "Instagram-ID", f"läuft seit {jetzt:%Y-%m-%d %H:%M}")
        try:
            ig_id = veroeffentlichen(bilder, e.get("Text", ""), token, konto, e.get("Titel", ""))
        except Exception as fehler:
            # gleich als gemeldet markieren, sonst meldet der nächste Start dieselbe Zeile nochmal
            schreibe(sh, sid, kopf, nr, "Instagram-ID", f"Fehler {jetzt:%Y-%m-%d %H:%M}: {_sauber(fehler)[:200]} [gemeldet]")
            print(f"    ✗ {_sauber(fehler)}. Bitte auf Instagram nachsehen; zum Wiederholen die Zelle "
                  "Instagram-ID leeren und Geplant für/Uhrzeit neu setzen.")
            continue
        schreibe(sh, sid, kopf, nr, "Instagram-ID", ig_id)
        print(f"    ✓ Instagram-Post {ig_id}")
        try:
            status_erledigt(sh, sid, e["Schlüssel"])
        except Exception as fehler:
            print(f"    (Status nicht gesetzt: {_sauber(fehler)})")

    if not trocken:
        lebenszeichen_pruefen(sh, sid, jetzt)
        wochenpost_pruefen(sh, sid, jetzt, zeilen)
        lebenszeichen_schreiben(sh, sid, jetzt)
    if not faellig:
        print(f"Nichts fällig ({jetzt:%d.%m. %H:%M %Z}).")


if __name__ == "__main__":
    main()
