// Kalender-Worker shy-recipe-d443.me-02a.workers.dev: holt den vielbunt-Kalender von Google, filtert ihn
// (filter.js) und liefert ihn mit CORS aus. Benutzt von kiosk.html, kiosk-lite, vielbunt-loop und dem Postergenerator.
//
// Die geheime ICS-Adresse steht NICHT hier (das Repo ist oeffentlich), sondern als Secret ICS_URL im Worker:
//   npx wrangler secret put ICS_URL      (im Ordner worker/, Adresse aus Google Kalender > Einstellungen > Geheime Adresse)
import { filtereKalender } from './filter.js';

const CACHE_SEKUNDEN = 1800;
// eigener Schluessel statt der Google-Adresse, damit nie ungefilterte Altbestaende aus dem Cache kommen
const CACHE_KEY = 'https://kalender.vielbunt.cache/gefiltert-v1.ics';

export default {
  async fetch(request, env, ctx) {
    const nocache = new URL(request.url).searchParams.has('nocache');
    const cache = caches.default;
    const key = new Request(CACHE_KEY, { method: 'GET' });

    if (!nocache) {
      const cached = await cache.match(key);
      if (cached) return mitCors(cached);
    }

    if (!env.ICS_URL) return fehler('ICS_URL fehlt (wrangler secret put ICS_URL)');
    const upstream = await fetch(env.ICS_URL);
    const roh = upstream.ok ? await upstream.text() : '';
    // kaputte Antworten von Google nicht cachen, sonst haengen alle Anzeigen eine halbe Stunde lang daran
    if (!roh.includes('BEGIN:VCALENDAR')) return fehler(`Google antwortet ${upstream.status}`);

    const response = new Response(filtereKalender(roh), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_SEKUNDEN}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  },
};

function mitCors(r) {
  const res = new Response(r.body, r);
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

function fehler(text) {
  return new Response(text, { status: 502, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}
