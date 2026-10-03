# Barraum-Kiosk

Bildschirm im Barraum des queeren Zentrums (`Raspi-Zero-Barraum-Kiosk`, Pi Zero 2 W, 192.168.10.60, Benutzer
`kiosk-admin`). Der Pi hat weder Maus noch Tastatur und läuft rund um die Uhr. Intern heißt das "Minimum-Kiosk":
Alles, was sich nicht ändert, ist vorgerendert, der Rest sind schlichte Seiten ohne Animationen.
Nachfolger von `kiosk-lite`.

## Die drei Modi

Der Modus steht im Google Sheet [Barraum-Kiosk](https://docs.google.com/spreadsheets/d/152xB92pnSdWQGcb8QO9tB1J0yOjslCxOAsFX6Ap9d1k/edit),
Tab **Einstellungen**, Zeile **Modus**. Der Pi fragt diese eine kleine Tabelle jede Minute ab und wechselt
von selbst, ohne Neustart. **Standard ist `standard`.**

| Modus | Seite | Inhalt |
| --- | --- | --- |
| `standard` | `standard.html` | Offener Treff: Sharepics, Terminübersicht, vorgerenderte Clips. Optional die Getränkekarte mit Treffpreisen (Einstellung "Getränkekarte Standard", aus). Keine Verweise auf Alkohol, Queerbar-Beiträge bleiben draußen. |
| `queerbar` | `queerbar.html` | Queerbar-Abend: Slides aus dem Tab "Queerbar Slides". Claim und Motion sind vorgerendert, Karte, Acts, Info und Bild stehen als ruhiges Bild. |
| `7-jahre-queerbar` | `7-jahre-queerbar.html` | Sonderkiosk fürs Queerbar-Jubiläum: die ganze Queerbar-Show (alle aktiven Slides mit Animationen, Übergängen und Laufband) ist ein einziges vorgerendertes Video in Schleife. Nur Preise und Ausverkauft kommen live aus dem Sheet als Overlay. Der Modus `queerbar` bleibt daneben unverändert bestehen. |
| `event` | `event.html` | "Herzlich willkommen zur Veranstaltung ...", Sharepics des Tages, Termine, ruhige Clips, optional Getränkekarte mit Eventpreisen. Ablauf im Tab "Event-Ablauf". |

Tabs im Sheet: Einstellungen, Event, Event-Ablauf, Getränkekarte (Barraum) und Queerbar Slides / Getränke / Songs
(die lesen auch der Queerbar-Kiosk auf dem Surface, `../queerbar-kiosk`). Erklärungen stehen im Tab Anleitung.

### Event-Modus im Detail

- Automatik: Der Kiosk sucht in den WordPress-Beiträgen (Kategorie Veranstaltung) das Event von heute. Der offene
  Jugendtreff (Kategorie Jugend (villaQ), "Wochenprogramm") zählt nicht als Event. Gibt es heute keins, begrüßt er
  allgemein und nennt das nächste Event.
- Überschreiben im Tab **Event**: Veranstaltung, Untertitel, Begrüßung, Sharepics (URLs oder Drive-Links mit `|`),
  Datum, Suchwort, Automatik aus, Preise (Event oder Treff).
- Tab **Event-Ablauf**: eine Zeile je Slide (Willkommen, Sharepics, Termine, Karte, Clip, Info, Bild) mit Dauer,
  Zeigen ab/bis. Zeilen verschieben oder abhaken genügt. Ist der Tab leer, läuft ein Standardablauf.

### Getränkekarte

Tab **Getränkekarte**: Name, Zusatz, Alkohol, Preis Treff (Jugendtreff, 1 €), Preis Event (alles andere, 2 €).
Die Karte ist an der Tafel im Barraum orientiert. Im Standard-Modus erscheinen nur alkoholfreie Getränke mit
Treffpreis, im Event-Modus alle (auch "Bier & Sekt", ohne Preis) mit Eventpreis.

## Wie die Seiten aufgebaut sind

```
src/sheet.js      Sheet lesen (CSV, Tabs), Clip-Schlüssel. Läuft im Browser und in Node.
src/lib.js        Gemeinsame Bausteine: Daten laden, Modus-Weiche, Karte, Player
src/base.css      Styles (Cera Pro aus fonts/)
src/start.html    Weiche: liest den Modus, springt auf die passende Seite
src/standard.html, queerbar.html, event.html    die drei Modi
build.mjs         src/ -> dist/, minifiziert (esbuild), jede Seite eine einzelne Datei
render/           Clips rendern (siehe unten)
deploy.sh         bauen und auf den Pi bringen
serve.mjs         lokaler Testserver
```

Der Pi zeigt immer nur ein Slide, ohne Übergänge. Frisch bleiben die Seiten von selbst:

- Modus und Einstellungen: jede Minute (eine Tabelle, wenige hundert Bytes)
- Posts und Termine: alle 30 Minuten, dazu einmal bei Tageswechsel
- Karte, Event, Ablauf, Queerbar-Tabs: alle 5 Minuten
- Seite komplett neu laden: nach 6 Stunden an einer Slide-Grenze. Zusätzlich startet ein Cronjob den Browser täglich um 11:30 neu.
- Ohne Netz laufen die zuletzt geladenen Daten weiter.

## Bauen, testen, auf den Pi bringen

Gebraucht: Node, Google Chrome (nur zum Rendern), ffmpeg mit libx264 (nur zum Rendern), im Netz des Pi sein.

```
cd barraum && npm install          # einmal (esbuild)
node build.mjs                     # src/ -> dist/ (minifiziert)
node serve.mjs                     # Test: http://localhost:8795/start.html
                                   #   ?modus=standard|queerbar|event hält eine Seite fest
./deploy.sh                        # bauen, Seiten + Clips auf den Pi, Browser neu starten
./deploy.sh --ohne-clips           # nur die Seiten (schnell)
./deploy.sh --rendern              # vorher fehlende Queerbar-Clips rendern
```

Der Modus-Wechsel braucht kein Deploy, der kommt aus dem Sheet. Deployen muss man nur bei Code-Änderungen
und neuen Clips.

## Clips

Eine Videodatei spielt der Pi Zero flüssig, Animationen live nicht. Deshalb gibt es zwei Sorten:

**vielbunt-Clips** (`clips/`, 20 Szenen aus `vielbunt-loop`, 1280×800, 30 fps, H.264) für Standard und Event.
Die Szene "Termin" fehlt mit Absicht. Neu rendern:

```
node render/vielbunt-clips.mjs                              # alle (ca. 4 Minuten, Echtzeit)
node render/vielbunt-clips.mjs skyline:nacht herzen:pink    # einzelne
swift render/check-clips.swift /tmp/clips.png clips/*.mp4   # Kontaktbogen
```

Die Animationen kommen aus `vielbunt-loop.html` in `../vielbunt-motion/` (oder `VB_LOOP=...`).

**Queerbar-Clips** (`clips-queerbar/`, nicht im Repo, weil Fotos von Menschen und die lizenzierte Schrift drin sind):
Jeder Claim- und Motion-Slide aus dem Sheet wird als Clip gerendert.

```
node render/queerbar-clips.mjs          # nur fehlende
node render/queerbar-clips.mjs --alle   # alles neu
node render/queerbar-clips.mjs --liste  # nur anzeigen
```

Der Dateiname ist ein Schlüssel aus allem, was im Video zu sehen ist (Zeilen, Bild, Dauer, Songliste,
Laufband). Ändert sich im Sheet etwas daran, passt der Schlüssel nicht mehr, und der Pi zeigt den Slide bis
zum nächsten Rendern als stehendes Bild (Text und Foto, ohne Bewegung). Nach Änderungen an Claim/Motion also
`./deploy.sh --rendern` ausführen. Aufgenommen wird der echte Queerbar-Kiosk in Chrome (Screencast),
ffmpeg macht H.264 daraus. Ändert sich das Aussehen des Queerbar-Kiosks, `CLIP_VERSION` in `src/sheet.js` hochzählen.

## 7-jahre-queerbar (Show-Video)

```
node render/show.mjs                    # Slides, wie sie heute im Sheet aktiv sind
node render/show.mjs --tag=09.10.2026   # Slides, wie sie an diesem Barabend aktiv wären
./deploy.sh --show                      # vorher neu rendern, dann hochladen (SHOW_TAG=09.10.2026 setzt den Tag)
```

Der echte Queerbar-Kiosk spielt in Chrome mit `show` und `noprice` durch, das Skript nimmt per Screencast zwei volle
Durchläufe auf und schneidet einen heraus (Beginn des Übergangs in den ersten Slide bis zum nächsten Beginn), damit
die Schleife nahtlos läuft. Rendern dauert rund 3 Minuten. Ergebnis in `clips-7jahre/` (nicht im Repo): `show.mp4`
und `show.js` mit Zeitleiste und der gemessenen Lage der Preise.

- Im Video stecken Texte, Fotos, Hervorhebungen (Highlight), Kategorien, Laufband, Übergänge. Ändert sich eins davon
  im Sheet (Tab Queerbar Slides, Songs, Kategorien, neue Getränke), muss neu gerendert werden.
- Live aus dem Tab Queerbar Getränke (jede Minute): Preis, Ausverkauft (Zeile abgedunkelt, durchgestrichen, "aus")
  und Aktiv (Zeile wird abgedeckt). Typ Special wird nicht live gelegt (Preise sind dort im Video).
- Kodiert wird als H.264 Baseline ohne B-Bilder (`-tune fastdecode`): der Pi dekodiert in Software, auf dem Pi
  rund 2 % verworfene Bilder. Ein High-Profile-Video lief deutlich schlechter.

## Auf dem Pi

Ordner `~/barraum/` mit `start.html`, `standard.html`, `queerbar.html`, `event.html`, `fonts/`, `assets/` und
`clips/` (`manifest.js`, `vielbunt/`, `queerbar/`). Autostart: `kiosk.service` (Kopie in `../pi/`).

Der Service zeigte bisher auf `~/kiosk-lite.html`. `deploy.sh` legt dort eine Weiterleitung auf
`barraum/start.html` ab, damit es ohne `sudo` funktioniert. Sauber ist, den Service umzustellen (braucht das Passwort):

```
scp pi/kiosk.service kiosk-admin@192.168.10.60:~/kiosk.service.new
ssh -t kiosk-admin@192.168.10.60 'sudo cp ~/kiosk.service.new /etc/systemd/system/kiosk.service && sudo systemctl daemon-reload && sudo systemctl restart kiosk'
```

Der Browser lässt sich ohne `sudo` neu starten: `ssh kiosk-admin@192.168.10.60 'pkill -u kiosk-admin -x cage'`.
Mauszeiger: `../pi/unsichtbarer-mauszeiger.py` (einmal auf dem Pi, ist schon erledigt).

## Von außerhalb deployen (Tailscale)

Auf dem Pi läuft Tailscale (Rechnername `barraum-pi`, 100.70.7.126, Tailscale SSH an), auf dem Mac ebenfalls.
`deploy.sh` nimmt im Netz des queeren Zentrums die lokale Adresse und sonst automatisch `kiosk-admin@barraum-pi`.
Das geht also von überall, auch per Handy-Hotspot, solange der Pi Internet hat und Tailscale am Mac läuft.
Einmal pro Mac nötig: `ssh -o StrictHostKeyChecking=accept-new kiosk-admin@barraum-pi true`.
Tailscale belegt auf dem Pi etwa 30 MB RAM. Ausschalten: `sudo tailscale down`.

## Aus dem Quellcode

Cera Pro (Schriften) und die Queerbar-Fotos sind nicht im Repo. Gebraucht: `barraum/fonts/Cera-Pro-Bold.woff2` und
`Cera-Pro-Black.woff2` (aus `~/Downloads/Cera/Cera Pro/Webfonts/`) und die Bilder in `../queerbar-kiosk/assets/`.
Ohne sie baut `build.mjs` mit einer Warnung, die Seiten fallen dann auf eine Standardschrift zurück.
