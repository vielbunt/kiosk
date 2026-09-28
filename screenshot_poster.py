#!/usr/bin/env python3
"""Renders kiosk.html?mode=socialmedia&poster=true and saves a 5400×6750 PNG (5× scale, for A2 print).

Next to poster.png it writes poster_layout.json with the position of every block
(header, each event row, legend, footer) and the date labels. poster_druck.py
uses it to put the A3 seam in a gap between two blocks.
"""

import asyncio
import http.server
import json
import os
import threading
from pathlib import Path

KIOSK_DIR = Path(__file__).parent
PORT = 7655
SCALE = 5  # 1080×1350 CSS-px → 5400×6750, reicht für ca. 340 dpi auf A2
OUT = KIOSK_DIR / "poster.png"
LAYOUT = KIOSK_DIR / "poster_layout.json"

# Liefert alle Blöcke von oben nach unten, jeweils mit top/bottom in Bild-Pixeln
LAYOUT_JS = """
(scale) => {
    const bloecke = [...document.querySelectorAll('.sm-header, .sm-event, .sm-legend, .sm-footer')]
        .map(el => {
            const r = el.getBoundingClientRect();
            return { klasse: el.className, top: r.top * scale, bottom: r.bottom * scale };
        })
        .sort((a, b) => a.top - b.top);
    const daten = [...document.querySelectorAll('.sm-event-date')].map(el => el.textContent.trim());
    return { bloecke, daten };
}
"""


def start_server():
    os.chdir(KIOSK_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **kw: None
    server = http.server.HTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


async def main():
    from playwright.async_api import async_playwright

    server = start_server()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(
                viewport={"width": 1080, "height": 1350},
                device_scale_factor=SCALE,
            )
            await page.goto(
                f"http://127.0.0.1:{PORT}/kiosk.html?mode=socialmedia&poster=true"
            )
            await page.wait_for_selector(".sm-event", timeout=30000)
            await asyncio.sleep(0.5)  # let rAF trim settle
            await page.screenshot(path=str(OUT), full_page=False)
            layout = await page.evaluate(LAYOUT_JS, SCALE)
            await browser.close()
    finally:
        server.shutdown()

    LAYOUT.write_text(json.dumps(layout, ensure_ascii=False, indent=2))
    print(f"Saved: {OUT}")
    print(f"Saved: {LAYOUT}")


asyncio.run(main())
