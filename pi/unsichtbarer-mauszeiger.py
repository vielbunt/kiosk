#!/usr/bin/env python3
"""Legt ein unsichtbares Mauszeiger-Theme in ~/.icons/default an (auf dem Pi als kiosk-admin ausfuehren).

cage malt ohne angeschlossene Maus trotzdem einen Pfeil, und das CSS der Seite greift nur, solange
Chromium den Zeiger malt. Das Theme im Home-Ordner wird vor dem System-Theme gefunden, sudo braucht es nicht.
Rueckgaengig: rm -r ~/.icons/default
"""
import os
import struct

base = os.path.expanduser("~/.icons/default")
cur = os.path.join(base, "cursors")
os.makedirs(cur, exist_ok=True)


def xcursor(size):
    # Xcursor-Datei mit einem einzigen, voll transparenten Pixel
    img = struct.pack("<9I", 36, 0xfffd0002, size, 1, 1, 1, 0, 0, 0) + struct.pack("<I", 0)
    hdr = struct.pack("<4sIII", b"Xcur", 16, 0x10000, 1)
    toc = struct.pack("<III", 0xfffd0002, size, 16 + 12)
    return hdr + toc + img


with open(os.path.join(cur, "blank"), "wb") as f:
    f.write(xcursor(24))

# alle Namen, die das System-Theme kennt, auf das leere Bild zeigen lassen
names = set()
for d in ["/usr/share/icons/Adwaita/cursors", "/usr/share/icons/default/cursors"]:
    if os.path.isdir(d):
        names.update(os.listdir(d))
names.update(["default", "left_ptr", "arrow", "pointer", "hand2", "text", "xterm", "wait", "watch",
              "progress", "crosshair", "move", "grab", "grabbing", "not-allowed", "none",
              # Ladezeiger beim Seitenwechsel (Chromium fragt je nach Version nach einem dieser Namen)
              "left_ptr_watch", "half-busy", "left_ptr_help", "context-menu", "default", "3085a0e285b7c6c1c1c5f3b4f6f0dc8e",
              "08e8e1c95fe2fc01f976f1e063a24ccd", "00008160000006810000408080010102", "d9ce0ab605698f320427677b458ad60b"])
names.discard("blank")
for n in names:
    p = os.path.join(cur, n)
    if os.path.lexists(p):
        os.remove(p)
    os.symlink("blank", p)

with open(os.path.join(base, "index.theme"), "w") as f:
    f.write("[Icon Theme]\nName=Unsichtbar\nComment=leerer Mauszeiger fuer den Kiosk\n")
print(len(names), "Zeigernamen auf leer gesetzt")
