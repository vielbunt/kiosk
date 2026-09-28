"""
Startet Chromium für die Screenshots, lokal wie in der Cloud gleich.

In der Claude-Cloud geht der ganze Verkehr über einen Proxy (HTTPS_PROXY), der in HTTPS
reinschaut. Chromium kommt damit nur unzuverlässig klar (Termine kamen mal an, mal nicht).
Python-requests dagegen klappt jedes Mal. Darum holt in der Cloud Python alles, was die Seite
von außen braucht (Termine, Beiträge, Cera Pro), und reicht es dem Browser durch. Chromium selbst
geht dann gar nicht ins Netz. Lokal ändert sich nix, da lädt der Browser ganz normal.
"""

import asyncio
import os
import sys
from pathlib import Path

LOKAL = ("http://127.0.0.1", "http://localhost")
WEGLASSEN = {"content-encoding", "content-length", "transfer-encoding", "connection"}


def _in_der_cloud() -> bool:
    # VB_NETZ_DURCH_PYTHON=1 erzwingt den Cloud-Weg auch lokal, zum Testen
    return bool(os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
                or os.environ.get("VB_NETZ_DURCH_PYTHON"))


def _ca_bundle():
    """Zertifikate, denen der Cloud-Proxy vertraut. requests nimmt sonst nur certifi."""
    for kandidat in (os.environ.get("REQUESTS_CA_BUNDLE"), os.environ.get("SSL_CERT_FILE"),
                     "/root/.ccr/ca-bundle.crt", "/etc/ssl/certs/ca-certificates.crt"):
        if kandidat and Path(kandidat).exists():
            return kandidat
    return True


async def _durchreichen(route, request):
    url = request.url
    if url.startswith(LOKAL) or url.startswith("data:"):
        await route.continue_()
        return
    import requests
    try:
        antwort = await asyncio.to_thread(
            requests.request, request.method, url,
            headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
            data=request.post_data_buffer, timeout=60, verify=_ca_bundle(),
        )
    except Exception as fehler:
        print(f"    ✗ Netz: {url} ging nicht: {fehler}", file=sys.stderr)
        await route.abort()
        return
    kopf = {k: v for k, v in antwort.headers.items() if k.lower() not in WEGLASSEN}
    kopf["access-control-allow-origin"] = "*"
    if antwort.status_code >= 400:
        print(f"    ✗ Netz: {url} antwortet {antwort.status_code}", file=sys.stderr)
    await route.fulfill(status=antwort.status_code, headers=kopf, body=antwort.content)


async def browser_und_seite(p, **seiten_optionen):
    """Gibt (browser, page) zurück, Termine immer in Darmstädter Zeit."""
    browser = await p.chromium.launch()
    page = await browser.new_page(timezone_id="Europe/Berlin", locale="de-DE", **seiten_optionen)
    # Fehler aus der Seite mitschreiben, sonst sieht man in der Cloud nur "Timeout"
    page.on("console", lambda m: m.type in ("error", "warning")
            and print(f"    [Seite] {m.type}: {m.text}", file=sys.stderr))
    page.on("pageerror", lambda e: print(f"    [Seite] Fehler: {e}", file=sys.stderr))
    if _in_der_cloud():
        await page.route("**/*", _durchreichen)
    return browser, page
