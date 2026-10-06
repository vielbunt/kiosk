"""
Prüft, ob es in Darmstadt gerade die gewünschte Stunde ist.

Cloud-Routinen laufen nach UTC. Damit eine Routine im Sommer wie im Winter um z. B. 05:00 Uhr
Darmstädter Zeit läuft, wird sie zu beiden möglichen UTC-Stunden gestartet (03:00 und 04:00 UTC)
und dieses Skript lässt nur den passenden Lauf durch:

    python3 cloud/zeitfenster.py 5      # Exit 0 wenn es in Darmstadt 5 Uhr ist, sonst Exit 3
    python3 cloud/zeitfenster.py 5 6    # Exit 0 zwischen 5:00 und 6:59 (6 Uhr = Nachholversuch)

Mit zweiter Zahl braucht das aufgerufene Skript eine eigene Sperre gegen einen zweiten Lauf am selben
Tag (taeglich.py --einmal-pro-tag), sonst läuft es zweimal.
"""

import sys
from datetime import datetime
from zoneinfo import ZoneInfo

if len(sys.argv) not in (2, 3) or not all(a.isdigit() for a in sys.argv[1:]):
    sys.exit(__doc__)

soll = int(sys.argv[1])
bis = int(sys.argv[2]) if len(sys.argv) == 3 else soll
jetzt = datetime.now(ZoneInfo("Europe/Berlin"))
if soll <= jetzt.hour <= bis:
    print(f"Dran{' (Nachholversuch)' if jetzt.hour > soll else ''}: {jetzt:%Y-%m-%d %H:%M %Z}")
    sys.exit(0)
gewollt = f"{soll}:00 Uhr" if bis == soll else f"{soll}:00 bis {bis}:59 Uhr"
print(f"Nicht dran: in Darmstadt ist es {jetzt:%H:%M %Z}, gewollt ist {gewollt}. Nichts tun.")
sys.exit(3)
