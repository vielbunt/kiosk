# vielbunt Kiosk

Bildschirm-Slideshow von vielbunt: Sharepics aus den Posts auf vielbunt.org und die nächsten Termine
aus dem vielbunt-Kalender. Dazu die Skripte für die wöchentliche Terminübersicht auf Social Media und
das Plakat zum Ausdrucken.

## Die drei Kiosk-Fassungen

| Datei | Wofür | Animationen |
| --- | --- | --- |
| `kiosk.html` | Grundfassung, auch Quelle für Social-Media-Bild und Plakat | keine |
| `kiosk-show.html` | der neue Kiosk, live unter vielbunt.org/kiosk.html | live gerendert aus vielbunt-loop |
| `barraum/` | Pi Zero im Barraum, drei Modi (standard, queerbar, event) per Google Sheet | vorgerenderte Videos |

Alle drei holen dieselben Daten: Posts über die WordPress-API von vielbunt.org, Termine über den
Cloudflare-Worker `shy-recipe-d443.me-02a.workers.dev` (liefert den vielbunt-Kalender als ICS mit CORS).

### kiosk.html

URL-Parameter:

- `mode=events` oder `events_only`: nur die Terminübersicht
- `mode=compact` oder `compact_mode`: Terminliste, so viele wie auf den Bildschirm passen
- `mode=mitmachen`: zusätzlich ein Mitmachen-Slide
- `mode=socialmedia`: ein festes 4:5-Bild mit den Terminen der Woche, dazu `poster=true` (ab nächstem
  Montag) und `legend=false`
- `disco`, `no_animation`

### kiosk-show.html

Wird nicht von Hand bearbeitet, sondern im Unterordner `vielbunt-motion/`
mit `npm run kiosk` aus `kiosk.html` und `vielbunt-loop.html` gebaut und hier abgelegt. Zwischen den
Slides laufen Animationen aus dem Loop, jedes dritte Mal kommt stattdessen die Terminübersicht. Alle
Modi von `kiosk.html` funktionieren weiter. Zusätzliche Parameter: `dauer` (Sekunden je Slide, 20),
`uebersicht` (Sekunden, 30), `stil` (z. B. `stil=pink,nacht`), `intro`.

Braucht einen halbwegs flotten Rechner. Auf einem Pi Zero ruckelt es, dafür gibt es den Barraum-Kiosk (`barraum/`).

### barraum

Die gleichen Inhalte ohne Live-Animationen, dazu Queerbar- und Event-Modus, umschaltbar im Google Sheet.
Alles Wichtige steht in [`barraum/README.md`](barraum/README.md).

## Pi im Barraum

`Raspi-Zero-Barraum-Kiosk` (Pi Zero 2 W, 192.168.10.60 im Netz des queeren Zentrums, Benutzer `kiosk-admin`)
zeigt den Barraum-Kiosk. Bauen, Rendern und Deployen: [`barraum/README.md`](barraum/README.md) (`barraum/deploy.sh`).
Im Ordner [`pi/`](pi/) liegt, was auf dem Pi außerhalb der Seite eingerichtet ist:

- `kiosk.service`: Autostart unter `/etc/systemd/system/`, startet Chromium im Vollbild in `cage`
  mit `file:///home/kiosk-admin/barraum/start.html`. Ändern nur mit `sudo`, danach
  `sudo systemctl daemon-reload && sudo systemctl restart kiosk`.
- `unsichtbarer-mauszeiger.py`: legt ein leeres Zeiger-Theme in `~/.icons/default` an, sonst malt
  `cage` einen Pfeil ins Bild. Einmal auf dem Pi als `kiosk-admin` ausführen.
- Zusätzlich startet ein Cronjob von `kiosk-admin` den Kiosk jeden Tag um 11:30 neu:
  `30 11 * * * sudo systemctl restart kiosk.service`

## Social Media und Plakat

| Datei | Zweck |
| --- | --- |
| `weekly_social.py` | Sonntagsroutine: Bild und Plakat erzeugen, Plakat-PDF nach Google Drive, Bild auf Facebook und Instagram posten. `--nur-poster` postet nichts |
| `screenshot_socialmedia.py` | `kiosk.html?mode=socialmedia` als `socialmedia.png` (1080×1350) |
| `screenshot_poster.py` | Plakatfassung als `poster.png` (5400×6750, für A2) |
| `poster_druck.py` | macht aus `poster.png` ein Druck-PDF aus zwei A3-Seiten, die Naht liegt nie in einem Termin |
| `instagram_planer.py` | postet die vom Scheduler (postergenerator-Repo) eingeplanten Beiträge zur gleichen Zeit wie Facebook auf Instagram, liest dafür den Tab "Automatik" des Redaktionsplans |
| `browser_start.py` | startet Chromium für die Screenshots; in der Cloud holt Python die Daten der Seite (Proxy) |
| `cloud/zeitfenster.py` | lässt eine Cloud-Routine nur zur richtigen Darmstädter Uhrzeit weiterlaufen (Sommer/Winter) |
| `meta_config_template.py` | Vorlage für `meta_config.py` mit den Meta-Zugangsdaten (die echte Datei ist in `.gitignore`) |

Erzeugte Bilder, PDFs und `poster_layout.json` sind ebenfalls in `.gitignore`.

## Auf vielbunt.org hochladen

`./deploy.sh kiosk` baut `kiosk-show.html` neu und lädt sie als `vielbunt.org/kiosk.html` hoch,
`./deploy.sh queerbar` macht das Gleiche mit dem Queerbar-Kiosk (Unterordner `queerbar-kiosk/`).
`./deploy.sh probe` zeigt nur den Stand auf dem Server. Vorher wird die alte Datei nach `deploy-backups/`
gesichert, danach prüft das Skript, ob die Seite wirklich die neue Datei ausliefert.

Server und Benutzer stehen in `deploy.env` (nicht im Repo, Vorlage `deploy.env.example`), das Passwort
nur im macOS-Schlüsselbund. Wie man es anlegt, steht oben in `deploy.sh`.

## Lokal ansehen

```
python3 -m http.server 7654
```

Dann http://localhost:7654/kiosk.html, `/kiosk-show.html` oder `/barraum/dist/standard.html?modus=standard` (nach dem Bauen) öffnen.

## Cloud

`weekly_social.py` und `instagram_planer.py` laufen als Claude-Cloud-Routinen ("vielbunt weekly social",
"vielbunt Instagram"). Zugangsdaten kommen dort aus Umgebungsvariablen (`META_ACCESS_TOKEN`,
`FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCOUNT_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`), lokal aus `meta_config.py` und
dem postergenerator-Repo. `python3 weekly_social.py --probe` prüft alles, ohne etwas zu veröffentlichen.
Übersicht aller Routinen: `cloud/routinen.md` im postergenerator-Repo.
