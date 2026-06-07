#!/usr/bin/env python3
"""Renders kiosk.html?mode=socialmedia&poster=true and saves a 3240×4050 PNG (3× scale)."""

import asyncio
import http.server
import os
import threading
from pathlib import Path

KIOSK_DIR = Path(__file__).parent
PORT = 7655
OUT = KIOSK_DIR / "poster.png"


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
                device_scale_factor=3,  # renders at 3240×4050
            )
            await page.goto(
                f"http://127.0.0.1:{PORT}/kiosk.html?mode=socialmedia&poster=true"
            )
            await page.wait_for_selector(".sm-event", timeout=30000)
            await asyncio.sleep(0.5)  # let rAF trim settle
            await page.screenshot(path=str(OUT), full_page=False)
            await browser.close()
    finally:
        server.shutdown()

    print(f"Saved: {OUT}")


asyncio.run(main())
