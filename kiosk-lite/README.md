# kiosk-lite

Leichte Variante des vielbunt-Kiosks für den Pi Zero 2 W im Barraum (`Raspi-Zero-Barraum-Kiosk`,
192.168.10.60). Das große `vielbunt.org/kiosk.html` rendert die Animationen live und ist dafür viel
zu schwer: beide Kerne voll ausgelastet, alles ruckelt. Hier gibt es deshalb keine Live-Animationen,
sondern vorgerenderte Videos, die der Pi flüssig abspielt (rund 2 % verworfene Bilder).

## Was die Seite macht

- zwei Sharepics (je 20 s), dann die Terminübersicht (30 s), danach ein Clip, reihum
- gleiche Quellen wie der große Kiosk: Posts von vielbunt.org, Termine über den Worker
- Termine nur für die nächsten 90 Tage durchrechnen, Bilder in der 819er-Größe laden
- immer nur ein Slide im DOM, keine Übergänge, kein Mauszeiger, keine Übersetzungsleiste,
  kein Cast-Symbol auf den Videos
- lädt alle 30 Minuten still neu; ohne Netz bleiben die letzten Daten stehen

URL-Parameter: `dauer` und `uebersicht` (Sekunden), `events_only`, `clips=a.mp4,b.mp4`.

## Dateien

| Datei | Zweck |
| --- | --- |
| `kiosk-lite.src.html` | Quelle, hier wird bearbeitet |
| `kiosk-lite.html` | gebaute Seite mit eingebettetem rrule, die kommt auf den Pi |
| `kiosk-config.js` | Liste der Clips, liegt neben der Seite auf dem Pi |
| `clips/` | 20 vorgerenderte Szenen, 1280×800, 30 fps, H.264 |
| `build.mjs` | baut `kiosk-lite.html` aus der Quelle und `rrule-2.7.2.min.js` |
| `render-clips.mjs` | rendert die Clips aus `vielbunt-loop.html` (Projekt vielbunt-motion) |
| `check-clips.swift` | Kontaktbogen aller Clips zum Durchsehen |

Die Szene „Termin“ fehlt mit Absicht: Sie zeigt Live-Termine, als Video wären die sofort veraltet.
Die Terminübersicht übernimmt das.

## Bearbeiten und neu bauen

Aus dem Kiosk-Repo, gebraucht werden nur Node und Google Chrome:

```
node kiosk-lite/build.mjs                                     # kiosk-lite.html bauen
node kiosk-lite/render-clips.mjs                              # alle Clips neu rendern (Echtzeit, ca. 4 Minuten)
node kiosk-lite/render-clips.mjs skyline:nacht herzen:pink    # nur einzelne Szenen
```

Die Animationen kommen aus `vielbunt-loop.html` im Projekt vielbunt-motion, standardmäßig unter
`../vielbunt-motion/` hier im Repo, sonst per `VB_LOOP=/pfad/zu/vielbunt-loop.html`. Wer den Loop ändert,
rendert danach die Clips neu. Chrome nimmt sie selbst auf (MediaRecorder), ffmpeg wird nicht gebraucht.
Neue oder umbenannte Clips auch in `kiosk-config.js` eintragen. Durchsehen:

```
swift kiosk-lite/check-clips.swift /tmp/clips.png kiosk-lite/clips/*.mp4
```

## Auf den Pi bringen

```
scp kiosk-lite/kiosk-lite.html kiosk-lite/kiosk-config.js kiosk-admin@192.168.10.60:~/
rsync -a --delete kiosk-lite/clips/ kiosk-admin@192.168.10.60:~/clips/
ssh kiosk-admin@192.168.10.60 'pkill -u kiosk-admin -x cage'
```

Der letzte Befehl beendet nur den Browser, systemd startet ihn nach ein paar Sekunden neu. Dafür
braucht es kein Passwort. Den Autostart selbst (`/etc/systemd/system/kiosk.service`) ändern geht nur
mit `sudo`. Die aktuelle Fassung liegt in `../pi/kiosk.service`, eine Sicherung der alten auf dem Pi
unter `~/kiosk.service.bak-2026-09-27`.

Mauszeiger: Die Seite blendet ihn per CSS aus, `cage` malt aber vor dem Laden trotzdem seinen eigenen
Pfeil. Dagegen liegt auf dem Pi unter `~/.icons/default` ein unsichtbares Zeiger-Theme (ein
transparenter Pixel, alle Zeigernamen verlinkt). Das wird vor dem System-Theme gefunden, ganz ohne `sudo`.
Anlegen mit `../pi/unsichtbarer-mauszeiger.py`.
