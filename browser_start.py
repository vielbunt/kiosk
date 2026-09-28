"""
Startet Chromium für die Screenshots, lokal wie in der Cloud gleich.

In der Claude-Cloud geht der ganze Verkehr über einen Proxy (HTTPS_PROXY). Python-requests nimmt
den automatisch, Chromium aber nicht, dann lädt kiosk.html weder Termine noch Cera Pro. Darum wird
der Proxy hier ausdrücklich übergeben. Der Proxy schaut in HTTPS rein und hat ein eigenes Zertifikat,
deshalb werden Zertifikatsfehler nur in diesem Fall ignoriert. Lokal ändert sich nix.
"""

import os
from urllib.parse import urlparse


def _proxy():
    roh = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not roh:
        return None
    teile = urlparse(roh)
    proxy = {"server": f"{teile.scheme or 'http'}://{teile.hostname}:{teile.port or 80}"}
    if teile.username:
        proxy["username"] = teile.username
        proxy["password"] = teile.password or ""
    keine = os.environ.get("NO_PROXY") or os.environ.get("no_proxy")
    # 127.0.0.1 ist unser eigener kleiner Webserver, der darf nicht durch den Proxy
    proxy["bypass"] = ",".join(filter(None, [keine, "127.0.0.1", "localhost"]))
    return proxy


async def browser_und_seite(p, **seiten_optionen):
    """Gibt (browser, page) zurück, Termine immer in Darmstädter Zeit."""
    proxy = _proxy()
    browser = await p.chromium.launch(proxy=proxy) if proxy else await p.chromium.launch()
    page = await browser.new_page(
        timezone_id="Europe/Berlin",
        locale="de-DE",
        ignore_https_errors=bool(proxy),
        **seiten_optionen,
    )
    return browser, page
