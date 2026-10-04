# Kalender-Worker

`shy-recipe-d443.me-02a.workers.dev` (Cloudflare-Konto me@janbamba.ch) holt den vielbunt-Google-Kalender,
filtert ihn und liefert ihn mit CORS aus. Alle Terminanzeigen hängen daran: `kiosk.html`, `kiosk-show.html`,
`barraum`, `vielbunt-motion` (Loop) und `kalender.py` im Postergenerator.

Die Regeln stehen nur hier, in `filter.js`:

- **raus**: Titel mit Auf-/Abbau, intern, Blocker, Vormerkung, Klausur, Kasse, Abrechnung, Inventur, abgesagt,
  außerdem private/vertrauliche (`CLASS`) und abgesagte (`STATUS:CANCELLED`) Termine. Fällt eine Ausnahme einer
  Serie weg, kommt sie als `EXDATE` in die Serie, sonst tauchte der ursprüngliche Serientermin wieder auf.
- **grau**: AG, AK, UAG, U-AK, AKÖ, JAK, JV, HA (nur als eigenes Wort), Vorstandssitzung, Jugendvorstand,
  Mitgliederversammlung, Renovierung, Runder Tisch. Der Worker hängt `X-VIELBUNT-INTERN:TRUE` an,
  die Anzeigen lesen nur diese Markierung.

Die geheime Kalenderadresse steht nicht im Repo, sondern als Secret `ICS_URL` im Worker.
Nach einem Zurücksetzen der geheimen Adresse in Google Kalender:

    cd worker && npx wrangler secret put ICS_URL

Ändern und ausrollen:

    cd worker && npx wrangler dev        # lokal, braucht worker/.dev.vars mit ICS_URL=... (gitignored)
    cd worker && npx wrangler deploy

Cache 30 Minuten, `?nocache` holt sofort neu. Ein ungecachter Aufruf braucht bei Cloudflare rund 60 ms CPU
(gemessen 02.10.2026 per `wrangler tail`), der Filter selbst lokal 5 ms warm, 11 bis 19 ms kalt.

## Sheet-Tabs für den Barraum-Kiosk

`/sheet/<gid>` liefert einen Tab des Google Sheets Barraum-Kiosk als CSV mit CORS (nur Tabs 0 bis 7, Cache 15 Sekunden).
Grund: Googles Export antwortet Seiten von `file://` (Pi im Barraum) ohne CORS-Header, `fetch` scheitert dort.

## Google-Slides-Präsentation für den Barraum-Pi

`/slides/<präsentations-id>` liefert die Folien einer Google-Slides-Präsentation als JSON (`{title, slides: [{w, h, url}]}`),
in der Reihenfolge der Präsentation. Die Bildadresse nimmt `w` und `h` (bis mindestens 1920×1080). Die Präsentation
muss für "Jeder mit dem Link" lesbar sein. Cache 60 Sekunden. Gelesen wird die Präsentationsansicht
(`/htmlpresent`), deren Aufbau Google jederzeit ändern kann: Dann liefert der Worker "Keine Folien gefunden".
