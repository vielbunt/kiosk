# Kalender-Worker

`shy-recipe-d443.me-02a.workers.dev` (Cloudflare-Konto me@janbamba.ch) holt den vielbunt-Google-Kalender,
filtert ihn und liefert ihn mit CORS aus. Alle Terminanzeigen hängen daran: `kiosk.html`, `kiosk-show.html`,
`kiosk-lite`, `vielbunt-motion` (Loop) und `kalender.py` im Postergenerator.

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
