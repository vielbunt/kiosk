#!/usr/bin/env python3
"""
Macht aus poster.png ein Druck-PDF: zwei A3-Querformat-Seiten, die übereinander
gelegt ein A2-Plakat ergeben (gleiche Regeln wie bei den Sharepics in script.py im postergenerator-Repo).

- Die Naht liegt immer in einer Lücke zwischen zwei Blöcken (Header, Terminzeilen,
  Legende, Footer), es wird also nie ein Termin durchgeschnitten.
- Keine Grafik geht über die Blattkante, jede Seite hat einen weißen Rand.
- Seite 1: obere Hälfte, unten an der Naht ausgerichtet.
  Seite 2: untere Hälfte, oben an der Naht ausgerichtet.
- Dateiname enthält das Datum des ersten und letzten Termins.

Aufruf zum Testen: python3 poster_druck.py  → schreibt das PDF neben poster.png
"""

import io
import json
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

from PIL import Image

KIOSK_DIR = Path(__file__).parent
POSTER_PNG = KIOSK_DIR / "poster.png"
LAYOUT_JSON = KIOSK_DIR / "poster_layout.json"

DPI = 300
A3_BREITE_MM = 420
A3_HOEHE_MM = 297
RAND_MM = 6
HINTERGRUND = (255, 255, 255)


def mm_zu_px(mm: float) -> int:
    return round(mm / 25.4 * DPI)


def finde_naht(bloecke: list[dict], hoehe: int) -> int:
    """Sucht die Lücke zwischen zwei Blöcken, die am nächsten an der Bildmitte liegt."""
    kandidaten = []
    for oben, unten in zip(bloecke, bloecke[1:]):
        luecke_von = oben["bottom"]
        luecke_bis = unten["top"]
        if luecke_bis < luecke_von:  # überlappt, da darf nicht geschnitten werden
            continue
        kandidaten.append(round((luecke_von + luecke_bis) / 2))
    if not kandidaten:
        raise RuntimeError("Keine Lücke zwischen den Blöcken gefunden, Naht kann nicht gesetzt werden.")
    # Je ausgeglichener beide Teile, desto größer kann das Plakat gedruckt werden
    return min(kandidaten, key=lambda y: max(y, hoehe - y))


def pruefe_naht(img: Image.Image, y: int) -> None:
    """Sicherheitscheck: in der Schnittzeile darf nur eine Farbe vorkommen (also keine Schrift)."""
    zeile = img.crop((0, y, img.width, y + 1)).convert("RGB")
    farben = zeile.getcolors(maxcolors=4096) or []
    if len(farben) > 3:
        raise RuntimeError(f"Schnittzeile y={y} ist nicht leer ({len(farben)} Farben), Naht würde Inhalt treffen.")


def termin_zeitraum(daten: list[str], heute: date | None = None) -> tuple[date, date]:
    """Liest '14.09.' aus den Datums-Labels. Das Jahr steht nicht drin, also ab heute schätzen."""
    heute = heute or datetime.now(ZoneInfo("Europe/Berlin")).date()  # auch in der Cloud (UTC) das Darmstädter Datum
    tage = []
    for label in daten:
        m = re.search(r"(\d{1,2})\.(\d{1,2})\.", label)
        if not m:
            continue
        tag, monat = int(m.group(1)), int(m.group(2))
        d = date(heute.year, monat, tag)
        if d < heute - timedelta(days=180):  # Jahreswechsel, z.B. im Dezember schon Januar-Termine
            d = date(heute.year + 1, monat, tag)
        tage.append(d)
    if not tage:
        raise RuntimeError("Keine Termin-Daten im Layout gefunden.")
    return min(tage), max(tage)


def dateiname(start: date, ende: date) -> str:
    # Gleiches Schema wie die Sharepic-Plakate im Drive-Ordner ("TT.MM.- Titel")
    return f"{start:%d.%m.} bis {ende:%d.%m.}- Nächste Termine von vielbunt.pdf"


def baue_seiten(img: Image.Image, naht: int) -> list[Image.Image]:
    seite_w, seite_h = mm_zu_px(A3_BREITE_MM), mm_zu_px(A3_HOEHE_MM)
    rand = mm_zu_px(RAND_MM)
    nutz_w, nutz_h = seite_w - 2 * rand, seite_h - 2 * rand

    teil_oben = img.crop((0, 0, img.width, naht))
    teil_unten = img.crop((0, naht, img.width, img.height))

    # Gemeinsamer Maßstab, damit beide Teile gleich breit bleiben
    faktor = min(nutz_w / img.width, nutz_h / teil_oben.height, nutz_h / teil_unten.height)
    b = int(img.width * faktor)
    x = (seite_w - b) // 2

    def skaliert(teil):
        return teil.resize((b, round(teil.height * faktor)), Image.LANCZOS)

    oben, unten = skaliert(teil_oben), skaliert(teil_unten)

    seite1 = Image.new("RGB", (seite_w, seite_h), HINTERGRUND)
    seite1.paste(oben, (x, seite_h - rand - oben.height))
    seite2 = Image.new("RGB", (seite_w, seite_h), HINTERGRUND)
    seite2.paste(unten, (x, rand))

    print(f"    Naht bei y={naht} von {img.height}px, Plakatbreite {b / DPI * 25.4:.0f} mm")
    return [seite1, seite2]


def speichere_pdf(seiten: list[Image.Image], ausgabe: Path) -> None:
    import img2pdf

    pngs = []
    for seite in seiten:
        puffer = io.BytesIO()
        seite.save(puffer, "PNG")
        pngs.append(puffer.getvalue())
    layout = img2pdf.get_fixed_dpi_layout_fun((DPI, DPI))
    ausgabe.write_bytes(img2pdf.convert(pngs, layout_fun=layout))


def erstelle_druck_pdf(ziel_ordner: Path = KIOSK_DIR) -> Path:
    img = Image.open(POSTER_PNG).convert("RGB")
    layout = json.loads(LAYOUT_JSON.read_text())

    naht = finde_naht(layout["bloecke"], img.height)
    pruefe_naht(img, naht)
    start, ende = termin_zeitraum(layout["daten"])

    ausgabe = ziel_ordner / dateiname(start, ende)
    speichere_pdf(baue_seiten(img, naht), ausgabe)
    return ausgabe


if __name__ == "__main__":
    print(f"Gespeichert: {erstelle_druck_pdf()}")
