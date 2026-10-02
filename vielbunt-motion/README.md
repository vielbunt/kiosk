# vielbunt loop

Motion-Design im Stil von vielbunt.org: Intros, Wartebildschirme, Einspieler vor Videos und
Event-Loops. Alles steckt in einer einzigen Datei, `vielbunt-loop.html`, die offline und per
Doppelklick läuft (Chrome empfohlen). Gezeichnet wird als Vektor in voller Bildschirmauflösung,
Logo und Wortmarke kommen direkt aus dem Original-SVG von vielbunt.org.

## Bedienung

Das Menü ist versteckt und geht mit `M` auf.

| Taste | Funktion |
| --- | --- |
| `M` | Menü |
| `←` `→` | Vorlage wechseln |
| `1` bis `7` | Stil: Weiß, Pink, Rosa, Verlauf, Nacht, Bunt, Transparent |
| `.` `,` | nächste oder vorherige Szene |
| `R` | neu starten |
| `E` | kompletten Durchlauf als Video aufnehmen (MP4 oder WebM) |
| `F` | Vollbild |
| Leertaste | Pause |

Der Mauszeiger verschwindet nach 3 Sekunden ohne Bewegung. Einstellungen merkt sich der
Browser, „Link kopieren“ im Menü gibt einen fertigen Look weiter. Alles geht auch per Adresse,
z. B. `vielbunt-loop.html?template=csd&format=9x16&style=pink`.

## Vorlagen

Showreel (alle Szenen am Stück), Darmstadt, Darmstadt pink, CSD, Pride-Flaggen, Liebe,
Schrill und Laut, Community, Intro kurz, Intro lang, Gleich geht’s los, Laden, Countdown,
Termine-Karussell, Terminliste, Ambient, Statement, Haltung.

## Szenen

- **Darmstadt**: flache Skyline (Waldspirale, darmstadtium, Löwentor, Langer Ludwig, Weißer
  Turm, Hochzeitsturm, Russische Kapelle, Ludwigskirche, Schloss, Staatstheater), Skyline als
  Linienzeichnung und die Punktwand im ESC-Stil mit leichtem 3D
- **Logo**: Logo-Aufbau, Logo-Zoom, Laden
- **Text**: Headline, Statement, Motto laut, Laufschrift, Sprechblasen, Haltung (Parolen)
- **Queer**: Pride-Flaggen (Progress inter*-inklusiv, Trans*, Bi*, Lesbisch, Nicht-binär, Pan,
  Ace, Inter*, Regenbogen), Progress-Flagge baut sich auf, Pride-Streifen, Herzen, Pinke Wellen
- **Community**: Kacheln mit Icons, Gruppen-Wolke, Equalizer, Bogen-Muster, Bogen-Konfetti
- **Termine**: Termine-Karussell (nächste Veranstaltungen einzeln), Terminliste (alle auf einen
  Blick, quer zweispaltig), Countdown

**Termine sind live**: Sie kommen aus dem vielbunt-Kalender, über dieselbe Quelle und Logik wie
`vielbunt.org/kiosk.html` (Serientermine, interne Arbeitstreffen blasser). Aktualisierung alle
30 Minuten, ohne Internet wird die eigene Liste aus dem Menü gezeigt.

Formate: Bildschirm füllen, 16:9, 9:16, 1:1, 4:5, 4K. Übergänge: Logo-Balken, Farbstreifen,
Diagonal, Kreise, Herz oder abwechselnd. Alle Texte lassen sich im Menü ändern.

## Bearbeiten

```
npm install
npm run build
```

- `src/loop.js`: Szenen, Vorlagen, Stile, Menü
- `src/sky-shapes.js`: die Darmstädter Silhouetten
- `src/dotwall.js`: die Punktwand
- `src/events.js`: Termine aus dem Kalender
- `src/loop.html`, `src/style.css`, `src/fonts/`, `src/logo.svg`: Seite, Menü-Look, Cera Pro, Logo

## Kiosk Show

`npm run kiosk` erzeugt aus dem aktuellen `kiosk.html` eine Ebene hoeher (Kiosk-Repo) die separate
`kiosk-show.html` im selben Ordner (anderer Pfad per `KIOSK_DIR=...`). Das Original bleibt
unangetastet, die Modi socialmedia, poster, events, compact, mitmachen und disco laufen in der
Show-Version exakt wie im Original.

Nur die normale Slideshow ändert sich: Jeder Slide steht 20 Sekunden, danach kommt eine
Animation aus dem Showreel (gemischte Reihenfolge, wechselnde Stile), jedes dritte Mal
stattdessen die Terminübersicht. vielbunt-loop steckt eingebettet in der Datei, hochgeladen
werden muss also nur `kiosk-show.html`.

URL-Parameter: `dauer=20` (Sekunden je Slide), `uebersicht=30` (Sekunden Terminübersicht),
`stil=pink,nacht,verlauf,pink,hell` (Loop-Stile der Reihe nach). Pfeiltasten springen weiter
oder zurück.

Die Show startet direkt mit einer Animation (Standard: Punktwand in Pink, per `intro=` wählbar),
während im Hintergrund Beiträge, Termine und Bilder laden.

Wenn sich `kiosk.html` ändert, einfach `npm run kiosk` erneut ausführen.

## Leistung

Der Loop passt seine Auflösung selbst an: Nur wenn Bilder spürbar zu spät kommen, rechnet er mit
weniger Pixeln (bis 50 %), und sobald es wieder flüssig läuft, geht er zurück auf volle Auflösung.
Die Bildwiederholrate des Bildschirms wird dabei mitgemessen, ein 4K-Fernseher mit 30 Hz wird also
nicht fälschlich heruntergeschaltet. Auf schneller Hardware ändert sich nichts.

## Kiosk

`npm run kiosk` baut aus `kiosk.html` im Kiosk-Repo (eine Ebene hoeher, anderer Pfad per `KIOSK_DIR`)
die Show-Fassung `kiosk-show.html` mit eingebettetem Loop. Die leichte Variante für den Pi im Barraum
(`kiosk-lite/`, Animationen als vorgerenderte Videos aus diesem Loop) liegt ebenfalls im Kiosk-Repo.

## Schriften

Cera Pro ist lizenziert und deshalb nicht im (oeffentlichen) Repo. Vor dem ersten Bauen
`Cera-Pro-Regular.woff2` und `Cera-Pro-Bold.woff2` aus `~/Downloads/Cera/Cera Pro/Webfonts/` nach
`src/fonts/` kopieren. Die gebaute `vielbunt-loop.html` bettet die Schrift ein und bleibt darum ebenfalls lokal.
