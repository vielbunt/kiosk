// Kalender-Worker shy-recipe-d443.me-02a.workers.dev: holt den vielbunt-Kalender von Google, filtert ihn
// (filter.js) und liefert ihn mit CORS aus. Benutzt von kiosk.html, kiosk-lite, vielbunt-loop und dem Postergenerator.
//
// Die geheime ICS-Adresse steht NICHT hier (das Repo ist oeffentlich), sondern als Secret ICS_URL im Worker:
//   npx wrangler secret put ICS_URL      (im Ordner worker/, Adresse aus Google Kalender > Einstellungen > Geheime Adresse)
import { filtereKalender } from './filter.js';

const CACHE_SEKUNDEN = 1800;
// eigener Schluessel statt der Google-Adresse, damit nie ungefilterte Altbestaende aus dem Cache kommen
const CACHE_KEY = 'https://kalender.vielbunt.cache/gefiltert-v1.ics';

// Google-Sheet "Barraum-Kiosk": Tabs als CSV mit CORS. Der Export von Google antwortet auf Seiten, die von
// file:// laufen (Pi im Barraum), ohne CORS-Header, deshalb geht der Barraum-Kiosk ueber diesen Weg.
// Nur dieses eine Sheet und nur die Tabs 0 bis 7 (das Sheet ist ohnehin fuer alle mit Link lesbar).
const SHEET_ID = '152xB92pnSdWQGcb8QO9tB1J0yOjslCxOAsFX6Ap9d1k';
const SHEET_GIDS = new Set(['0', '1', '2', '3', '4', '5', '6', '7']);
const SHEET_CACHE_SEKUNDEN = 15;

async function sheetTab(gid) {
  if (!SHEET_GIDS.has(gid)) return fehler('Tab nicht freigegeben');
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const upstream = await fetch(url, { cf: { cacheTtl: SHEET_CACHE_SEKUNDEN, cacheEverything: true } });
  const text = upstream.ok ? await upstream.text() : '';
  if (!text || /^\s*</.test(text)) return fehler(`Google antwortet ${upstream.status}`);
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': `public, max-age=${SHEET_CACHE_SEKUNDEN}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Google-Slides-Praesentation (Modus praesentation am Barraum-Pi): Folienliste mit Bild-URLs als JSON.
// Die Praesentation muss fuer "Jeder mit dem Link" lesbar sein. Quelle ist die Praesentationsansicht
// (htmlpresent), die Folien in der richtigen Reihenfolge samt Groesse und Bildadresse enthaelt. Die Bildadresse
// nimmt Breite und Hoehe als Parameter (w, h), der Kiosk setzt sie auf die Bildschirmgroesse.
const FOLIEN_CACHE_SEKUNDEN = 60;

async function folien(id) {
  if (!/^[\w-]{20,80}$/.test(id)) return fehler('Ungueltige Praesentations-ID');
  const upstream = await fetch(`https://docs.google.com/presentation/d/${id}/htmlpresent`, {
    headers: { 'Accept-Language': 'de' },
    cf: { cacheTtl: FOLIEN_CACHE_SEKUNDEN, cacheEverything: true },
  });
  if (!upstream.ok) return fehler(upstream.status === 401 || upstream.status === 403 || upstream.status === 404
    ? 'Praesentation nicht freigegeben (Teilen: Jeder mit dem Link)' : `Google antwortet ${upstream.status}`);
  const html = await upstream.text();
  const slides = [];
  const re = /width:(\d+)px;\s*height:(\d+)px;background-image: url\((https:\/\/docs\.google\.com\/presentation\/d\/[^)]*viewpage\?[^)]*)\)/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[3].replace(/&amp;/g, '&');
    slides.push({ w: +m[1], h: +m[2], url });
  }
  if (!slides.length) return fehler('Keine Folien gefunden (Link richtig? Praesentation freigegeben?)');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  return new Response(JSON.stringify({ title: title.replace(/&amp;/g, '&'), slides }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${FOLIEN_CACHE_SEKUNDEN}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const folienPfad = new URL(request.url).pathname.match(/^\/slides\/([\w-]+)$/);
    if (folienPfad) return folien(folienPfad[1]);
    const pfad = new URL(request.url).pathname.match(/^\/sheet\/(\d+)$/);
    if (pfad) return sheetTab(pfad[1]);
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
