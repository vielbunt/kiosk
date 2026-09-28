#!/usr/bin/env python3
"""Renders kiosk.html?mode=socialmedia and saves a 1080×1350 PNG."""

import asyncio
import http.server
import os
import threading
from pathlib import Path

KIOSK_DIR = Path(__file__).parent
PORT = 7655
OUT = KIOSK_DIR / "socialmedia.png"


def start_server():
    os.chdir(KIOSK_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a, **kw: None
    server = http.server.HTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


async def main():
    from playwright.async_api import async_playwright
    from browser_start import browser_und_seite

    server = start_server()
    try:
        async with async_playwright() as p:
            browser, page = await browser_und_seite(
                p,
                viewport={"width": 1080, "height": 1350},
            )
            await page.goto(f"http://127.0.0.1:{PORT}/kiosk.html?mode=socialmedia&poster=true")
            # Cera Pro gleich anstoßen, in der Cloud kommt sie erst von vielbunt.org
            await page.evaluate("Promise.all([document.fonts.load(\"400 20px 'Cera Pro'\"), document.fonts.load(\"700 20px 'Cera Pro'\")])")
            await page.wait_for_selector(".sm-event", timeout=30000)
            await page.evaluate("document.fonts.ready")
            await asyncio.sleep(0.5)  # let rAF trim settle
            await page.screenshot(path=str(OUT), full_page=False)
            await browser.close()
    finally:
        server.shutdown()

    print(f"Saved: {OUT}")


asyncio.run(main())
