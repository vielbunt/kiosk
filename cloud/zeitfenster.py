"""
Prüft, ob es in Darmstadt gerade die gewünschte Stunde ist.

Cloud-Routinen laufen nach UTC. Damit eine Routine im Sommer wie im Winter um z. B. 05:00 Uhr
Darmstädter Zeit läuft, wird sie zu beiden möglichen UTC-Stunden gestartet (03:00 und 04:00 UTC)
und dieses Skript lässt nur den passenden Lauf durch:

    python3 cloud/zeitfenster.py 5      # Exit 0 wenn es in Darmstadt 5 Uhr ist, sonst Exit 3
"""

import sys
from datetime import datetime
from zoneinfo import ZoneInfo

if len(sys.argv) != 2 or not sys.argv[1].isdigit():
    sys.exit(__doc__)

soll = int(sys.argv[1])
jetzt = datetime.now(ZoneInfo("Europe/Berlin"))
if jetzt.hour == soll:
    print(f"Dran: {jetzt:%Y-%m-%d %H:%M %Z}")
    sys.exit(0)
print(f"Nicht dran: in Darmstadt ist es {jetzt:%H:%M %Z}, gewollt ist {soll}:00 Uhr. Nichts tun.")
sys.exit(3)
