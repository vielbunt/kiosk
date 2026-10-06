#!/usr/bin/env python3
"""
vielbunt weekly social media routine.
Intended to run every Sunday ~9am.

Steps:
  1. Generate socialmedia.png (1080×1350) and poster.png (5400×6750)
  2. Turn poster.png into a print PDF (2× A3 landscape = A2, see poster_druck.py)
     and upload it to Google Drive → AK Öffentlichkeitsarbeit/Social Media/Poster
  3. Post socialmedia.png to the vielbunt Facebook page
  4. Post socialmedia.png to the vielbunt Instagram account

  python3 weekly_social.py --nur-poster   → only steps 1 and 2, nothing gets posted
  python3 weekly_social.py --probe        → Probelauf: Bilder und PDF bauen, Drive- und Meta-Zugang
                                            prüfen, aber nix hochladen und nix posten
"""

import os
import re
import sys
import time
import subprocess
from pathlib import Path

import requests
from datetime import datetime

# ── Paths ──────────────────────────────────────────────────────────────────
KIOSK_DIR       = Path(__file__).parent
SOCIALMEDIA_PNG = KIOSK_DIR / "socialmedia.png"
POSTER_PNG      = KIOSK_DIR / "poster.png"

# ── Google Drive ───────────────────────────────────────────────────────────
# Folder ID for "AK Öffentlichkeitsarbeit/Social Media/Poster".
# Open the folder in Google Drive; the ID is the last segment of the URL:
#   https://drive.google.com/drive/folders/<FOLDER_ID>
POSTER_DRIVE_FOLDER_ID = "12EuQWm3kp9CHectJWfnMzqm-0z1v5DTg"

# Lokal liegt der Service-Account im postergenerator-Repo (gitignored), in der Cloud kommt er aus
# GOOGLE_SERVICE_ACCOUNT_JSON. VB_POSTERGENERATOR_DIR biegt den Ordner um.
AKO_DIR          = Path(os.environ.get("VB_POSTERGENERATOR_DIR",
                                       Path.home() / "Documents/GitHub/postergenerator"))
SA_FILE          = AKO_DIR / "scheduler" / "service_account.json"

# ── Meta credentials ───────────────────────────────────────────────────────
# In der Cloud kommen die aus Umgebungsvariablen, lokal aus meta_config.py.
try:
    import meta_config as _meta
except ImportError:
    _meta = None

def _einstellung(name):
    return os.environ.get(name) or getattr(_meta, name, None)

META_ACCESS_TOKEN    = _einstellung("META_ACCESS_TOKEN")
FACEBOOK_PAGE_ID     = _einstellung("FACEBOOK_PAGE_ID")
INSTAGRAM_ACCOUNT_ID = _einstellung("INSTAGRAM_ACCOUNT_ID")
if not all([META_ACCESS_TOKEN, FACEBOOK_PAGE_ID, INSTAGRAM_ACCOUNT_ID]) and "--probe" not in sys.argv:
    sys.exit(
        "Meta-Zugangsdaten fehlen. Entweder META_ACCESS_TOKEN, FACEBOOK_PAGE_ID und INSTAGRAM_ACCOUNT_ID\n"
        "als Umgebungsvariablen setzen oder meta_config_template.py → meta_config.py kopieren."
    )

# Meta Graph API: v25.0 gilt laut Meta bis etwa Juli 2028 (v26.0 kam am 29.07.2026)
GRAPH = "https://graph.facebook.com/v25.0"

# ── Caption ────────────────────────────────────────────────────────────────
CAPTION = (
    "Was steht demnächst bei vielbunt an? In der Übersicht findet ihr alle Termine "
    "auf einen Blick, von offenen Veranstaltungen bis zu den Sitzungen unserer "
    "Arbeitsgruppen. Schaut vorbei, kommt mit uns ins Gespräch oder bringt euch ein. "
    "Wir freuen uns auf euch!"
)


# ── Helpers ────────────────────────────────────────────────────────────────

def _page_access_token():
    """Exchange the system-user token for a page access token."""
    resp = requests.get(
        f"{GRAPH}/me/accounts",
        headers={"Authorization": f"Bearer {META_ACCESS_TOKEN}"},  # nicht in die URL, sonst landet er in Fehlermeldungen
        timeout=(10, 30),
    )
    resp.raise_for_status()
    pages = resp.json().get("data", [])
    for page in pages:
        if page.get("id") == FACEBOOK_PAGE_ID:
            return page["access_token"]
    sys.exit(f"Page {FACEBOOK_PAGE_ID} not found in /me/accounts. Check META_ACCESS_TOKEN and page assignment.")


def _drive_service():
    """Drive-Zugang über den Service-Account (GOOGLE_SERVICE_ACCOUNT_JSON oder, lokal,
    postergenerator/scheduler/service_account.json)."""
    try:
        import json
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit("Google-Bibliotheken fehlen: pip install -r requirements.txt")

    roh = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if roh and not roh.startswith("{"):  # base64-kodiert
        import base64
        roh = base64.b64decode(roh).decode()
    if not roh and not SA_FILE.exists():
        sys.exit(f"Kein Service-Account: GOOGLE_SERVICE_ACCOUNT_JSON setzen oder {SA_FILE} anlegen.")
    info = json.loads(roh) if roh else json.loads(SA_FILE.read_text())
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds, cache_discovery=False)


# ── Steps ──────────────────────────────────────────────────────────────────

def step_screenshots():
    print("📸  Generating screenshots…")
    subprocess.run([sys.executable, str(KIOSK_DIR / "screenshot_socialmedia.py")], check=True)
    subprocess.run([sys.executable, str(KIOSK_DIR / "screenshot_poster.py")], check=True)
    print("    ✓ socialmedia.png and poster.png ready\n")


def step_upload_poster():
    print("🖨   Building print PDF from poster.png…")
    from poster_druck import erstelle_druck_pdf
    pdf = erstelle_druck_pdf()
    print(f"    ✓ {pdf.name}\n")

    print("📁  Uploading poster PDF to Google Drive…")
    from googleapiclient.http import MediaFileUpload

    svc = _drive_service()
    media = MediaFileUpload(str(pdf), mimetype="application/pdf", resumable=True)
    result = svc.files().create(
        body={"name": pdf.name, "parents": [POSTER_DRIVE_FOLDER_ID]},
        media_body=media,
        fields="id,name",
        supportsAllDrives=True,
    ).execute()
    print(f"    ✓ Uploaded (Drive id={result['id']})\n")
    return result["id"]


def step_post_facebook():
    print("📘  Posting to Facebook…")
    page_token = _page_access_token()
    url = f"{GRAPH}/{FACEBOOK_PAGE_ID}/photos"
    with open(SOCIALMEDIA_PNG, "rb") as fh:
        resp = requests.post(
            url,
            data={"caption": CAPTION, "access_token": page_token, "published": "true"},
            files={"source": ("socialmedia.png", fh, "image/png")},
            timeout=(10, 180),
        )
    if not resp.ok:
        print(f"    ✗ Facebook error {resp.status_code}: {_sauber(resp.text)}")
    resp.raise_for_status()
    fb_id = resp.json().get("id")
    print(f"    ✓ Facebook post created (id={fb_id})\n")
    return fb_id


def step_post_instagram():
    print("📷  Posting to Instagram…")
    from googleapiclient.http import MediaFileUpload

    # Instagram API requires a publicly accessible image URL.
    # Strategy: upload socialmedia.png to Drive with public read permission,
    # use the direct-download link, then delete the temp file afterwards.
    svc = _drive_service()

    # Upload temp copy
    media = MediaFileUpload(str(SOCIALMEDIA_PNG), mimetype="image/png")
    # Liegt im Poster-Ordner, weil der Service-Account keine eigene "Meine Ablage" hat
    tmp = svc.files().create(
        body={"name": "_vielbunt_ig_tmp.png", "parents": [POSTER_DRIVE_FOLDER_ID]},
        media_body=media,
        fields="id",
        supportsAllDrives=True,
    ).execute()
    tmp_id = tmp["id"]

    image_url = f"https://drive.google.com/uc?export=view&id={tmp_id}"
    link = None

    try:
        # Öffentlich machen. Steht im try, damit die Temp-Datei auch bei einem Fehler hier aufgeräumt wird.
        link = svc.permissions().create(
            fileId=tmp_id,
            body={"type": "anyone", "role": "reader"},
            fields="id",
            supportsAllDrives=True,
        ).execute()
        page_token = _page_access_token()
        # Create media container
        container = requests.post(
            f"{GRAPH}/{INSTAGRAM_ACCOUNT_ID}/media",
            data={"image_url": image_url, "caption": CAPTION, "access_token": page_token},
            timeout=(10, 180),
        )
        if not container.ok:
            print(f"    ✗ Instagram container error {container.status_code}: {container.text}")
        container.raise_for_status()
        creation_id = container.json()["id"]

        # Wait for Instagram to finish processing the image before publishing
        for attempt in range(24):  # up to ~2 minutes
            status_r = requests.get(
                f"{GRAPH}/{creation_id}",
                params={"fields": "status_code"},
                headers={"Authorization": f"Bearer {page_token}"},
                timeout=(10, 30),
            )
            status_r.raise_for_status()
            status_code = status_r.json().get("status_code")
            if status_code == "FINISHED":
                break
            if status_code == "ERROR":
                sys.exit(f"    ✗ Instagram container processing failed: {status_r.text}")
            time.sleep(5)
        else:
            sys.exit("    ✗ Instagram container did not finish processing within 2 minutes.")

        # Publish
        publish = requests.post(
            f"{GRAPH}/{INSTAGRAM_ACCOUNT_ID}/media_publish",
            data={"creation_id": creation_id, "access_token": page_token},
            timeout=(10, 180),
        )
        if not publish.ok:
            print(f"    ✗ Instagram publish error {publish.status_code}: {publish.text}")
        publish.raise_for_status()
        ig_id = publish.json().get("id")
        print(f"    ✓ Instagram post created (id={ig_id})\n")
        return ig_id

    finally:
        # Temp-Datei immer aufräumen. In geteilten Ablagen darf nicht jede Rolle endgültig
        # löschen, darum erst den öffentlichen Link weg, dann löschen oder in den Papierkorb.
        try:
            if link:
                svc.permissions().delete(fileId=tmp_id, permissionId=link["id"], supportsAllDrives=True).execute()
        except Exception as e:
            print(f"    ⚠️  Öffentlicher Link der Temp-Datei {tmp_id} ließ sich nicht entfernen: {e}")
        try:
            svc.files().delete(fileId=tmp_id, supportsAllDrives=True).execute()
        except Exception:
            try:
                svc.files().update(fileId=tmp_id, body={"trashed": True}, supportsAllDrives=True).execute()
            except Exception as e:
                print(f"    ⚠️  Temp-Datei {tmp_id} bitte von Hand löschen: {e}")


# ── Main ───────────────────────────────────────────────────────────────────

def _schriften_pruefen():
    """Rendert kiosk.html kurz und schaut, ob Cera Pro wirklich geladen wurde."""
    import asyncio
    import functools
    import http.server
    import threading
    from playwright.async_api import async_playwright

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(KIOSK_DIR))
    handler.log_message = lambda *a: None
    server = http.server.HTTPServer(("127.0.0.1", 0), handler)  # freier Port, 7655 hängt evtl. noch
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    async def pruefen():
        try:
            async with async_playwright() as p:
                from browser_start import browser_und_seite
                browser, page = await browser_und_seite(p)
                await page.goto(f"http://127.0.0.1:{port}/kiosk.html?mode=socialmedia&poster=true")
                await page.wait_for_selector(".sm-event", timeout=90000)  # über den Cloud-Proxy dauerts manchmal länger
                await page.evaluate("document.fonts.ready")
                geladen = await page.evaluate(
                    "[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)")
                await browser.close()
                return geladen
        finally:
            server.shutdown()
            server.server_close()

    geladen = asyncio.run(pruefen())
    zeichen = "✓" if any("Cera" in f for f in geladen) else "✗"
    print(f"    {zeichen} Schriften geladen: {geladen or 'keine (Systemschrift oder Fallback)'}")


def probe():
    """Prüft alles, was in der Cloud schiefgehen kann, ohne etwas zu veröffentlichen."""
    print("🧪  Probelauf, es wird nichts hochgeladen oder gepostet\n")
    step_screenshots()
    from poster_druck import erstelle_druck_pdf
    pdf = erstelle_druck_pdf()
    print(f"    ✓ PDF gebaut: {pdf.name}")
    _schriften_pruefen()
    ok = True
    try:
        svc = _drive_service()
        meta = svc.files().get(fileId=POSTER_DRIVE_FOLDER_ID, fields="name,capabilities(canAddChildren)",
                               supportsAllDrives=True).execute()
        print(f"    ✓ Drive: Ordner \"{meta['name']}\", darf hochladen: {meta['capabilities']['canAddChildren']}")
    except BaseException as fehler:  # auch Abstürze beim Import, z. B. kaputtes cryptography
        # Mit dem alten OAuth-Token (drive.file) sieht man den Ordner grundsätzlich nicht
        print(f"    ✗ Drive: {fehler}")
        ok = False
    if not all([META_ACCESS_TOKEN, FACEBOOK_PAGE_ID, INSTAGRAM_ACCOUNT_ID]):
        print("    ✗ Meta: META_ACCESS_TOKEN, FACEBOOK_PAGE_ID oder INSTAGRAM_ACCOUNT_ID fehlt")
        ok = False
    else:
        try:
            _page_access_token()
            print("    ✓ Meta: Seiten-Token geholt")
        except BaseException as fehler:  # auch Abstürze beim Import, z. B. kaputtes cryptography
            print(f"    ✗ Meta: {fehler}")
            ok = False
    if not ok:
        sys.exit("❌  Probelauf mit Fehlern")
    print("✅  Probelauf ok")


def _sauber(text) -> str:
    """Entfernt Tokens aus Fehlermeldungen (requests hängt die URL samt Parametern an)."""
    return re.sub(r"((?:access|input)_token=)[^&\s'\"]+", r"\1***", str(text))


def meta_token_pruefen(tage: int = 14) -> None:
    """Warnt, wenn der Meta-Token bald abläuft (steht dann im Bericht der Routine)."""
    from datetime import datetime, timedelta, timezone
    try:
        daten = requests.get(f"{GRAPH}/debug_token", params={
            "input_token": META_ACCESS_TOKEN}, headers={"Authorization": f"Bearer {META_ACCESS_TOKEN}"},
            timeout=30).json().get("data", {})
    except Exception as e:
        print(f"⚠️  Meta-Token nicht prüfbar: {_sauber(e)}")
        return
    if not daten.get("is_valid", False):
        print("⚠️  META-TOKEN ist ungültig, bitte erneuern.")
        return
    grenze = datetime.now(timezone.utc) + timedelta(days=tage)
    for feld, was in (("expires_at", "läuft ab"), ("data_access_expires_at", "Datenzugriff endet")):
        ts = daten.get(feld) or 0
        if ts and datetime.fromtimestamp(ts, timezone.utc) < grenze:
            print(f"⚠️  META-TOKEN {was} am {datetime.fromtimestamp(ts):%d.%m.%Y}, rechtzeitig erneuern.")


# ── Wochensperre ───────────────────────────────────────────────────────────
# Im Tab "Automatik" des Redaktionsplans steht pro Woche eine Zeile Art "wochenpost" (instagram_planer.py
# überspringt solche Zeilen). Gibt es sie schon, postet ein zweiter Start nichts, egal wer ihn auslöst
# (Nachholfenster der Cloud-Routine, versehentlich gestartete lokale Routine, Handlauf).

def _plan():
    import instagram_planer as ip
    return ip, ip.sheets(), ip.einstellung("GOOGLE_SHEETS_SPREADSHEET_ID")


def sperre_pruefen(ip, sh, sid, schluessel):
    """Exit 3, wenn diese Woche schon (oder halb) gepostet wurde, Exit 1 wenn die Sperre nicht lesbar ist."""
    try:
        zeilen = list(ip.lade_protokoll(sh, sid))
    except Exception as e:
        print(f"❌  Wochensperre nicht lesbar ({_sauber(e)}), aus Sicherheit nichts gepostet.")
        sys.exit(1)
    for nr, e, kopf in zeilen:
        if e.get("Art") != "wochenpost" or e.get("Schlüssel") != schluessel:
            continue
        zustand = f"Facebook {e.get('Facebook-ID') or '?'}, Instagram {e.get('Instagram-ID') or '?'}"
        offen = [sp for sp in ("Facebook-ID", "Instagram-ID")
                 if e.get(sp, "").startswith(("läuft", "Fehler", "wartet")) and "[gemeldet]" not in e.get(sp, "")]
        if offen:
            print(f"⚠️  Wochenpost {schluessel} hängt ({zustand}). Bitte auf Facebook und Instagram nachsehen, "
                  "zum Nachposten die Zeile im Tab Automatik löschen.")
            for sp in offen:
                ip.schreibe(sh, sid, kopf, nr, sp, f"{e[sp]} [gemeldet]")
        else:
            print(f"Wochenpost {schluessel} schon erledigt ({zustand}), nichts zu tun.")
        sys.exit(3)


def sperre_setzen(ip, sh, sid, schluessel, drive_id):
    jetzt = datetime.now(ip.BERLIN)
    kopf = sh.values().get(spreadsheetId=sid, range=f"{ip.TAB}!A1:Z1").execute()["values"][0]
    werte = {"Art": "wochenpost", "Schlüssel": schluessel, "Titel": f"Wochenübersicht {schluessel}",
             "Verarbeitet am": f"{jetzt:%Y-%m-%d %H:%M}", "Drive-Datei": drive_id or "",
             "Facebook-ID": f"läuft seit {jetzt:%Y-%m-%d %H:%M}", "Instagram-ID": "wartet"}
    sh.values().append(spreadsheetId=sid, range=f"{ip.TAB}!A:{ip._buchstabe(len(kopf) - 1)}",
                       valueInputOption="RAW", insertDataOption="INSERT_ROWS",
                       body={"values": [[werte.get(k, "") for k in kopf]]}).execute()
    for nr, e, kopf in ip.lade_protokoll(sh, sid):
        if e.get("Art") == "wochenpost" and e.get("Schlüssel") == schluessel:
            return lambda spalte, wert: ip.schreibe(sh, sid, kopf, nr, spalte, wert)
    raise RuntimeError("Sperrzeile nach dem Anlegen nicht gefunden")


def _schritt(name, funktion, *args):
    """Führt einen Schritt aus, ohne dass sein Fehler die anderen verhindert. Liefert (ok, ergebnis)."""
    try:
        return True, funktion(*args)
    except KeyboardInterrupt:
        raise
    except requests.ReadTimeout:
        print(f"    ✗ {name} UNKLAR: Meta hat nicht rechtzeitig geantwortet, der Beitrag ist eventuell trotzdem "
              "online. Erst auf der Seite nachsehen, dann gegebenenfalls nachholen.")
        return False, "UNKLAR (Zeitüberschreitung)"
    except BaseException as e:  # auch sys.exit aus den Schritten
        print(f"    ✗ {name} fehlgeschlagen: {_sauber(e)}")
        return False, f"Fehler: {_sauber(e)[:150]}"


def main():
    if META_ACCESS_TOKEN:
        meta_token_pruefen()
    if "--probe" in sys.argv:
        probe()
        return
    if "--nur-poster" in sys.argv:
        step_screenshots()
        step_upload_poster()
        print("✅  Poster done, social media skipped (--nur-poster)")
        return

    print("🚀  vielbunt weekly social media routine\n")
    ip, sh, sid = _plan()
    if ip.angehalten(sh, sid, datetime.now(ip.BERLIN)):
        step_screenshots()
        step_upload_poster()
        print("✅  Nur das Plakat gebaut, nichts gepostet (Automatik angehalten).")
        return
    schluessel = ip.wochenschluessel(datetime.now(ip.BERLIN))
    sperre_pruefen(ip, sh, sid, schluessel)
    try:
        step_screenshots()  # ohne Bilder geht nichts, Fehler bricht ab
        ok_poster, drive_id = _schritt("Poster-Upload", step_upload_poster)
        _page_access_token()  # Meta-Zugang prüfen, bevor die Sperre gesetzt wird
        setze = sperre_setzen(ip, sh, sid, schluessel, drive_id if ok_poster else "")
        ok_fb, fb = _schritt("Facebook", step_post_facebook)
        setze("Facebook-ID", fb if ok_fb else f"{fb} [gemeldet]")
        setze("Instagram-ID", f"läuft seit {datetime.now(ip.BERLIN):%Y-%m-%d %H:%M}")
        ok_ig, ig = _schritt("Instagram", step_post_instagram)
        setze("Instagram-ID", ig if ok_ig else f"{ig} [gemeldet]")
    finally:
        try:
            sh.values().update(spreadsheetId=sid, range="'Vorbereitung'!A9:B9", valueInputOption="RAW",
                               body={"values": [["vielbunt weekly social zuletzt gelaufen",
                                                 f"{datetime.now(ip.BERLIN):%Y-%m-%d %H:%M}"]]}).execute()
        except Exception as e:
            print(f"(Lebenszeichen nicht geschrieben: {_sauber(e)})")
    print(f"\n{'✓' if ok_poster else '✗'} Poster  {'✓' if ok_fb else '✗'} Facebook  {'✓' if ok_ig else '✗'} Instagram")
    if not (ok_poster and ok_fb and ok_ig):
        sys.exit(1)
    print("✅  All done!")


if __name__ == "__main__":
    main()
