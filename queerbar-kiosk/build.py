#!/usr/bin/env python3
"""Baut aus queerbar-kiosk.src.html eine einzelne Datei fuer vielbunt.org.

Schriften und Bilder landen als data-URI direkt in der HTML, dazu der aktuelle
Stand des Google Sheets als Rueckfallebene, falls beim allerersten Start kein Netz da ist.

    python3 build.py            -> dist/queerbar-kiosk.html
    python3 build.py --offline  -> ohne Sheet-Abruf (Stand bleibt leer)
"""
import base64
import json
import re
import sys
import urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent
SHEET_ID = "152xB92pnSdWQGcb8QO9tB1J0yOjslCxOAsFX6Ap9d1k"
GIDS = {"slides": 0, "drinks": 1, "songs": 2, "settings": 3}
MIME = {".woff2": "font/woff2", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def data_uri(pfad: Path) -> str:
    return f"data:{MIME[pfad.suffix.lower()]};base64," + base64.b64encode(pfad.read_bytes()).decode()


def sheet_stand() -> dict:
    stand = {}
    for name, gid in GIDS.items():
        url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
        with urllib.request.urlopen(url, timeout=20) as r:
            text = r.read().decode("utf-8")
        if text.lstrip().startswith("<"):
            raise SystemExit(f"Tab {name} liefert kein CSV, ist das Sheet noch fuer alle freigegeben?")
        stand[name] = text
    return stand


def main() -> None:
    src = (HIER / "queerbar-kiosk.src.html").read_text(encoding="utf-8")

    src = re.sub(r'url\("(fonts/[^"]+\.woff2)"\)', lambda m: f'url("{data_uri(HIER / m.group(1))}")', src)
    src = re.sub(r'"(assets/[^"]+\.(?:jpe?g|png|webp))"', lambda m: f'"{data_uri(HIER / m.group(1))}"', src)

    if "--offline" not in sys.argv:
        stand = json.dumps(sheet_stand(), ensure_ascii=False)
        # </script> im Sheet-Text wuerde das Script beenden
        stand = stand.replace("</", "<\\/")
        src = src.replace("/*@DEFAULT@*/null", stand)

    ziel = HIER / "dist" / "queerbar-kiosk.html"
    ziel.parent.mkdir(exist_ok=True)
    ziel.write_text(src, encoding="utf-8")
    print(f"{ziel}  ({ziel.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
