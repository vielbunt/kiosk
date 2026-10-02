// Aktuelle Termine aus dem vielbunt-Kalender, gleiche Quelle und Logik wie vielbunt.org/kiosk.html
import { rrulestr } from 'rrule';

const ICS_URL = 'https://shy-recipe-d443.me-02a.workers.dev/';
const CACHE_KEY = 'vielbunt_loop_ics';
const CACHE_TTL = 30 * 60 * 1000;

// Interne Termine filtert der Worker raus, Arbeitstreffen (AGs, Vorstand, Mitgliederversammlung ...)
// markiert er mit X-VIELBUNT-INTERN, die werden wie im Kiosk blasser dargestellt. Regeln: worker/filter.js

async function loadText() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { text, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL && text.includes('BEGIN:VCALENDAR')) return text;
    }
  } catch (e) { /* kein Speicher, dann eben neu laden */ }
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(ICS_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('kein Kalender');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() })); } catch (e) { /* egal */ }
    return text;
  } finally {
    clearTimeout(id);
  }
}

function parseDate(s) {
  if (!s) return null;
  const y = +s.substr(0, 4), m = +s.substr(4, 2) - 1, d = +s.substr(6, 2);
  if (s.length === 8) return new Date(y, m, d);
  const h = +s.substr(9, 2) || 0, mi = +s.substr(11, 2) || 0, se = +s.substr(13, 2) || 0;
  return s.endsWith('Z') ? new Date(Date.UTC(y, m, d, h, mi, se)) : new Date(y, m, d, h, mi, se);
}
const unescape = (s) => (s || '').replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1').trim();

export function parseICS(text, now = new Date()) {
  const rows = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const all = [];
  let cur = null;
  for (const line of rows) {
    if (line.startsWith('BEGIN:VEVENT')) cur = {};
    else if (line.startsWith('END:VEVENT')) { if (cur) all.push(cur); cur = null; }
    else if (cur) {
      const v = line.slice(line.indexOf(':') + 1);
      if (line.startsWith('SUMMARY')) cur.summary = unescape(v);
      else if (line.startsWith('LOCATION')) cur.location = unescape(v);
      else if (line.startsWith('DTSTART')) { cur.start = parseDate(v); cur.tz = line.includes('TZID'); }
      else if (line.startsWith('DTEND')) cur.end = parseDate(v);
      else if (line.startsWith('RRULE:')) cur.rrule = v;
      else if (line.startsWith('EXDATE')) (cur.ex = cur.ex || []).push(...v.split(',').map((d) => parseDate(d).getTime()));
      else if (line.startsWith('CLASS:')) cur.cls = v.trim();
      else if (line.startsWith('X-VIELBUNT-INTERN:')) cur.intern = true;
      else if (line.startsWith('UID:')) cur.uid = v.trim();
      else if (line.startsWith('RECURRENCE-ID')) cur.recId = parseDate(v);
      else if (line.startsWith('STATUS:')) cur.status = v.trim();
    }
  }
  const moved = {};
  for (const e of all) if (e.recId && e.uid) (moved[e.uid] = moved[e.uid] || []).push(e.recId.getTime());

  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const until = new Date(now.getTime() + 120 * 864e5);
  const out = [];
  for (const e of all) {
    if (!e.start || !e.summary) continue;
    const cls = (e.cls || 'PUBLIC').toUpperCase();
    if (cls === 'PRIVATE' || cls === 'CONFIDENTIAL' || e.status === 'CANCELLED') continue;
    // interne und abgesagte Termine (Auf-/Abbau, intern, Blocker, Klausur ...) filtert schon der Worker (worker/filter.js)
    if (e.rrule) {
      try {
        const s = e.start;
        // rrule rechnet in UTC, Ortszeit deshalb als "naive UTC" durchreichen (wie im Kiosk)
        const dt = e.tz ? new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds())) : s;
        const rule = rrulestr(e.rrule, { dtstart: dt });
        for (const n of rule.between(day0, until, true)) {
          const d = e.tz ? new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes()) : n;
          if (e.ex && e.ex.includes(d.getTime())) continue;
          if (moved[e.uid] && moved[e.uid].includes(d.getTime())) continue;
          out.push({ summary: e.summary, location: e.location, intern: e.intern, start: d });
        }
      } catch (err) { /* kaputte Regel ueberspringen */ }
    } else if (e.start >= day0 && e.start <= until) {
      if (e.ex && e.ex.includes(e.start.getTime())) continue;
      out.push({ summary: e.summary, location: e.location, intern: e.intern, start: e.start });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const pad = (n) => String(n).padStart(2, '0');
export function formatEvent(e) {
  const d = e.start;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return {
    when: `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.` + (hasTime ? ` · ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr` : ''),
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`,
    time: hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '',
    title: e.summary,
    place: e.location || '',
    internal: !!e.intern,
  };
}

export async function loadEvents() {
  const text = await loadText();
  return parseICS(text);
}
