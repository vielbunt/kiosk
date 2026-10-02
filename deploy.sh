#!/bin/bash
# Kiosk-Dateien auf vielbunt.org hochladen (FTPS).
#
#   ./deploy.sh kiosk       baut kiosk-show.html neu und laedt sie als kiosk.html hoch
#   ./deploy.sh queerbar    baut den Queerbar-Kiosk neu und laedt queerbar-kiosk.html hoch
#   ./deploy.sh probe       nur anmelden und den Stand auf dem Server zeigen, nix aendern
#
# Option --ohne-build: die vorhandene Datei hochladen, ohne vorher neu zu bauen.
#
# Server, Benutzer und Ordner stehen in deploy.env (nicht im Repo, siehe deploy.env.example).
# Das Passwort liegt nur im macOS-Schluesselbund, einmalig anlegen mit:
#   security add-internet-password -U -s <FTP_HOST> -a <FTP_USER> -r "ftp " -l ftp-vielbunt -w
# Vor jedem Upload wird die Datei vom Server nach deploy-backups/ gesichert.

set -euo pipefail
cd "$(dirname "$0")"

[ -f deploy.env ] || { echo "deploy.env fehlt (Vorlage: deploy.env.example)" >&2; exit 1; }
source deploy.env
: "${FTP_HOST:?}" "${FTP_USER:?}" "${FTP_DIR:?}" "${SITE_URL:?}"
VIELBUNT_MOTION="${VIELBUNT_MOTION:-$PWD/vielbunt-motion}"
QUEERBAR_KIOSK="${QUEERBAR_KIOSK:-$PWD/queerbar-kiosk}"

ziel="${1:-}"
build=1
[ "${2:-}" = "--ohne-build" ] && build=0

pw=$(security find-internet-password -s "$FTP_HOST" -a "$FTP_USER" -w 2>/dev/null) || {
    echo "Kein Passwort im Schluesselbund fuer $FTP_USER@$FTP_HOST, siehe Kopf von deploy.sh" >&2
    exit 1
}
# Zugangsdaten per stdin an curl, damit sie nicht in der Prozessliste auftauchen
esc=${pw//\\/\\\\}; esc=${esc//\"/\\\"}
ftp() { printf 'user = "%s:%s"\n' "$FTP_USER" "$esc" | curl --ssl-reqd -sS --fail -K - "$@"; }
basis="ftp://$FTP_HOST/$FTP_DIR"

stand() { ftp -I "$basis/$1" | grep -i -E "content-length|last-modified" || true; }

case "$ziel" in
    kiosk)
        datei=kiosk.html
        quelle=kiosk-show.html
        [ $build = 1 ] && (cd "$VIELBUNT_MOTION" && npm run --silent kiosk)
        ;;
    queerbar)
        datei=queerbar-kiosk.html
        quelle="$QUEERBAR_KIOSK/dist/queerbar-kiosk.html"
        [ $build = 1 ] && (cd "$QUEERBAR_KIOSK" && python3 build.py)
        ;;
    probe)
        for d in kiosk.html queerbar-kiosk.html; do echo "== $d"; stand "$d"; done
        exit 0
        ;;
    *)
        sed -n '2,9p' "$0"; exit 1
        ;;
esac

# Kaputte oder halbe Dateien gar nicht erst hochladen
groesse=$(( $(wc -c < "$quelle") ))
if [ "$groesse" -lt 20000 ] || ! tail -c 200 "$quelle" | grep -q '</html>'; then
    echo "$quelle sieht unvollstaendig aus ($groesse Bytes), Abbruch" >&2
    exit 1
fi

mkdir -p deploy-backups
sicherung="deploy-backups/$datei.$(date +%Y%m%d-%H%M%S)"
ftp -o "$sicherung" "$basis/$datei"
echo "Sicherung: $sicherung ($(( $(wc -c < "$sicherung") )) Bytes)"
# nur die letzten 10 Sicherungen je Datei behalten
ls -1t deploy-backups/"$datei".* | tail -n +11 | xargs rm -f --

# erst unter neuem Namen hochladen, dann umbenennen, damit nie eine halbe Datei live ist
ftp -T "$quelle" "$basis/$datei.neu" -Q "-RNFR $datei.neu" -Q "-RNTO $datei"

live=$(curl -sS --fail "$SITE_URL/$datei?deploy=$(date +%s)" | shasum -a 256 | cut -d' ' -f1)
lokal=$(shasum -a 256 < "$quelle" | cut -d' ' -f1)
if [ "$live" = "$lokal" ]; then
    echo "Live: $SITE_URL/$datei ($groesse Bytes), stimmt mit $quelle ueberein"
else
    echo "Hochgeladen, aber $SITE_URL/$datei liefert noch was anderes (Cache?)" >&2
    exit 2
fi
