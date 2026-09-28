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
import sys
import time
import subprocess
from pathlib import Path

import requests

# ── Paths ──────────────────────────────────────────────────────────────────
KIOSK_DIR       = Path(__file__).parent
SOCIALMEDIA_PNG = KIOSK_DIR / "socialmedia.png"
POSTER_PNG      = KIOSK_DIR / "poster.png"

# ── Google Drive ───────────────────────────────────────────────────────────
# Folder ID for "AK Öffentlichkeitsarbeit/Social Media/Poster".
# Open the folder in Google Drive; the ID is the last segment of the URL:
#   https://drive.google.com/drive/folders/<FOLDER_ID>
POSTER_DRIVE_FOLDER_ID = "12EuQWm3kp9CHectJWfnMzqm-0z1v5DTg"

# Der Drive-Token liegt im postergenerator-Repo (gitignored), weil der auch die Sharepics hochlädt.
# Mit VB_POSTERGENERATOR_DIR lässt sich der Ordner umbiegen, z. B. in einer Cloud-Umgebung.
AKO_DIR          = Path(os.environ.get("VB_POSTERGENERATOR_DIR",
                                       Path.home() / "Documents/GitHub/postergenerator"))
CREDENTIALS_FILE = AKO_DIR / "gdrive_credentials.json"
TOKEN_FILE       = AKO_DIR / "gdrive_token.json"
SA_FILE          = AKO_DIR / "scheduler" / "service_account.json"
DRIVE_SCOPES     = ["https://www.googleapis.com/auth/drive.file"]

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
        "https://graph.facebook.com/v20.0/me/accounts",
        params={"access_token": META_ACCESS_TOKEN},
    )
    resp.raise_for_status()
    pages = resp.json().get("data", [])
    for page in pages:
        if page.get("id") == FACEBOOK_PAGE_ID:
            return page["access_token"]
    sys.exit(f"Page {FACEBOOK_PAGE_ID} not found in /me/accounts. Check META_ACCESS_TOKEN and page assignment.")


def _drive_service():
    """Drive-Zugang: bevorzugt der Service-Account (GOOGLE_SERVICE_ACCOUNT_JSON oder
    postergenerator/scheduler/service_account.json), solange der keinen Zugriff auf den
    Poster-Ordner hat, der alte OAuth-Token."""
    try:
        import json
        from google.oauth2 import service_account
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError:
        sys.exit(
            "Google Drive libraries not installed.\n"
            "Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        )

    roh = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if roh and not roh.startswith("{"):  # base64-kodiert
        import base64
        roh = base64.b64decode(roh).decode()
    info = json.loads(roh) if roh else (json.loads(SA_FILE.read_text()) if SA_FILE.exists() else None)
    if info:
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/drive"])
        svc = build("drive", "v3", credentials=creds, cache_discovery=False)
        try:
            meta = svc.files().get(fileId=POSTER_DRIVE_FOLDER_ID, fields="capabilities(canAddChildren)",
                                   supportsAllDrives=True).execute()
            if meta.get("capabilities", {}).get("canAddChildren"):
                return svc
        except HttpError:
            pass
        print("    (Service-Account hat noch keinen Zugriff auf den Poster-Ordner, nehme den OAuth-Token)")

    if not TOKEN_FILE.exists():
        sys.exit(
            f"Kein Drive-Zugang: Service-Account ohne Zugriff und kein Token unter {TOKEN_FILE}."
        )

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), DRIVE_SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        else:
            sys.exit("Drive token expired and cannot be refreshed. Re-authenticate interactively.")

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


def step_post_facebook():
    print("📘  Posting to Facebook…")
    page_token = _page_access_token()
    url = f"https://graph.facebook.com/v20.0/{FACEBOOK_PAGE_ID}/photos"
    with open(SOCIALMEDIA_PNG, "rb") as fh:
        resp = requests.post(
            url,
            data={"caption": CAPTION, "access_token": page_token, "published": "true"},
            files={"source": ("socialmedia.png", fh, "image/png")},
        )
    if not resp.ok:
        print(f"    ✗ Facebook error {resp.status_code}: {resp.text}")
    resp.raise_for_status()
    print(f"    ✓ Facebook post created (id={resp.json().get('id')})\n")


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

    # Make it public
    link = svc.permissions().create(
        fileId=tmp_id,
        body={"type": "anyone", "role": "reader"},
        fields="id",
        supportsAllDrives=True,
    ).execute()

    image_url = f"https://drive.google.com/uc?export=view&id={tmp_id}"

    try:
        page_token = _page_access_token()
        # Create media container
        container = requests.post(
            f"https://graph.facebook.com/v20.0/{INSTAGRAM_ACCOUNT_ID}/media",
            data={"image_url": image_url, "caption": CAPTION, "access_token": page_token},
        )
        if not container.ok:
            print(f"    ✗ Instagram container error {container.status_code}: {container.text}")
        container.raise_for_status()
        creation_id = container.json()["id"]

        # Wait for Instagram to finish processing the image before publishing
        for attempt in range(24):  # up to ~2 minutes
            status_r = requests.get(
                f"https://graph.facebook.com/v20.0/{creation_id}",
                params={"fields": "status_code", "access_token": page_token},
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
            f"https://graph.facebook.com/v20.0/{INSTAGRAM_ACCOUNT_ID}/media_publish",
            data={"creation_id": creation_id, "access_token": page_token},
        )
        if not publish.ok:
            print(f"    ✗ Instagram publish error {publish.status_code}: {publish.text}")
        publish.raise_for_status()
        print(f"    ✓ Instagram post created (id={publish.json().get('id')})\n")

    finally:
        # Temp-Datei immer aufräumen. In geteilten Ablagen darf nicht jede Rolle endgültig
        # löschen, darum erst den öffentlichen Link weg, dann löschen oder in den Papierkorb.
        try:
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
                browser = await p.chromium.launch()
                page = await browser.new_page(timezone_id="Europe/Berlin")
                await page.goto(f"http://127.0.0.1:{port}/kiosk.html?mode=socialmedia&poster=true")
                await page.wait_for_selector(".sm-event", timeout=30000)
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
    except (Exception, SystemExit) as fehler:
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
        except (Exception, SystemExit) as fehler:
            print(f"    ✗ Meta: {fehler}")
            ok = False
    if not ok:
        sys.exit("❌  Probelauf mit Fehlern")
    print("✅  Probelauf ok")


def main():
    if "--probe" in sys.argv:
        probe()
        return
    print("🚀  vielbunt weekly social media routine\n")
    step_screenshots()
    step_upload_poster()
    if "--nur-poster" in sys.argv:
        print("✅  Poster done, social media skipped (--nur-poster)")
        return
    step_post_facebook()
    step_post_instagram()
    print("✅  All done!")


if __name__ == "__main__":
    main()
