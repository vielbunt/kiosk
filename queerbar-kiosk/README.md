# Queerbar-Kiosk

Bildschirm für die Queer Bar im Look des Queerbar-Motion-Designs. Alle Inhalte (Slides, Getränke,
Preise, Songs, Laufband) kommen live aus dem Google Sheet
[Queerbar-Kiosk](https://docs.google.com/spreadsheets/d/152xB92pnSdWQGcb8QO9tB1J0yOjslCxOAsFX6Ap9d1k/edit).
Wie das Sheet funktioniert, steht dort im Tab Anleitung.

## Dateien

| Datei | Wofür |
| --- | --- |
| `queerbar-kiosk.src.html` | Quelle, hier wird gearbeitet. Läuft lokal mit Bildern aus `assets/` und Schriften aus `fonts/` |
| `build.py` | baut `dist/queerbar-kiosk.html`: eine einzige Datei mit Schriften, Bildern und dem aktuellen Sheet-Stand als Rückfallebene |
| `dist/queerbar-kiosk.html` | kommt auf vielbunt.org als `/queerbar-kiosk.html` |

Neue eingebaute Bilder: Datei nach `assets/` legen, in `ASSETS` in der Quelle eintragen, neu bauen.
Für einzelne Bilder reicht aber auch eine URL oder ein Drive-Link in der Spalte Bild im Sheet.

## Lokal ansehen

    python3 -m http.server 8793

Dann http://localhost:8793/queerbar-kiosk.src.html öffnen.

URL-Parameter zum Testen: `start=3` (mit Slide 3 anfangen), `dauer=600` (jede Slide 600 s),
`nur=karte` (nur ein Typ), `sheet=<ID>` (anderes Sheet).

## Am Bildschirm

Pfeiltasten blättern, Leertaste pausiert, F Vollbild, R lädt das Sheet sofort neu.
Die Seite holt das Sheet jede Minute (Tab Einstellungen), hält den Bildschirm wach und lädt sich alle
sechs Stunden einmal komplett neu. Ohne Netz läuft der letzte Stand weiter.

## Schriften und Bilder

Cera Pro ist lizenziert, auf den eingebauten Bildern sind Menschen zu sehen. Beides liegt deshalb nur
lokal und nicht im (oeffentlichen) Repo: `fonts/` braucht `Cera-Pro-Black.woff2` und `Cera-Pro-Bold.woff2`
aus `~/Downloads/Cera/Cera Pro/Webfonts/`, `assets/` die Bilder aus `ASSETS` in der Quelle. `dist/` wird
ebenfalls nicht eingecheckt, weil dort beides eingebettet ist.
