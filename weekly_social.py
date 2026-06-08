#!/usr/bin/env python3
"""
vielbunt weekly social media routine.
Intended to run every Sunday ~9am.

Steps:
  1. Generate socialmedia.png (1080×1350) and poster.png (3240×4050)
  2. Upload poster.png to Google Drive → AK Öffentlichkeitsarbeit/Social Media/Poster
  3. Post socialmedia.png to the vielbunt Facebook page
  4. Post socialmedia.png to the vielbunt Instagram account
"""

import sys
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

AKO_DIR          = Path("/Users/janbambach/AKÖ")
CREDENTIALS_FILE = AKO_DIR / "gdrive_credentials.json"
TOKEN_FILE       = AKO_DIR / "gdrive_token.json"
DRIVE_SCOPES     = ["https://www.googleapis.com/auth/drive.file"]

# ── Meta credentials ───────────────────────────────────────────────────────
try:
    from meta_config import META_ACCESS_TOKEN, FACEBOOK_PAGE_ID, INSTAGRAM_ACCOUNT_ID
except ImportError:
    sys.exit(
        "meta_config.py not found.\n"
        "Copy meta_config_template.py → meta_config.py and fill in your credentials."
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
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit(
            "Google Drive libraries not installed.\n"
            "Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        )

    if not TOKEN_FILE.exists():
        sys.exit(
            f"Drive token not found at {TOKEN_FILE}.\n"
            "Authenticate once interactively by running the gdrive_upload.py script."
        )

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), DRIVE_SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        else:
            sys.exit("Drive token expired and cannot be refreshed. Re-authenticate interactively.")

    return build("drive", "v3", credentials=creds)


# ── Steps ──────────────────────────────────────────────────────────────────

def step_screenshots():
    print("📸  Generating screenshots…")
    subprocess.run([sys.executable, str(KIOSK_DIR / "screenshot_socialmedia.py")], check=True)
    subprocess.run([sys.executable, str(KIOSK_DIR / "screenshot_poster.py")], check=True)
    print("    ✓ socialmedia.png and poster.png ready\n")


def step_upload_poster():
    print("📁  Uploading poster.png to Google Drive…")
    from googleapiclient.http import MediaFileUpload

    svc = _drive_service()
    media = MediaFileUpload(str(POSTER_PNG), mimetype="image/png", resumable=True)
    result = svc.files().create(
        body={"name": "poster.png", "parents": [POSTER_DRIVE_FOLDER_ID]},
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
    tmp = svc.files().create(
        body={"name": "_vielbunt_ig_tmp.png"},
        media_body=media,
        fields="id",
    ).execute()
    tmp_id = tmp["id"]

    # Make it public
    svc.permissions().create(
        fileId=tmp_id,
        body={"type": "anyone", "role": "reader"},
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
        # Always clean up the temp Drive file
        try:
            svc.files().delete(fileId=tmp_id).execute()
        except Exception:
            pass


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("🚀  vielbunt weekly social media routine\n")
    step_screenshots()
    step_upload_poster()
    step_post_facebook()
    step_post_instagram()
    print("✅  All done!")


if __name__ == "__main__":
    main()
