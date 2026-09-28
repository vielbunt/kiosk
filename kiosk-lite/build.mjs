// Baut kiosk-lite.html aus kiosk-lite.src.html und haengt rrule direkt ein (kein CDN, laeuft auch offline).
// Aufruf (aus dem Kiosk-Repo): node kiosk-lite/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'kiosk-lite.src.html'), 'utf8');
if (!src.includes('<!--RRULE-->')) throw new Error('Platzhalter <!--RRULE--> fehlt in kiosk-lite.src.html');
// gleiche rrule-Version wie im grossen Kiosk, damit Serientermine genauso gerechnet werden
const rrule = readFileSync(join(HERE, 'rrule-2.7.2.min.js'), 'utf8').trim();
const out = src.replace('<!--RRULE-->', () => `<script>/* rrule 2.7.2 */\n${rrule}\n</script>`);
writeFileSync(join(HERE, 'kiosk-lite.html'), out);
console.log(`kiosk-lite.html gebaut (${Math.round(out.length / 1024)} KB)`);
