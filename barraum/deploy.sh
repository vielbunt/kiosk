#!/bin/bash
# Barraum-Kiosk bauen und auf den Pi im Barraum bringen.
#
#   barraum/deploy.sh                 bauen, Seiten + Clips hochladen, Browser neu starten
#   barraum/deploy.sh --rendern       vorher fehlende Queerbar-Clips aus dem Sheet rendern
#   barraum/deploy.sh --ohne-clips    nur die Seiten (schnell, ein paar KB)
#   barraum/deploy.sh --ohne-neustart Browser nicht neu starten
#
# Der Pi laedt im Betrieb alles selbst nach (Sheet, Posts, Termine). Neu hochladen muss man nur, wenn sich
# der Code oder die vorgerenderten Clips aendern. Den Modus (standard / queerbar / event) stellt man im Sheet um.
# Ziel: Pi im Barraum, im Ordner ~/barraum. Im lokalen Netz kiosk-admin@192.168.10.60, sonst automatisch ueber
# Tailscale (barraum-pi), egal wo man gerade ist. PI_HOST=... erzwingt eine Adresse.

set -euo pipefail
cd "$(dirname "$0")"

# Erst die Adresse im lokalen Netz, sonst Tailscale (Rechnername barraum-pi). Mit PI_HOST laesst sich das ueberschreiben.
if [ -z "${PI_HOST:-}" ]; then
    if ssh -o ConnectTimeout=3 -o BatchMode=yes kiosk-admin@192.168.10.60 true 2>/dev/null; then
        PI_HOST="kiosk-admin@192.168.10.60"
    else
        PI_HOST="kiosk-admin@barraum-pi"
        echo "Pi nicht im lokalen Netz, nehme Tailscale ($PI_HOST)"
    fi
fi
ZIEL="barraum"
clips=1; neustart=1; rendern=0; show=0
for a in "$@"; do
    case "$a" in
        --ohne-clips) clips=0 ;;
        --ohne-neustart) neustart=0 ;;
        --rendern) rendern=1 ;;
        --show) show=1 ;;
        *) sed -n '2,13p' "$0"; exit 1 ;;
    esac
done

ssh -o ConnectTimeout=8 "$PI_HOST" true || { echo "Pi nicht erreichbar ($PI_HOST). Im Netz des queeren Zentrums?" >&2; exit 1; }

[ $rendern = 1 ] && node render/queerbar-clips.mjs
[ $show = 1 ] && node render/show.mjs ${SHOW_TAG:+--tag=$SHOW_TAG}
[ -d node_modules ] || npm install --silent
node build.mjs

ssh "$PI_HOST" "mkdir -p ~/$ZIEL/clips/vielbunt ~/$ZIEL/clips/queerbar ~/$ZIEL/clips/7jahre"

# Seiten, Schriften, Bilder, Clip-Liste. Die Clip-Ordner bleiben dabei unberuehrt.
rsync -a --delete --exclude 'clips/vielbunt' --exclude 'clips/queerbar' --exclude 'clips/7jahre' dist/ "$PI_HOST:$ZIEL/"

if [ $clips = 1 ]; then
    rsync -a --delete clips/ "$PI_HOST:$ZIEL/clips/vielbunt/"
    if ls clips-queerbar/*.jpg >/dev/null 2>&1; then
        ssh "$PI_HOST" "rm -f ~/$ZIEL/clips/queerbar/*"
        rsync -a clips-queerbar/*.jpg "$PI_HOST:$ZIEL/clips/queerbar/"
    fi
    if [ -f clips-7jahre/show.mp4 ]; then
        rsync -a clips-7jahre/show.mp4 clips-7jahre/show.js "$PI_HOST:$ZIEL/clips/7jahre/"
    fi
fi

# Der Autostart (kiosk.service) zeigt noch auf ~/kiosk-lite.html, solange niemand mit sudo umgestellt hat.
# Der Zeiger leitet dann auf die neue Weiche weiter, sonst muss nichts am Service angefasst werden.
ssh "$PI_HOST" "[ -f ~/kiosk-lite.html.alt ] || { grep -q 'http-equiv=refresh' ~/kiosk-lite.html 2>/dev/null || cp ~/kiosk-lite.html ~/kiosk-lite.html.alt; }; printf '%s\n' '<!DOCTYPE html><meta charset=utf-8><meta http-equiv=refresh content=\"0;url=barraum/start.html\">' > ~/kiosk-lite.html"

echo "Hochgeladen nach $PI_HOST:~/$ZIEL"
if [ $neustart = 1 ]; then
    # Beendet nur den Browser, systemd startet ihn nach ein paar Sekunden neu (kein sudo noetig)
    # Haengt der Browser (kam vor), reicht ein normales Beenden nicht: nach 4 Sekunden notfalls hart. systemd startet erst nach 10 Sekunden neu.
    ssh "$PI_HOST" 'pkill -u kiosk-admin -x cage || true; sleep 4; pkill -9 -u kiosk-admin -x cage || true'
    echo "Browser wird neu gestartet."
fi
ssh "$PI_HOST" "du -sh ~/$ZIEL | cut -f1 | sed 's/^/Gesamtgroesse auf dem Pi: /'"
