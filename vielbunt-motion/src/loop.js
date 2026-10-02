// vielbunt Loop: Motion-Design im Stil von vielbunt.org.
// Szenen werden zu Vorlagen verkettet, alles wird als Vektor direkt ins Canvas gezeichnet
// (volle Bildschirmaufloesung, beim Aufnehmen exakt im gewaehlten Format).

import logoSvg from './logo.svg';
import { loadEvents, formatEvent } from './events.js';
import { SKY } from './sky-shapes.js';
import { createDotWall } from './dotwall.js';

// Punktwand aus vielbunt-skyline als Szene. Einstellungen wie dort, Farben passend zum Stil.
const WALL = createDotWall();
let wallKey = '';
function wallSettings() {
  const mode = ['pink', 'verlauf', 'rosa'].includes(S.style) ? 'weiss' : 'pink';
  return { mode, grid: 7, set: 'fokus', size: 0.72, speed: 1, shimmer: 1, sweep: 1, reflect: 0.3, windows: 1, sun: 1, logo: 1, depth: 1, camera: 1, pulse: 1, backdrop: 1 };
}
function ensureWall(g) {
  const ws = wallSettings();
  const key = `${Math.round(g.W)}|${Math.round(g.H)}|${g.k.toFixed(3)}|${ws.mode}`;
  if (key !== wallKey) { WALL.build(g.W, g.H, g.k, ws); wallKey = key; }
  return ws;
}

// ---------------------------------------------------------------------------
// Farben, Stile, Formate

const C = {
  pink: '#E6175F', yellow: '#FFCB03', green: '#41B73D', blue: '#13A3DC',
  purple: '#6546B4', orange: '#F59C00', ink: '#363738', white: '#FFFFFF', night: '#12081F',
  rosa: '#FDE8F0', rose: '#F48FB1', magenta: '#C2185B',
};
const LOGO_COLS = [C.pink, C.yellow, C.green, C.blue, C.purple];
const RAINBOW = [C.pink, C.orange, C.yellow, C.green, C.blue, C.purple];
const WHITE5 = [C.white, C.white, C.white, C.white, C.white];

const STYLES = {
  hell: { name: 'Weiß', bg: C.white, fg: C.ink, boxA: C.pink, boxAText: C.white, boxB: C.ink, boxBText: C.white, deco: 'rgba(230,23,95,0.08)', logoText: C.ink, bars: LOGO_COLS, sky: C.pink },
  pink: { name: 'Pink', bg: C.pink, fg: C.white, boxA: C.white, boxAText: C.pink, boxB: 'rgba(255,255,255,0.22)', boxBText: C.white, deco: 'rgba(255,255,255,0.15)', logoText: C.white, bars: [C.white, C.white, C.white, C.white, C.white], sky: C.white },
  rosa: { name: 'Rosa', bg: C.rosa, fg: C.pink, boxA: C.pink, boxAText: C.white, boxB: C.white, boxBText: C.pink, deco: 'rgba(230,23,95,0.1)', logoText: C.ink, bars: LOGO_COLS, sky: C.pink },
  verlauf: { name: 'Verlauf', bg: 'grad', fg: C.white, boxA: C.white, boxAText: C.pink, boxB: 'rgba(255,255,255,0.22)', boxBText: C.white, deco: 'rgba(255,255,255,0.14)', logoText: C.white, bars: [C.white, C.white, C.white, C.white, C.white], sky: C.white },
  nacht: { name: 'Nacht', bg: C.night, fg: C.white, boxA: C.pink, boxAText: C.white, boxB: C.white, boxBText: C.pink, deco: 'rgba(255,255,255,0.06)', logoText: C.white, bars: LOGO_COLS, sky: C.white },
  bunt: { name: 'Bunt', bg: 'scene', fg: C.white, boxA: C.white, boxAText: C.ink, boxB: 'rgba(0,0,0,0.22)', boxBText: C.white, deco: 'rgba(255,255,255,0.16)', logoText: C.white, bars: [C.white, C.white, C.white, C.white, C.white], sky: C.white },
  transparent: { name: 'Transparent', bg: null, fg: C.white, boxA: C.pink, boxAText: C.white, boxB: C.white, boxBText: C.pink, deco: 'rgba(255,255,255,0.12)', logoText: C.white, bars: LOGO_COLS, sky: C.white },
};
const BUNT_BG = [C.pink, C.purple, C.blue, C.green, C.orange, C.pink];

const FORMATS = {
  fill: { name: 'Bildschirm füllen' },
  '16x9': { name: '16:9 Video, Beamer', w: 1920, h: 1080 },
  '9x16': { name: '9:16 Story, Reel', w: 1080, h: 1920 },
  '1x1': { name: '1:1 Post', w: 1080, h: 1080 },
  '4x5': { name: '4:5 Post', w: 1080, h: 1350 },
  '4k': { name: '4K 16:9', w: 3840, h: 2160 },
};

const DEFAULTS = {
  template: 'showreel',
  style: 'hell',
  format: 'fill',
  transition: 'mix',
  speed: 1,
  stretch: 1,
  kicker: 'Queere Community Darmstadt',
  title: 'Schön, dass du da bist.',
  sub: 'Gleich geht’s los',
  motto: 'Zeig dich. Für uns alle.',
  love: 'Liebe ist vielbunt.',
  statement: 'Hier darfst du sein, wie du bist.',
  live: 'an',
  terminAuto: 'an',
  terminCount: 5,
  skyNames: 'aus',
  date: '25.09.',
  time: '20:00',
  place: 'Queeres Zentrum Darmstadt',
  eventTitle: 'Sapphic Space: Spieleabend',
  list: 'Fr 25.09. · 20:00 Uhr | Sapphic Space: Spieleabend\nFr 25.09. · 20:00 Uhr | badminton* (fvv)\nSa 26.09. · 10:00 Uhr | Pilzwanderung mit WaWi\nSa 26.09. · 15:00 Uhr | Queer verstrickt\nMo 28.09. · 19:00 Uhr | poly & more Stammtisch\nMo 28.09. · 19:15 Uhr | queeres fitness* online\nMi 30.09. · 19:30 Uhr | tanzen* (vielbunt sport)\nDo 01.10. · 18:30 Uhr | laufen*',
  tiles: 'Queeres Zentrum\nChristopher Street Day\nTreffbunt\nvielbunt sport*\nBeratung\nMitmachen',
  tilesTitle: 'Das ist vielbunt',
  bubbles: 'Beratung\nBegegnung\neinfach abhängen\nKaffee im Treffbunt\nneue Leute\nSpieleabende\ngemeinsam aktiv\nPlatz für dich',
  bubblesTitle: 'Bei vielbunt ist Platz für dich.',
  groups: 'Treffbunt\nQUEERBAR\nSchrill und Laut\nOpenMicNight\nPolittalk\nSCHLAU Darmstadt\nKitchenswitchen\nvillaQ\nÜ49 Sonntags-Brunch\nAIDS-Gala\nChristopher Street Day\nvielbunt*sport\nSei trans* Du\nKim & Alex\nRainbow Refugees\ntrans*formers\nvielbunter Weihnachtsmarkt',
  countdown: 10,
  slogans: 'Stonewall was a riot!\nRefugees welcome!\nNazis raus!',
  url: 'vielbunt.org',
};

// ---------------------------------------------------------------------------
// Einstellungen

const STORE = 'vielbunt-loop-v3';
function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { s = {}; }
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(DEFAULTS)) {
    if (!q.has(k)) continue;
    s[k] = typeof DEFAULTS[k] === 'number' ? +q.get(k) : q.get(k);
  }
  return { ...DEFAULTS, ...s };
}
const S = loadState();
// eingebettet (Kiosk): die Seite setzt window.__VB_EMBED vor dem Skript
const EMBED = !!window.__VB_EMBED;
const save = () => {
  if (EMBED) return;
  // nur Abweichungen vom Standard speichern, sonst kommen neue Standardtexte nie an
  const diff = {};
  for (const k of Object.keys(DEFAULTS)) if (S[k] !== DEFAULTS[k]) diff[k] = S[k];
  try { localStorage.setItem(STORE, JSON.stringify(diff)); } catch (e) { /* privates Fenster */ }
};
const lines = (str) => String(str || '').split('\n').map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Live-Termine aus dem vielbunt-Kalender (wie der Kiosk), Rueckfall auf die Texte im Menue

const LIVE = { list: null, at: null, error: null };
const cleanPlace = (p) => (p || '').split(',')[0].replace(/-(EG|OG|UG|DG)\b.*$/, '').replace(/\s*\(.*$/, '').trim();
async function refreshLive() {
  if (S.live !== 'an') return;
  try {
    const ev = await loadEvents();
    LIVE.list = ev.map((e) => ({ ...formatEvent(e), place: cleanPlace(e.location), startMs: e.start.getTime() }));
    LIVE.at = new Date();
    LIVE.error = null;
  } catch (e) {
    LIVE.error = 'offline';
  }
  if (typeof buildMenu === 'function' && menu?.classList.contains('open')) updateLiveStatus();
}
setInterval(refreshLive, 30 * 60 * 1000);

// Auswahl wie im Kiosk: die naechsten 8 Tage, hoechstens 9 Zeilen, interne Treffen fliegen zuerst raus
function currentRows(max = 9) {
  if (S.live === 'an' && LIVE.list && LIVE.list.length) {
    const now = Date.now();
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const lim = day0.getTime() + 8 * 864e5;
    let week = LIVE.list.filter((e) => e.startMs >= day0.getTime() && e.startMs < lim && e.startMs > now - 3 * 3600e3);
    while (week.length > max && week.some((e) => e.internal)) {
      const idx = week.map((e, i) => (e.internal ? i : -1)).filter((i) => i >= 0).pop();
      week.splice(idx, 1);
    }
    if (week.length < max) week = week.concat(LIVE.list.filter((e) => e.startMs >= lim)).slice(0, max);
    return week.slice(0, max).map((e) => ({ when: e.when, title: e.title, internal: e.internal }));
  }
  return lines(S.list).slice(0, max).map((r) => { const p = r.split('|').map((x) => x.trim()); return p.length > 1 ? { when: p[0], title: p[1] } : { when: '', title: p[0] }; });
}
// mehrere kommende Veranstaltungen fuers Karussell, gleiche Serien nur einmal
function currentEvents(n) {
  if (S.live === 'an' && S.terminAuto === 'an' && LIVE.list) {
    const now = Date.now();
    const seen = new Set();
    const out = [];
    for (const x of LIVE.list) {
      if (x.internal || x.startMs < now - 3600e3 || !x.time || seen.has(x.title)) continue;
      seen.add(x.title);
      out.push({ date: x.date, time: x.time, title: x.title, place: x.place || 'Darmstadt' });
      if (out.length >= n) break;
    }
    if (out.length) return out;
  }
  return [{ date: S.date, time: S.time, title: S.eventTitle, place: S.place }];
}
function terminCount() {
  const tpl = TEMPLATES[S.template];
  if (!tpl || !tpl.carousel) return 1;
  return Math.max(1, Math.min(S.terminCount, currentEvents(S.terminCount).length));
}
function currentEvent() {
  if (S.live === 'an' && S.terminAuto === 'an' && LIVE.list) {
    const now = Date.now();
    const e = LIVE.list.find((x) => !x.internal && x.startMs > now - 3600e3 && x.time);
    if (e) return { date: e.date, time: e.time, title: e.title, place: e.place || 'Darmstadt' };
  }
  return { date: S.date, time: S.time, title: S.eventTitle, place: S.place };
}

// ---------------------------------------------------------------------------
// Logo als Vektor: jedes Teil mit seiner kompletten Transformationsmatrix aus dem Original-SVG

let LOGO = null;
function prepareLogo() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:841px;height:138px;';
  host.innerHTML = logoSvg;
  document.body.appendChild(host);
  const svg = host.querySelector('svg');
  svg.setAttribute('width', '841');
  svg.setAttribute('height', '138');
  const sb = svg.getBoundingClientRect();
  const ids = ['Red', 'Yellow', 'Green', 'Blue', 'Purple'];
  const pieces = [];
  const mat = (el) => { const m = el.getCTM(); return [m.a, m.b, m.c, m.d, m.e, m.f]; };
  ids.forEach((id, i) => {
    for (const p of svg.getElementById(id).querySelectorAll('path')) pieces.push({ bar: i, path: new Path2D(p.getAttribute('d')), m: mat(p) });
  });
  // das l der Wortmarke ist ein rect
  for (const el of svg.querySelector('#text').querySelectorAll('path, rect')) {
    let path;
    if (el.tagName === 'rect') {
      path = new Path2D();
      path.rect(+el.getAttribute('x'), +el.getAttribute('y'), +el.getAttribute('width'), +el.getAttribute('height'));
    } else path = new Path2D(el.getAttribute('d'));
    pieces.push({ bar: -1, path, m: mat(el) });
  }
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - sb.left, y: r.top - sb.top, w: r.width, h: r.height }; };
  const bars = ids.map((id) => box(svg.getElementById(id)));
  const text = box(svg.querySelector('#text'));
  host.remove();
  const x0 = bars[0].x, x1 = text.x + text.w;
  const y0 = Math.min(...bars.map((b) => b.y), text.y), y1 = Math.max(...bars.map((b) => b.y + b.h));
  LOGO = { pieces, bars, text, base: Math.max(...bars.map((b) => b.y + b.h)), bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

// Logo zeichnen. cx/cy = Mitte, width = Breite (Balken bis Wortmarke)
// o.rise[i] 0..1 Balken taucht aus der Grundlinie, o.dip[i] Anteil nach unten, o.text 0..1 Freilegen
function drawLogo(g, cx, cy, width, o = {}) {
  const { ctx } = g;
  const bb = LOGO.bbox;
  const s = width / bb.w;
  const ox = cx - (bb.x + bb.w / 2) * s;
  const oy = cy - (bb.y + bb.h / 2) * s;
  // auf Pink nie pink auf pink: dann ist das ganze Logo weiss
  const onPink = !o.bars && (g.bgNow === C.pink || g.bgNow === C.magenta || o.onPink);
  const cols = onPink ? WHITE5 : o.bars || g.st.bars;
  const rise = o.rise || [1, 1, 1, 1, 1], dip = o.dip || [0, 0, 0, 0, 0];
  const tr = o.text ?? 1;
  const base = ctx.getTransform();
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox - 10 * s, oy - 1e4, (LOGO.text.x + 2) * s, 1e4 + LOGO.base * s);
  ctx.clip();
  for (const p of LOGO.pieces) {
    if (p.bar < 0) continue;
    const b = LOGO.bars[p.bar];
    const off = (1 - rise[p.bar]) * (b.h + 3) + dip[p.bar] * b.h;
    ctx.setTransform(base);
    ctx.translate(ox, oy + off * s);
    ctx.scale(s, s);
    ctx.transform(...p.m);
    ctx.fillStyle = cols[p.bar];
    ctx.fill(p.path);
  }
  ctx.restore();
  if (tr > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox + (LOGO.text.x - 4) * s, oy - 10 * s, (LOGO.text.w + 8) * s * easeInOut(tr), 200 * s);
    ctx.clip();
    for (const p of LOGO.pieces) {
      if (p.bar >= 0) continue;
      ctx.setTransform(base);
      ctx.translate(ox - (1 - tr) * 30 * s, oy);
      ctx.scale(s, s);
      ctx.transform(...p.m);
      ctx.fillStyle = o.textColor || (onPink ? C.white : g.st.logoText);
      ctx.fill(p.path);
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.setTransform(base);
}
const riseIn = (t, t0, step = 0.1, len = 0.8) => [0, 1, 2, 3, 4].map((i) => easeOutBack(seg(t, t0 + i * step, t0 + len + i * step)));

// ---------------------------------------------------------------------------
// Grundformen

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeIn = (x) => x * x * x;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
// Kreisfrequenz so runden, dass ueber die Szenendauer ganze Perioden laufen (nahtloser Loop)
const om = (g, d, w) => (g.seamless ? (2 * Math.PI * Math.max(1, Math.round((w * d) / (2 * Math.PI)))) / d : w);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Balken wie im Logo: gerader Schaft, oben ein exakter Halbkreis (Radius = halbe Breite)
function arch(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  if (h <= 0) return;
  if (h <= r) ctx.ellipse(x + r, y + h, r, h, 0, Math.PI, 0);
  else {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
  }
  ctx.closePath();
}
function fillArch(ctx, x, y, w, h, color) { if (h <= 0) return; arch(ctx, x, y, w, h); ctx.fillStyle = color; ctx.fill(); }

function heartPath(ctx, x, y, s) {
  // Herz, Mitte bei x/y, Breite etwa 2*s
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.3, x, y - s * 0.55);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

const FONT = '"Cera Pro", "Helvetica Neue", Arial, sans-serif';
// Textbreiten merken, measureText in jedem Bild kostet auf schwachen Rechnern spuerbar Zeit
const MW = new Map();
function mw(ctx, str) {
  const key = ctx.font + '|' + str;
  let w = MW.get(key);
  if (w === undefined) {
    w = ctx.measureText(str).width;
    if (MW.size > 5000) MW.clear();
    MW.set(key, w);
  }
  return w;
}
const font = (ctx, size, weight = 700) => { ctx.font = `${weight} ${size}px ${FONT}`; };

// Text in Kasten wie auf den vielbunt-Kacheln
function boxText(g, str, x, y, size, o = {}) {
  const { ctx } = g;
  if (!str) return { w: 0, h: 0 };
  font(ctx, size, o.weight || 700);
  const tw = mw(ctx, str);
  const padX = size * (o.padX ?? 0.24), padY = size * 0.1;
  const bw = tw + padX * 2, bh = size * 1.2 + padY;
  const bx = o.align === 'center' ? x - bw / 2 : o.align === 'right' ? x - bw : x;
  const rev = o.reveal ?? 1;
  if (rev <= 0) return { w: bw, h: bh };
  const r = easeOutExpo(clamp(rev * 1.25));
  ctx.save();
  ctx.beginPath();
  if (o.from === 'right') ctx.rect(bx + bw * (1 - r), y, bw * r, bh);
  else ctx.rect(bx, y, bw * r, bh);
  ctx.clip();
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(bx, y, bw, bh); }
  const tr = easeOutExpo(seg(rev, 0.22, 1));
  ctx.globalAlpha *= tr;
  ctx.fillStyle = o.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, bx + padX, y + bh - padY - size * 0.28 + (1 - tr) * size * 0.45);
  ctx.restore();
  return { w: bw, h: bh };
}

// gesperrte Versalien wie "QUEERE COMMUNITY DARMSTADT" auf der Website
function kicker(g, str, x, y, size, color, align = 'left', reveal = 1) {
  const { ctx } = g;
  if (!str || reveal <= 0) return 0;
  str = str.toUpperCase();
  font(ctx, size, 700);
  const sp = size * 0.24;
  const chars = [...str];
  const widths = chars.map((c) => mw(ctx, c));
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const ga = ctx.globalAlpha;
  chars.forEach((c, i) => {
    const a = clamp(reveal * (chars.length * 0.5 + 1) - i * 0.5);
    ctx.globalAlpha = ga * a;
    ctx.fillText(c, cx, y + (1 - a) * size * 0.4);
    cx += widths[i] + sp;
  });
  ctx.restore();
  return total;
}

function wrap(g, str, size, maxW) {
  const { ctx } = g;
  font(ctx, size);
  const text = String(str || '').trim();
  const fits = (l) => mw(ctx, l) <= maxW;
  if (fits(text)) return text ? [text] : [];
  // mehrere Saetze: zuerst zwischen den Saetzen umbrechen ("Zeig dich. / Für uns alle.")
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out = [];
  for (const sen of sentences) {
    const words = sen.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (!fits(test) && cur) { out.push(cur); cur = w; } else cur = test;
    }
    if (cur) out.push(cur);
  }
  // letzte Zeile nicht als einzelnes Wort stehen lassen
  if (out.length > 1 && !/\s/.test(out[out.length - 1]) && sentences.length === 1) {
    const prev = out[out.length - 2].split(' ');
    if (prev.length > 1) { const w = prev.pop(); out[out.length - 2] = prev.join(' '); out[out.length - 1] = w + ' ' + out[out.length - 1]; }
  }
  return out;
}

// Deko-Balken in Logo-Proportionen (Hoehen 0,48 / 0,74 / 1, Luecke 0,3 x Breite)
function decoBars(g, x, bottom, w, hmax, color, t, grow = 1) {
  const hs = [0.48, 0.74, 1, 0.74, 0.48];
  for (let i = 0; i < 5; i++) {
    const gr = easeOutBack(clamp(grow * 1.6 - i * 0.12));
    const bob = Math.sin(t * 1.2 + i * 0.9) * hmax * 0.025;
    const h = hs[i] * hmax * gr + bob;
    fillArch(g.ctx, x + i * w * 1.3, bottom - h, w, h + 2, color);
  }
}

// Linien-Icons im Stil der Website (24er-Raster, Strichstaerke 2)
const ICONS = {
  users: (c) => { c.moveTo(13, 7); c.arc(9, 7, 4, 0, 7); c.moveTo(3, 21); c.bezierCurveTo(3, 15, 15, 15, 15, 21); c.moveTo(16, 3.2); c.arc(16, 7, 3.8, -1.57, 1.57); c.moveTo(18, 14.5); c.bezierCurveTo(20.5, 15.5, 21, 18, 21, 21); },
  flag: (c) => { c.moveTo(5, 22); c.lineTo(5, 3); c.lineTo(19, 3); c.lineTo(16, 8); c.lineTo(19, 13); c.lineTo(5, 13); },
  cup: (c) => { c.moveTo(4, 9); c.lineTo(16, 9); c.lineTo(16, 17); c.quadraticCurveTo(16, 21, 12, 21); c.lineTo(8, 21); c.quadraticCurveTo(4, 21, 4, 17); c.closePath(); c.moveTo(16, 11); c.bezierCurveTo(21, 11, 21, 16, 16, 16); c.moveTo(8, 2); c.lineTo(8, 5); c.moveTo(12, 2); c.lineTo(12, 5); },
  run: (c) => { c.moveTo(17, 4.5); c.arc(15, 4.5, 2, 0, 7); c.moveTo(6, 21); c.lineTo(10, 15); c.lineTo(13, 17); c.lineTo(14, 10); c.lineTo(9, 9); c.lineTo(6, 12); c.moveTo(14, 10); c.lineTo(17, 13); c.lineTo(20, 13); c.moveTo(13, 17); c.lineTo(15, 21); },
  bubble: (c) => { c.moveTo(21, 15); c.quadraticCurveTo(21, 17, 19, 17); c.lineTo(7, 17); c.lineTo(3, 21); c.lineTo(3, 5); c.quadraticCurveTo(3, 3, 5, 3); c.lineTo(19, 3); c.quadraticCurveTo(21, 3, 21, 5); c.closePath(); },
  hand: (c) => { c.moveTo(8, 13); c.lineTo(8, 4.5); c.arc(9.5, 4.5, 1.5, Math.PI, 0); c.lineTo(11, 12); c.moveTo(11, 11); c.lineTo(11, 3.5); c.arc(12.5, 3.5, 1.5, Math.PI, 0); c.lineTo(14, 11); c.moveTo(14, 11); c.lineTo(14, 5.5); c.arc(15.5, 5.5, 1.5, Math.PI, 0); c.lineTo(17, 14); c.bezierCurveTo(17, 19, 15, 22, 11, 22); c.bezierCurveTo(7, 22, 5, 18, 4, 15); c.lineTo(3.2, 12.5); c.arc(4.6, 12, 1.5, Math.PI, -0.2); c.lineTo(8, 15); },
  heart: (c) => { c.moveTo(12, 20.5); c.bezierCurveTo(4, 15, 2, 11, 2, 8.5); c.bezierCurveTo(2, 5.5, 4.5, 3, 7.5, 3); c.bezierCurveTo(9.5, 3, 11, 4, 12, 5.5); c.bezierCurveTo(13, 4, 14.5, 3, 16.5, 3); c.bezierCurveTo(19.5, 3, 22, 5.5, 22, 8.5); c.bezierCurveTo(22, 11, 20, 15, 12, 20.5); c.closePath(); },
  smile: (c) => { c.moveTo(22, 12); c.arc(12, 12, 10, 0, 7); c.moveTo(8, 14.5); c.quadraticCurveTo(12, 18, 16, 14.5); c.moveTo(9, 9); c.lineTo(9.01, 9); c.moveTo(15, 9); c.lineTo(15.01, 9); },
  pin: (c) => { c.moveTo(12, 22); c.bezierCurveTo(8, 17, 5, 13.5, 5, 10); c.arc(12, 10, 7, Math.PI, 0); c.bezierCurveTo(19, 13.5, 16, 17, 12, 22); c.moveTo(14.5, 10); c.arc(12, 10, 2.5, 0, 7); },
  mic: (c) => { c.moveTo(9, 5); c.arc(12, 5, 3, Math.PI, 0); c.lineTo(15, 12); c.arc(12, 12, 3, 0, Math.PI); c.closePath(); c.moveTo(5, 11); c.bezierCurveTo(5, 19, 19, 19, 19, 11); c.moveTo(12, 17); c.lineTo(12, 22); },
  music: (c) => { c.moveTo(9, 18); c.lineTo(9, 5); c.lineTo(21, 3); c.lineTo(21, 16); c.moveTo(9, 18); c.arc(6, 18, 3, 0, 7); c.moveTo(21, 16); c.arc(18, 16, 3, 0, 7); },
};
function icon(g, name, x, y, size, color, lw = 2) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  (ICONS[name] || ICONS.heart)(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
function iconFor(label) {
  const l = label.toLowerCase();
  if (/zentrum|community|gruppe/.test(l)) return 'users';
  if (/csd|christopher|pride|demo/.test(l)) return 'flag';
  if (/treffbunt|café|cafe|kaffee|brunch|kitchen/.test(l)) return 'cup';
  if (/sport|lauf|fitness|badminton/.test(l)) return 'run';
  if (/beratung|gespräch|talk|schlau/.test(l)) return 'bubble';
  if (/mitmach|helfen|ehrenamt/.test(l)) return 'hand';
  if (/jugend|familie|kinder|villaq/.test(l)) return 'smile';
  if (/mic|open/.test(l)) return 'mic';
  if (/party|laut|bar/.test(l)) return 'music';
  return 'heart';
}

// ---------------------------------------------------------------------------
// Skyline zeichnen. o.line = Linienzeichnung, o.rise(i) 0..1 je Gebaeude, o.draw(i) 0..1 fuer das Nachzeichnen
function skyline(g, keys, x, baseline, width, maxH, o = {}) {
  const { ctx } = g;
  const gap = 4;
  const total = keys.reduce((a, k) => a + SKY[k].w, 0) + gap * (keys.length - 1);
  const s = Math.min(width / total, maxH / 52);
  let cx = x - (total * s) / 2;
  const main = o.color || g.st.sky;
  const bgc = g.bgNow || (S.style === 'transparent' ? C.night : C.white);
  const K = {
    main, detail: bgc, detail2: shade(main), gold: C.yellow, roof: o.line ? main : '#5FB8A0', fingers: LOGO_COLS,
  };
  const out = [];
  keys.forEach((k, i) => {
    const L = SKY[k];
    const r = o.rise ? o.rise(i) : 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 6 * s, baseline - 1e4, L.w * s + 12 * s, 1e4);
    ctx.clip();
    ctx.translate(cx, baseline + (1 - r) * (L.h + 3) * s);
    const lf = o.lift ? o.lift(i) : 0;
    if (lf) { ctx.translate((L.w * s) / 2, 0); ctx.scale(1 + lf, 1 + lf); ctx.translate((-L.w * s) / 2, 0); }
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let P;
    if (o.line) {
      const p = o.draw ? o.draw(i) : 1;
      ctx.setLineDash([p * 320, 400]);
      P = (col, kind) => { ctx.strokeStyle = kind && col !== bgc && col !== K.detail2 ? col : main; ctx.lineWidth = kind ? 0.12 : 0.24; ctx.stroke(); };
    } else {
      P = (col, kind) => {
        if (kind === 'l') { ctx.strokeStyle = col; ctx.lineWidth = 0.16; ctx.stroke(); }
        else { ctx.fillStyle = col; ctx.fill(); }
      };
    }
    L.draw(ctx, P, K);
    ctx.restore();
    out.push({ x: cx, w: L.w * s, h: L.h * s, name: L.name });
    cx += (L.w + gap) * s;
  });
  return out;
}
function shade(hex) {
  if (hex === C.white) return 'rgba(255,255,255,0.72)';
  return hex + 'B8';
}

// ---------------------------------------------------------------------------
// Pride-Flaggen

const FLAGS = {
  progress: { name: 'Progress Pride (inter*-inklusiv)', stripes: ['#E22016', '#F28917', '#EFE524', '#78B82A', '#2C58A4', '#6D2380'], progress: true },
  regenbogen: { name: 'Regenbogen', stripes: ['#E40303', '#FF8C00', '#FFED00', '#008026', '#24408E', '#732982'] },
  trans: { name: 'Trans*', stripes: ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'] },
  bi: { name: 'Bi*', stripes: ['#D60270', '#D60270', '#9B4F96', '#0038A8', '#0038A8'] },
  lesbisch: { name: 'Lesbisch', stripes: ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'] },
  enby: { name: 'Nicht-binär', stripes: ['#FCF434', '#FFFFFF', '#9C59D1', '#2C2C2C'] },
  pan: { name: 'Pan', stripes: ['#FF218C', '#FFD800', '#21B1FF'] },
  ace: { name: 'Ace', stripes: ['#000000', '#A3A3A3', '#FFFFFF', '#800080'] },
  inter: { name: 'Inter*', solid: '#FFD800' },
};
const FLAG_KEYS = Object.keys(FLAGS);
const flagCache = {};
// Seitenverhaeltnis wie das Wikimedia-SVG der Progress-Flagge (1200 x 762)
const FLAG_AR = 762 / 1200;
function flagCanvas(key) {
  if (flagCache[key]) return flagCache[key];
  const f = FLAGS[key];
  const w = 1800, h = Math.round(w * FLAG_AR);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (f.solid) {
    x.fillStyle = f.solid; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#7902AA'; x.lineWidth = h * 0.08; x.beginPath(); x.arc(w / 2, h / 2, h * 0.22, 0, 7); x.stroke();
  } else {
    f.stripes.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * h) / f.stripes.length, w, h / f.stripes.length + 1); });
  }
  if (f.progress) drawChevrons(x, h, 1);
  flagCache[key] = c;
  return c;
}
// Winkel der inter*-inklusiven Progress-Flagge, Masse exakt aus dem SVG (Hoehe 762).
// p 0..1 schiebt die Lagen nacheinander von links herein.
const CHEVRONS = [['#000000', 315], ['#945516', 241], ['#7BCCE5', 168], ['#F4AEC8', 95], ['#FFFFFF', 22]];
function drawChevrons(x, h, p) {
  const k = h / 762;
  CHEVRONS.forEach(([col, a], i) => {
    const e = easeOut(clamp(p * 1.7 - i * 0.14));
    if (e <= 0) return;
    const off = (1 - e) * -(a + 353) * k;
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(off, 0); x.lineTo(off + a * k, 0); x.lineTo(off + (a + 353) * k, h / 2); x.lineTo(off + a * k, h); x.lineTo(off, h);
    x.closePath();
    x.fill();
  });
  const e = easeOut(clamp(p * 1.7 - 5 * 0.14));
  if (e > 0) {
    const off = (1 - e) * -301 * k;
    x.fillStyle = '#FDD817';
    x.beginPath(); x.moveTo(off, 55 * k); x.lineTo(off + 301 * k, h / 2); x.lineTo(off, 706 * k); x.closePath(); x.fill();
  }
  const cp = clamp(p * 1.7 - 0.95);
  if (cp > 0) {
    x.strokeStyle = '#66338B'; x.lineWidth = 19 * k;
    x.beginPath(); x.arc(111 * k, h / 2, 80 * k * easeOutBack(cp), 0, 7); x.stroke();
  }
}
// wehende Flagge: viele feine senkrechte Streifen, Welle und Licht verlaufen stetig
function wavingFlag(g, key, x, y, w, t, amp = 0.045, omega = 4) {
  const { ctx } = g;
  const img = flagCanvas(key);
  const h = w * FLAG_AR;
  // 240 Streifen reichen fuer eine glatte Welle und halten die Bildrate oben
  const n = 240;
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const ph = u * 6.5 - t * omega;
    const grow = Math.min(1, u * 3);
    const dy = Math.sin(ph) * amp * w * grow;
    // Stoff wird in den Wellentaelern leicht gestaucht
    const sh = h * (1 - 0.018 * grow * (1 - Math.cos(ph)));
    const sl = Math.cos(ph) * grow;
    ctx.drawImage(img, (i / n) * img.width, 0, img.width / n + 0.5, img.height, x + i * sw, y + dy + (h - sh) / 2, sw + 0.6, sh);
    ctx.fillStyle = sl > 0 ? `rgba(255,255,255,${(sl * 0.13).toFixed(3)})` : `rgba(0,0,0,${(-sl * 0.16).toFixed(3)})`;
    ctx.fillRect(x + i * sw, y + dy + (h - sh) / 2, sw + 0.6, sh);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Szenen

function layout(g) {
  const { W, H } = g;
  const portrait = H > W * 1.1;
  return { portrait, m: g.u * (portrait ? 80 : 110) };
}
function sceneBg(g, i, forced) {
  const { ctx, W, H, st } = g;
  let bg = forced || (st.bg === 'scene' ? BUNT_BG[i % BUNT_BG.length] : st.bg);
  if (bg === 'grad') {
    const gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, C.pink); gr.addColorStop(1, C.purple);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    g.bgNow = C.pink;
    return;
  }
  g.bgNow = bg;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
}

const SCENES = {
  logo: {
    name: 'Logo-Aufbau', dur: 7,
    draw(g, t) {
      const { W, H, u } = g, L = layout(g);
      decoBars(g, W - L.m - 5 * 70 * u, H + 8 * u, 70 * u, H * 0.55, g.st.deco, t, seg(t, 0.2, 1.6));
      const lw = W * (L.portrait ? 0.8 : 0.5);
      const dip = [0, 1, 2, 3, 4].map((i) => (0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.8)) * 0.12 * seg(t, 2.4, 3.4));
      const cy = H * 0.46;
      kicker(g, S.kicker, W / 2, cy - lw * 0.2 - 30 * u, 26 * u, g.st.fg, 'center', seg(t, 0.8, 2));
      drawLogo(g, W / 2, cy, lw, { rise: riseIn(t, 0.3, 0.12, 0.9), dip, text: seg(t, 1.2, 2.2) });
      if (!g.noSub) boxText(g, S.sub, W / 2, cy + lw * 0.13 + 40 * u, 58 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 2.2, 3.1) });
    },
  },
  logoZoom: {
    name: 'Logo-Zoom', dur: 6,
    draw(g, t) {
      const { W, H } = g, L = layout(g);
      const lw = W * (L.portrait ? 0.8 : 0.5);
      const z = easeInOut(seg(t, 0.9, 3.2));
      const width = lerp((H * 1.5) / 0.22, lw, z);
      drawLogo(g, W / 2, lerp(H * 0.8, H * 0.46, z), width, { rise: [0, 1, 2, 3, 4].map((i) => easeOut(seg(t, i * 0.1, 0.9 + i * 0.1))), text: seg(t, 3.0, 4.0) });
      boxText(g, S.kicker, W / 2, H * 0.46 + lw * 0.13 + 40 * g.u, 34 * g.u, { bg: g.st.boxB, fg: g.st.boxBText, align: 'center', reveal: seg(t, 3.6, 4.4) });
    },
  },
  headline: {
    name: 'Headline', dur: 7,
    draw(g, t, d, text) {
      const { W, H, u } = g, L = layout(g);
      const size = (L.portrait ? 128 : 150) * u;
      const ls = wrap(g, text || S.title, size, W - L.m * 2.4);
      const lh = size * 1.32;
      const y = H / 2 - (ls.length * lh) / 2 + 20 * u;
      kicker(g, S.kicker, L.m, y - 40 * u, 26 * u, g.st.fg, 'left', seg(t, 0.2, 1.2));
      ls.forEach((l, i) => boxText(g, l, L.m, y + i * lh, size, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(t, 0.5 + i * 0.25, 1.4 + i * 0.25) }));
      if (!g.noDeco) decoBars(g, W - L.m - 5 * 46 * u, H + 6 * u, 46 * u, H * 0.34, g.st.deco, t, seg(t, 0.8, 2));
      drawLogo(g, W - L.m - 150 * u, L.m * 0.8, 300 * u, { text: seg(t, 1.5, 2.3), rise: riseIn(t, 1, 0.08, 0.7) });
    },
  },
  statement: {
    name: 'Statement', dur: 7,
    draw(g, t, d) {
      const { ctx, W, H, u } = g;
      font(ctx, 900 * u);
      ctx.fillStyle = g.st.deco;
      ctx.globalAlpha = seg(t, 0, 1);
      ctx.fillText('„', W * 0.06, H * 0.7);
      ctx.globalAlpha = 1;
      SCENES.headline.draw(g, t, d, S.statement);
    },
  },
  equalizer: {
    name: 'Equalizer', dur: 9,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const n = Math.max(9, Math.round(W / (70 * u)));
      const bw = W / (n * 1.3 - 0.3);
      // Beat mit kurzem, weichem Anstieg, sonst springen die Spitzen
      const bf = (t * 2.1) % 1;
      const beat = bf < 0.14 ? Math.sin((bf / 0.14) * Math.PI / 2) ** 2 : Math.exp(-(bf - 0.14) * 5.5);
      const mono = g.st.bg === 'scene' || g.st.bg === 'grad' || g.st.bg === C.pink;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const center = 1 - Math.abs(k - 0.5) * 1.2;
        const e = 0.35 * (0.5 + 0.5 * Math.sin(t * 2.3 + i * 0.55)) + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.7 - i * 1.3)) + 0.35 * beat * center;
        const grow = easeOutBack(seg(t, k * 0.6, 0.9 + k * 0.6));
        const h = H * (0.2 + 0.55 * e * center) * grow;
        fillArch(ctx, i * bw * 1.3, H - h, bw, h + 2, mono ? (i % 2 ? C.white : 'rgba(255,255,255,0.7)') : LOGO_COLS[i % 5]);
      }
      boxText(g, S.title, W / 2, H * (L.portrait ? 0.2 : 0.18), (L.portrait ? 96 : 110) * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 1, 2) });
      kicker(g, S.kicker, W / 2, H * (L.portrait ? 0.18 : 0.15), 26 * u, g.st.fg, 'center', seg(t, 1.4, 2.4));
    },
  },
  termin: {
    // im Karussell pro Termin 8,5 Sekunden, sonst ein einzelner Termin
    name: 'Termin', dur: () => 8.5 * terminCount(),
    draw(g, t, d) {
      const { W, H, u, ctx } = g, L = layout(g);
      const n = Math.max(1, Math.round(d / (8.5 * S.stretch)));
      const per = d / n;
      const k = Math.min(n - 1, Math.floor(t / per));
      const tt = t - k * per;
      const ev = currentEvents(n)[k] || currentEvents(1)[0];
      decoBars(g, W - L.m - 5 * 90 * u, H + 8 * u, 90 * u, H * (L.portrait ? 0.4 : 0.72), g.st.deco, t, seg(t, 0.2, 1.8));
      drawLogo(g, L.m + 170 * u, L.m + 20 * u, 340 * u, { rise: riseIn(t, 0.1, 0.08, 0.7), text: seg(t, 0.5, 1.3) });
      // Zaehler oben rechts, z. B. 2 / 4
      if (n > 1) {
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i === k ? g.st.boxA : g.st.deco;
          const w = i === k ? 46 * u : 18 * u;
          const x0 = W - L.m - (n - 1) * 30 * u - 28 * u + i * 30 * u + (i > k ? 28 * u : 0);
          ctx.fillRect(x0, L.m + 12 * u, w, 10 * u);
        }
      }
      // Wechsel: Inhalt faehrt nach links raus, der naechste Termin baut sich neu auf
      // der letzte Termin bleibt stehen, der Szenenuebergang deckt ihn zu
      const out = n > 1 && k < n - 1 ? easeIn(seg(tt, per - 0.55, per)) : 0;
      ctx.save();
      ctx.translate(-out * W * 0.7, 0);
      ctx.globalAlpha = 1 - out;
      const size = (L.portrait ? 130 : 150) * u;
      let y = H * (L.portrait ? 0.38 : 0.3);
      const dt = [ev.date, ev.time].filter(Boolean).join(' · ');
      const r1 = boxText(g, dt, L.m, y, size * 0.8, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(tt, 0.5, 1.4) });
      y += r1.h + 24 * u;
      wrap(g, ev.title, size, W * (L.portrait ? 0.86 : 0.62)).slice(0, 3).forEach((l, i) => { boxText(g, l, L.m, y, size, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(tt, 0.9 + i * 0.22, 1.8 + i * 0.22) }); y += size * 1.3; });
      y += 10 * u;
      if (ev.place) {
        const a = seg(tt, 1.9, 2.7);
        ctx.globalAlpha = a * (1 - out);
        icon(g, 'pin', L.m, y + 4 * u, 44 * u, g.st.fg, 2.2);
        ctx.globalAlpha = 1 - out;
        boxText(g, ev.place, L.m + 54 * u, y, 42 * u, { fg: g.st.fg, padX: 0.1, reveal: a, weight: 400 });
      }
      ctx.restore();
    },
  },
  liste: {
    name: 'Terminliste', dur: 11,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      // quer zwei Spalten, hochkant eine
      const cols = L.portrait ? 1 : 2;
      const perCol = L.portrait ? 10 : 7;
      const rows = currentRows(perCol * cols);
      const gapX = 70 * u;
      const colW = (W - L.m * 2 - gapX * (cols - 1)) / cols;
      const head = (L.portrait ? 96 : 90) * u;
      const hb = boxText(g, 'Nächste Termine', L.m, L.m * 0.8, head, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(t, 0.2, 1) });
      boxText(g, 'von vielbunt', L.m, L.m * 0.8 + hb.h, head * 0.6, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(t, 0.4, 1.2) });
      const top = L.m * 0.8 + hb.h + head * 0.9 + 30 * u;
      const avail = H - top - 170 * u;
      const rh = Math.min(92 * u, avail / Math.max(1, Math.min(perCol, rows.length)));
      const fs = rh * 0.46;
      let anyInternal = false;
      rows.forEach((r, i) => {
        const c = Math.floor(i / perCol);
        const x0 = L.m + c * (colW + gapX);
        const y = top + (i % perCol) * rh;
        const a = seg(t, 0.8 + i * 0.1, 1.6 + i * 0.1);
        anyInternal = anyInternal || r.internal;
        const chip = r.when ? boxText(g, r.when, x0, y, fs * 0.72, { bg: r.internal ? g.st.boxB : g.st.boxA, fg: r.internal ? g.st.boxBText : g.st.boxAText, reveal: a }) : { w: 0 };
        ctx.save();
        ctx.globalAlpha = easeOut(a) * (r.internal ? 0.55 : 1);
        font(ctx, fs, 700);
        ctx.fillStyle = g.st.fg;
        const tx = x0 + (r.when ? chip.w + 22 * u : 0) + (1 - easeOut(a)) * 40 * u;
        let title = r.title;
        // erst die Schrift bis 78 % verkleinern, erst danach kuerzen
        const room = x0 + colW - tx;
        const tw0 = mw(ctx, title);
        if (tw0 > room) font(ctx, fs * Math.max(0.78, room / tw0), 700);
        while (title.length > 4 && mw(ctx, title) > room) title = title.slice(0, -2);
        if (title !== r.title) title = title.trim() + ' …';
        ctx.fillText(title, tx, y + fs * 0.98);
        ctx.restore();
      });
      // senkrechte Trennlinie zwischen den Spalten
      if (cols > 1 && rows.length > perCol) {
        const a = easeOutExpo(seg(t, 1, 2));
        ctx.fillStyle = g.st.deco;
        ctx.fillRect(L.m + colW + gapX / 2 - 1.5 * u, top, 3 * u, rh * perCol * a);
      }
      if (anyInternal) {
        const a = seg(t, 2, 2.6);
        ctx.globalAlpha = a;
        font(ctx, 24 * u, 700);
        ctx.fillStyle = g.st.boxA; ctx.fillRect(L.m, H - 128 * u, 18 * u, 18 * u);
        ctx.fillStyle = g.st.fg; ctx.fillText('Veranstaltung', L.m + 28 * u, H - 111 * u);
        const w1 = mw(ctx, 'Veranstaltung');
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = g.st.boxB; ctx.fillRect(L.m + w1 + 60 * u, H - 128 * u, 18 * u, 18 * u);
        ctx.fillStyle = g.st.fg; ctx.fillText('Arbeitstreffen', L.m + w1 + 88 * u, H - 111 * u);
        ctx.globalAlpha = 1;
      }
      const fb = seg(t, 1.5, 2.3);
      ctx.fillStyle = g.st.boxA;
      ctx.fillRect(0, H - 90 * u, W * easeOutExpo(fb), 90 * u);
      ctx.globalAlpha = fb;
      font(ctx, 36 * u, 700);
      ctx.fillStyle = g.st.boxAText;
      ctx.fillText(`Mehr Termine auf ${S.url}`, L.m, H - 32 * u);
      ctx.globalAlpha = 1;
    },
  },
  kacheln: {
    name: 'Kacheln', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const items = lines(S.tiles).slice(0, 6);
      const cols = L.portrait ? 2 : items.length > 4 ? 3 : 2;
      const rows = Math.ceil(items.length / cols);
      const head = 96 * u;
      boxText(g, S.tilesTitle, L.m, L.m * 0.8, head, { bg: g.st.boxA, fg: g.st.boxAText, reveal: seg(t, 0.1, 0.9) });
      const top = L.m * 0.8 + head * 1.6, gap = 18 * u;
      const tw = (W - L.m * 2 - gap * (cols - 1)) / cols;
      const th = Math.min(tw * 0.6, (H - top - L.m * 0.8 - gap * (rows - 1)) / rows);
      const tileCols = [C.pink, C.green, C.yellow, C.blue, C.purple, C.orange];
      // Betonung wandert stetig von Kachel zu Kachel (kein Umschalten)
      const hp = Math.max(0, t - 2) / 1.4;
      const hon = seg(t, 2, 2.8);
      items.forEach((label, i) => {
        const cx = L.m + (i % cols) * (tw + gap), cy = top + Math.floor(i / cols) * (th + gap);
        const a = easeOutBack(seg(t, 0.4 + i * 0.12, 1.1 + i * 0.12));
        if (a <= 0) return;
        // die gerade betonte Kachel hebt sich leicht an, ohne Rahmen
        const n = items.length;
        let dist = Math.abs(((hp % n) + n) % n - i);
        dist = Math.min(dist, n - dist);
        const lift = hon * (dist < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * dist) : 0);
        const sc = 0.85 + 0.15 * a + lift * 0.03;
        ctx.save();
        ctx.translate(cx + tw / 2, cy + th / 2);
        ctx.scale(sc, sc);
        ctx.translate(-tw / 2, -th / 2);
        ctx.globalAlpha = clamp(a);
        ctx.fillStyle = tileCols[i % 6] === g.bgNow ? 'rgba(255,255,255,0.22)' : tileCols[i % 6];
        ctx.fillRect(0, 0, tw, th);
        const gr = ctx.createLinearGradient(0, 0, 0, th);
        gr.addColorStop(0, 'rgba(255,255,255,0.1)');
        gr.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, tw, th);
        if (lift > 0) { ctx.fillStyle = `rgba(255,255,255,${(lift * 0.14).toFixed(3)})`; ctx.fillRect(0, 0, tw, th); }
        const txtCol = tileCols[i % 6] === C.yellow ? C.ink : C.white;
        icon(g, iconFor(label), 26 * u, 24 * u, Math.min(64 * u, th * 0.3), txtCol, 2);
        // Schrift verkleinern, bis das Label in die Kachel passt
        let fsz = Math.min(46 * u, th * 0.2);
        font(ctx, fsz, 700);
        const maxW = tw - 52 * u;
        const lw = mw(ctx, label);
        if (lw > maxW) { fsz *= maxW / lw; font(ctx, fsz, 700); }
        ctx.fillStyle = txtCol;
        ctx.fillText(label, 26 * u, th - 28 * u);
        ctx.restore();
      });
    },
  },
  countdown: {
    name: 'Countdown', dur: () => Math.max(3, S.countdown) + 1.5,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const N = Math.max(3, S.countdown);
      const left = N - Math.floor(t);
      const f = t % 1;
      const lit = Math.ceil(clamp(1 - t / N) * 5);
      drawLogo(g, W / 2, L.m + 30 * u, 380 * u, { rise: [0, 1, 2, 3, 4].map((i) => (i < lit ? 1 : 0.2)) });
      const size = Math.min(W, H) * 0.42;
      const cy = H * 0.52;
      if (left > 0) {
        const pop = easeOutBack(clamp(f * 3));
        const out = easeIn(seg(f, 0.8, 1));
        ctx.save();
        ctx.translate(W / 2, cy);
        ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
        ctx.globalAlpha = 1 - out;
        font(ctx, size, 700);
        const tw = mw(ctx, String(left));
        ctx.fillStyle = g.st.boxA;
        ctx.fillRect(-tw / 2 - size * 0.18, -size * 0.62, tw + size * 0.36, size * 1.12);
        ctx.fillStyle = g.st.boxAText;
        ctx.textAlign = 'center';
        ctx.fillText(String(left), 0, size * 0.36 - out * size * 0.3);
        ctx.restore();
      } else {
        boxText(g, 'Los geht’s!', W / 2, cy - 90 * u, 150 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, N, N + 0.6) });
      }
      boxText(g, S.sub, W / 2, H - L.m - 80 * u, 52 * u, { bg: g.st.boxB, fg: g.st.boxBText, align: 'center', reveal: seg(t, 0.3, 1.2) });
      const pw = W * 0.5, px = (W - pw) / 2, py = H - L.m * 0.6;
      const p = clamp(t / N);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = RAINBOW[i]; ctx.fillRect(px + (pw / 6) * i, py, (pw / 6) * clamp(p * 6 - i), 8 * u); }
    },
  },
  pride: {
    name: 'Pride-Streifen', dur: 9,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const sw = 110 * u, diag = Math.hypot(W, H);
      const a = easeOutExpo(seg(t, 0, 1.2));
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.5);
      const off = (t * 90 * u) % (sw * 6);
      for (let k = -Math.ceil(diag / sw) - 6; k < Math.ceil(diag / sw) + 6; k++) {
        ctx.fillStyle = RAINBOW[((k % 6) + 6) % 6];
        ctx.fillRect(k * sw + off, (-diag * a) / 2, sw + 1, diag * a);
      }
      ctx.restore();
      const cw = W * (L.portrait ? 0.84 : 0.5), ch = cw * 0.36;
      const r = easeOutBack(seg(t, 0.8, 1.8));
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(r, r);
      ctx.fillStyle = C.white;
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.restore();
      if (r > 0.9) {
        // die Karte ist immer weiss: Logo daher immer in Originalfarben, auch wenn der Stil pink ist
        drawLogo({ ...g, st: STYLES.hell, bgNow: C.white }, W / 2, H / 2 - ch * 0.05, cw * 0.8, { bars: LOGO_COLS, textColor: C.ink, rise: riseIn(t, 1.5), text: seg(t, 1.9, 2.8) });
        if (!g.noSub) boxText(g, S.sub, W / 2, H / 2 + ch / 2 + 24 * u, 50 * u, { bg: C.pink, fg: C.white, align: 'center', reveal: seg(t, 2.6, 3.4) });
      }
    },
  },
  muster: {
    name: 'Bogen-Muster', dur: 11,
    draw(g, t, d) {
      const { W, H, u, ctx } = g, L = layout(g);
      const cell = 64 * u, bw = 30 * u;
      const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 2;
      const cols5 = g.st.bg === 'scene' || g.st.bg === 'grad' || g.st.bg === C.pink ? [C.white] : LOGO_COLS;
      const w1 = om(g, d, 1.8);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cell + (r % 2) * cell * 0.5 - cell * 0.25;
          const wave = 0.5 + 0.5 * Math.sin(t * w1 - (c + r) * 0.32);
          const q = (c + r) / (cols + rows);
          const appear = g.seamless ? 1 : easeOutBack(seg(t, q * 1.4, 0.6 + q * 1.4));
          const h = (bw * 0.6 + bw * 1.5 * wave) * appear;
          ctx.globalAlpha = 0.25 + 0.75 * wave;
          // Farbe haengt nur vom Platz ab, die Bewegung kommt allein aus der Welle
          fillArch(ctx, x, r * cell + cell - h, bw, h, cols5[(c + r * 2) % cols5.length]);
        }
      }
      ctx.globalAlpha = 1;
      const cw = W * (L.portrait ? 0.84 : 0.46), ch = cw * 0.34;
      ctx.fillStyle = g.bgNow || C.night;
      const r = g.seamless ? 1 : easeOutBack(seg(t, 1.2, 2));
      ctx.fillRect(W / 2 - (cw / 2) * r, H / 2 - (ch / 2) * r, cw * r, ch * r);
      if (r > 0.9) drawLogo(g, W / 2, H / 2, cw * 0.8, { text: g.seamless ? 1 : seg(t, 1.8, 2.6) });
    },
  },
  konfetti: {
    name: 'Bogen-Konfetti', dur: 9,
    draw(g, t) {
      const { W, H, u, ctx } = g;
      const mono = g.st.bg === 'scene' || g.st.bg === 'grad' || g.st.bg === C.pink;
      for (let i = 0; i < 90; i++) {
        const w = (14 + hash(i) * 22) * u, h = w * (1.6 + hash(i + 3) * 1.2);
        const sp = (120 + hash(i + 7) * 200) * u;
        const y = ((hash(i + 11) * (H + 300 * u) + t * sp) % (H + 300 * u)) - 150 * u;
        const x = hash(i + 13) * W + Math.sin(t * (0.8 + hash(i) * 1.2) + i) * 40 * u;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (hash(i + 17) - 0.5) * 3 + i);
        ctx.globalAlpha = seg(t, hash(i + 19) * 1.2, hash(i + 19) * 1.2 + 0.4);
        if (i % 7 === 0) { heartPath(ctx, 0, 0, w * 0.7); ctx.fillStyle = mono ? C.white : C.pink; ctx.fill(); }
        else fillArch(ctx, -w / 2, -h / 2, w, h, mono ? C.white : RAINBOW[i % 6]);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      SCENES.headline.draw({ ...g, noDeco: true }, t - 0.6, 7, S.title);
    },
  },
  ticker: {
    name: 'Laufschrift', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g;
      const words = [S.title, S.motto, S.kicker, S.url].filter(Boolean);
      const size = 140 * u, rowH = size * 1.55;
      const rows = Math.ceil(H / rowH) + 2;
      const strip = tickerStrips(g, words.map((w) => w + '  •  ').join(''), size);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.08);
      for (let r = 0; r < rows; r++) {
        const y = (r - rows / 2) * rowH;
        const dir = r % 2 ? -1 : 1;
        const tw = strip.tw;
        const x = -W * 1.5 - ((((t * 150 * u * dir) % tw) + tw) % tw);
        const a = seg(t, r * 0.08, 0.6 + r * 0.08);
        const filled = r % 3 === 1;
        if (filled) {
          ctx.globalAlpha = a;
          ctx.fillStyle = g.st.boxA;
          ctx.fillRect(-W * 1.5, y - size * 0.95, W * 3, size * 1.25);
        } else ctx.globalAlpha = a * 0.8;
        // vorgerenderte Textstreifen nur noch verschieben, statt riesige Schrift jedes Bild neu zu setzen
        const img = filled ? strip.fill : strip.stroke;
        for (let xx = x; xx < W * 1.5; xx += tw) ctx.drawImage(img, xx - strip.pad, y - strip.base, tw + strip.pad * 2, strip.h);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },
  // Haltung: Parolen nacheinander, gross und laut, danach Logo und Website
  danke: {
    name: 'Haltung', dur: () => lines(S.slogans).length * 2.3 + 4 + LEAD,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const list = lines(S.slogans);
      const per = 2.3;
      const bgs = [C.pink, C.purple, C.night, C.pink, C.blue, C.green];
      t -= LEAD;
      if (t < 0) { ctx.fillStyle = bgs[0]; ctx.fillRect(0, 0, W, H); g.bgNow = bgs[0]; return; }
      if (t < list.length * per) {
        const i = Math.floor(t / per), f = (t % per) / per;
        ctx.fillStyle = bgs[i % bgs.length];
        ctx.fillRect(0, 0, W, H);
        g.bgNow = bgs[i % bgs.length];
        // Streifen im Hintergrund fahren einmal durch
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = C.white;
        for (let k = -2; k < 8; k++) ctx.fillRect((k * 0.18 + f * 0.18) * W, 0, W * 0.06, H);
        ctx.restore();
        const size = (L.portrait ? 150 : 190) * u;
        const ls = wrap(g, list[i], size, W - L.m * 2);
        const lh = size * 1.3;
        const y0 = H / 2 - (ls.length * lh) / 2;
        const out = easeIn(seg(f, 0.88, 1));
        ls.forEach((l, j) => boxText(g, l, W / 2 + out * W * 0.08, y0 + j * lh, size, {
          bg: C.white, fg: bgs[i % bgs.length] === C.night ? C.pink : bgs[i % bgs.length], align: 'center', reveal: seg(f, 0.02 + j * 0.06, 0.3 + j * 0.06) * (1 - out),
        }));
        return;
      }
      const tt = t - list.length * per;
      decoBars(g, L.m, H + 8 * u, 60 * u, H * 0.4, g.st.deco, tt, seg(tt, 0.1, 1.4));
      decoBars(g, W - L.m - 5 * 60 * u * 1.3 + 18 * u, H + 8 * u, 60 * u, H * 0.4, g.st.deco, tt + 1, seg(tt, 0.3, 1.6));
      drawLogo(g, W / 2, H * 0.42, W * (L.portrait ? 0.7 : 0.42), { rise: riseIn(tt, 0.2), text: seg(tt, 0.7, 1.5) });
      boxText(g, S.url, W / 2, H * 0.42 + W * 0.07 + 30 * u, 60 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(tt, 1.2, 2) });
    },
  },
  loader: {
    name: 'Laden', dur: 8,
    draw(g, t, d) {
      const { W, H, u, ctx } = g, L = layout(g);
      const lw = W * (L.portrait ? 0.7 : 0.36);
      const w1 = om(g, d, 5);
      drawLogo(g, W / 2, H * 0.44, lw, { dip: [0, 1, 2, 3, 4].map((i) => (0.5 + 0.5 * Math.sin(t * w1 - i * 0.9)) * 0.45), rise: g.seamless ? undefined : riseIn(t, 0, 0.1, 0.7) });
      const dots = '•••'.slice(0, 1 + (Math.floor(t * 2.5) % 3));
      boxText(g, `${S.sub} ${dots}`, W / 2, H * 0.44 + lw * 0.12 + 40 * u, 48 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: g.seamless ? 1 : seg(t, 0.4, 1.2) });
      const pw = W * 0.3, px = (W - pw) / 2, py = H * 0.82;
      ctx.fillStyle = g.st.fg === C.ink ? 'rgba(54,55,56,0.1)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(px, py, pw, 8 * u);
      const f = ((t * (g.seamless ? Math.max(1, Math.round(0.22 * d)) / d : 0.22)) % 1);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = RAINBOW[i]; ctx.fillRect(px + (pw / 6) * i, py, (pw / 6) * clamp(f * 6 - i), 8 * u); }
    },
  },

  // --- Darmstadt -----------------------------------------------------------
  punktwand: {
    name: 'Punktwand', dur: 16,
    draw(g, t) {
      const ws = ensureWall(g);
      WALL.draw(g.ctx, t, ws);
      g.bgNow = ws.mode === 'weiss' ? C.pink : '#060407';
    },
  },
  skyline: {
    name: 'Darmstadt-Skyline', dur: 11,
    draw(g, t, d) {
      const { W, H, u, ctx } = g, L = layout(g);
      const keys = L.portrait ? ['ludwig', 'turm', 'kapelle', 'weiss'] : ['wald', 'darm', 'loewen', 'ludwig', 'weiss', 'turm', 'kapelle', 'kirche', 'schloss', 'theater'];
      const base = H * (L.portrait ? 0.7 : 0.8);
      // Sonne hinter dem Hochzeitsturm
      const sr = Math.min(W, H) * 0.2 * easeOutBack(seg(t, 0.2, 1.4));
      ctx.fillStyle = g.st.deco;
      ctx.beginPath(); ctx.arc(W / 2, base - H * 0.28, sr, 0, 7); ctx.fill();
      // Herzen steigen auf
      for (let i = 0; i < 14; i++) {
        const p = ((t * 0.08 + hash(i)) % 1);
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8 * seg(t, 2, 3);
        heartPath(ctx, hash(i + 5) * W, base - p * base * 0.95, (10 + hash(i + 9) * 14) * u);
        ctx.fillStyle = [C.pink, C.rose, C.purple][i % 3];
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const order = keys.map((k, i) => Math.abs(i - keys.indexOf('turm')));
      const per = Math.max(0.8, (d - 4) / keys.length);
      const hi = t > 3 ? Math.floor((t - 3) / per) % keys.length : -1;
      const hf = t > 3 ? ((t - 3) % per) / per : 0;
      const pop = Math.sin(clamp(hf) * Math.PI);
      const info = skyline(g, keys, W / 2, base, W - L.m * 1.2, H * (L.portrait ? 0.45 : 0.55), {
        rise: (i) => easeOutBack(seg(t, 0.3 + order[i] * 0.18, 1.2 + order[i] * 0.18)),
        lift: (i) => (i === hi ? pop * 0.05 : 0),
      });
      if (hi >= 0) {
        const b = info[hi];
        ctx.globalAlpha = pop;
        heartPath(ctx, b.x + b.w / 2, base - b.h - 30 * u - hf * 50 * u, 16 * u);
        ctx.fillStyle = g.st.sky === C.white ? C.white : C.pink;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = g.st.sky;
      ctx.fillRect(0, base, W * easeOutExpo(seg(t, 0, 1)), 5 * u);
      // Namen nur auf Wunsch (Menue), sonst reicht die Hervorhebung beim Zeichnen
      if (t > 3 && !L.portrait && S.skyNames === 'an') {
        const n = info.length, per = Math.max(0.8, (sceneDur('skyline') - 4) / n);
        const idx = Math.floor((t - 3) / per) % n, f = ((t - 3) % per) / per;
        const b = info[idx];
        const a = seg(f, 0, 0.15) * (1 - seg(f, 0.85, 1));
        const lx = clamp(b.x + b.w / 2, L.m + 160 * u, W - L.m - 160 * u);
        boxText(g, b.name, lx, base + 22 * u, 40 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: a });
      }
      kicker(g, 'Queeres Darmstadt', W / 2, L.m, 30 * u, g.st.fg, 'center', seg(t, 1, 2.4));
      boxText(g, S.kicker, W / 2, L.m + 30 * u, 64 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 1.6, 2.6) });
    },
  },
  skylineLinie: {
    name: 'Skyline als Linie', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const keys = L.portrait ? ['turm', 'kapelle', 'ludwig'] : ['ludwig', 'weiss', 'turm', 'kapelle', 'kirche', 'schloss'];
      const base = H * 0.72;
      skyline(g, keys, W / 2, base, W - L.m * 2, H * 0.55, { line: true, draw: (i) => seg(t, 0.2 + i * 0.35, 3.2 + i * 0.35), color: g.st.fg });
      ctx.fillStyle = g.st.fg;
      ctx.fillRect(W / 2 - (W / 2 - L.m) * easeOutExpo(seg(t, 0, 1.2)), base, (W - L.m * 2) * easeOutExpo(seg(t, 0, 1.2)), 3 * u);
      drawLogo(g, W / 2, base + 110 * u, (L.portrait ? 0.6 : 0.3) * W, { rise: riseIn(t, 3.4), text: seg(t, 4, 4.8) });
    },
  },

  // --- Queer, Pride, Liebe -------------------------------------------------
  flaggen: {
    name: 'Pride-Flaggen', dur: 20,
    draw(g, t, d) {
      const { W, H, u, ctx } = g, L = layout(g);
      const list = ['progress', 'trans', 'bi', 'lesbisch', 'enby', 'pan', 'ace', 'inter', 'regenbogen'];
      const per = d / list.length;
      // ausserhalb des nahtlosen Loops: nach dem Ende bleibt die letzte Flagge stehen, bis zugedeckt wird
      const tl = g.seamless ? t : Math.min(t, d - 0.001);
      const i = Math.floor(tl / per) % list.length, f = (tl % per) / per;
      const leaves = g.seamless || i < list.length - 1;
      const fw = W * (L.portrait ? 0.8 : 0.52);
      // weich rein und raus, sonst wirken die ersten Frames wie Ruckler
      const fx = (W - fw) / 2 + (1 - easeInOut(clamp(f / 0.2))) * W * 0.75 - (leaves ? easeInOut(seg(f, 0.82, 1)) * W * 0.75 : 0);
      const fy = H * 0.44 - (fw * FLAG_AR) / 2;
      // Fahnenstange
      ctx.fillStyle = g.st.fg;
      ctx.fillRect(fx - 12 * u, fy - 20 * u, 10 * u, H);
      wavingFlag(g, list[i], fx, fy, fw, t, 0.04, om(g, d, 3.2));
      // Label kommt nach der Flagge und geht mit ihr: einblenden, dann weich ausblenden und mitfahren
      const labOut = leaves ? easeInOut(seg(f, 0.72, 0.88)) : 0;
      ctx.save();
      ctx.globalAlpha = 1 - labOut;
      ctx.translate(-labOut * 90 * u, 0);
      boxText(g, FLAGS[list[i]].name, W / 2, fy + fw * FLAG_AR + 50 * u, 60 * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(f, 0.14, 0.34) });
      ctx.restore();
      kicker(g, S.motto, W / 2, L.m, 30 * u, g.st.fg, 'center', g.seamless ? 1 : seg(t, 0.4, 2));
    },
  },
  progress: {
    name: 'Progress-Flagge', dur: 8,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const stripes = FLAGS.progress.stripes;
      for (let i = 0; i < 6; i++) {
        const k = easeOutExpo(seg(t, i * 0.1, 0.9 + i * 0.1));
        ctx.fillStyle = stripes[i];
        ctx.fillRect(W * (1 - k), (i * H) / 6, W, H / 6 + 1);
      }
      ctx.save();
      drawChevrons(ctx, H, seg(t, 1, 2.8));
      ctx.restore();
      const words = S.motto;
      const size = (L.portrait ? 110 : 130) * u;
      const ls = wrap(g, words, size, W * 0.6);
      ls.forEach((l, j) => boxText(g, l, W - L.m, H * 0.5 - (ls.length * size * 1.3) / 2 + j * size * 1.3, size, { bg: C.white, fg: C.pink, align: 'right', from: 'right', reveal: seg(t, 3 + j * 0.3, 3.9 + j * 0.3) }));
      kicker(g, 'CSD Darmstadt', W - L.m, H * 0.5 - (ls.length * size * 1.3) / 2 - 30 * u, 28 * u, C.white, 'right', seg(t, 3.6, 4.8));
    },
  },
  herzen: {
    name: 'Herzen', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const pinks = [C.pink, C.rose, C.magenta, '#F06292', C.purple, C.white];
      for (let i = 0; i < 60; i++) {
        const sp = 0.05 + hash(i) * 0.08;
        const p = ((t * sp + hash(i + 2)) % 1);
        const x = hash(i + 4) * W + Math.sin(t * 1.2 + i) * 30 * u;
        const s = (14 + hash(i + 6) * 40) * u;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9 * seg(t, hash(i) * 1.5, hash(i) * 1.5 + 0.5);
        heartPath(ctx, x, H + 80 * u - p * (H + 160 * u), s);
        ctx.fillStyle = pinks[i % pinks.length] === g.bgNow ? C.white : pinks[i % pinks.length];
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // grosses pulsierendes Herz mit Logo-Balken
      const beat = 1 + 0.06 * Math.pow(Math.max(0, Math.sin(t * 5.2)), 12) + 0.04 * Math.pow(Math.max(0, Math.sin(t * 5.2 - 0.5)), 12);
      const hs = Math.min(W, H) * 0.24 * easeOutBack(seg(t, 0.3, 1.3)) * beat;
      heartPath(ctx, W / 2, H * 0.42, hs);
      ctx.fillStyle = g.bgNow === C.pink ? C.white : C.pink;
      ctx.fill();
      ctx.save();
      heartPath(ctx, W / 2, H * 0.42, hs);
      ctx.clip();
      const bw = hs * 0.22;
      const hs5 = [0.48, 0.74, 1, 0.74, 0.48];
      for (let i = 0; i < 5; i++) {
        const h = hs * 0.9 * hs5[i] * easeOutBack(seg(t, 1 + i * 0.1, 1.8 + i * 0.1));
        fillArch(ctx, W / 2 - bw * 3.1 + i * bw * 1.3, H * 0.42 + hs * 0.55 - h, bw, h, g.bgNow === C.pink ? LOGO_COLS[i] : C.white);
      }
      ctx.restore();
      boxText(g, S.love, W / 2, H * 0.42 + hs * 1.1, (L.portrait ? 96 : 110) * u, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 1.8, 2.7) });
    },
  },
  motto: {
    name: 'Motto laut', dur: () => lines(S.motto.replace(/\s+/g, '\n')).length * 0.55 + 4.5 + LEAD,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      t -= LEAD;
      if (t < 0) { ctx.fillStyle = C.pink; ctx.fillRect(0, 0, W, H); g.bgNow = C.pink; return; }
      const words = S.motto.split(/\s+/).filter(Boolean);
      const per = 0.55;
      const flashEnd = words.length * per;
      if (t < flashEnd) {
        // Wort fuer Wort, bildschirmfuellend, wechselnde Farben
        const i = Math.floor(t / per), f = (t % per) / per;
        const bgs = [C.pink, C.purple, C.pink, C.blue, C.pink, C.green];
        ctx.fillStyle = bgs[i % bgs.length];
        ctx.fillRect(0, 0, W, H);
        const w = words[i];
        font(ctx, 100, 700);
        const size = Math.min((W * 0.86 * 100) / mw(ctx, w), H * 0.5);
        font(ctx, size * (0.92 + 0.08 * easeOutBack(clamp(f * 3))), 700);
        ctx.fillStyle = C.white;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w, W / 2, H / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        return;
      }
      const tt = t - flashEnd;
      ctx.fillStyle = C.pink;
      ctx.fillRect(0, 0, W, H);
      g.bgNow = C.pink;
      decoBars(g, W - L.m - 5 * 80 * u, H + 8 * u, 80 * u, H * 0.6, 'rgba(255,255,255,0.14)', tt, seg(tt, 0, 1.2));
      const size = (L.portrait ? 130 : 160) * u;
      const ls = wrap(g, S.motto, size, W - L.m * 2.4);
      ls.forEach((l, j) => boxText(g, l, L.m, H / 2 - (ls.length * size * 1.3) / 2 + j * size * 1.3, size, { bg: C.white, fg: C.pink, reveal: seg(tt, j * 0.2, 0.8 + j * 0.2) }));
      drawLogo(g, L.m + 170 * u, H - L.m, 340 * u, { rise: riseIn(tt, 0.6), text: seg(tt, 1, 1.8) });
    },
  },
  sprechblasen: {
    name: 'Sprechblasen', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const items = lines(S.bubbles).slice(0, 8);
      const cols = [C.pink, C.blue, C.green, C.purple, C.orange, C.yellow];
      const spots = L.portrait
        ? [[0.3, 0.14], [0.68, 0.22], [0.26, 0.33], [0.7, 0.42], [0.32, 0.52], [0.66, 0.61], [0.3, 0.7], [0.7, 0.78]]
        : [[0.18, 0.2], [0.5, 0.14], [0.8, 0.22], [0.26, 0.42], [0.74, 0.44], [0.16, 0.62], [0.52, 0.58], [0.84, 0.64]];
      items.forEach((txt, i) => {
        const [sx, sy] = spots[i % spots.length];
        const a = easeOutBack(seg(t, 0.3 + i * 0.35, 0.9 + i * 0.35));
        if (a <= 0) return;
        const size = 52 * u;
        font(ctx, size, 700);
        const tw = mw(ctx, txt) + size * 0.8, th = size * 1.5;
        const x = sx * W, y = sy * H + Math.sin(t * 1.4 + i) * 8 * u;
        const col = cols[i % cols.length] === g.bgNow ? C.white : cols[i % cols.length];
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(a, a);
        ctx.fillStyle = col;
        ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.beginPath();
        const side = i % 2 ? 1 : -1;
        ctx.moveTo(side * tw * 0.2, th / 2 - 1); ctx.lineTo(side * tw * 0.32, th / 2 + th * 0.4); ctx.lineTo(side * tw * 0.05, th / 2 - 1);
        ctx.fill();
        ctx.fillStyle = col === C.yellow || col === C.white ? C.ink : C.white;
        ctx.textAlign = 'center';
        ctx.fillText(txt, 0, size * 0.36);
        ctx.restore();
      });
      const hs = (L.portrait ? 84 : 100) * u;
      const ls = wrap(g, S.bubblesTitle, hs, W - L.m * 2);
      ls.forEach((l, j) => boxText(g, l, W / 2, H - L.m - (ls.length - j) * hs * 1.3, hs, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 0.6 + items.length * 0.35 + j * 0.2, 1.4 + items.length * 0.35 + j * 0.2) }));
    },
  },
  gruppen: {
    name: 'Gruppen-Wolke', dur: 12,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const items = lines(S.groups);
      const ncol = L.portrait ? 2 : 4;
      const colW = W / ncol;
      const cols = [C.pink, C.purple, C.blue, C.green, C.orange, C.yellow];
      for (let c = 0; c < ncol; c++) {
        const dir = c % 2 ? 1 : -1;
        const speed = (40 + c * 9) * u;
        const size = 36 * u, gap = 34 * u;
        const colItems = items.filter((_, i) => i % ncol === c);
        const rowH = size * 1.3 + gap;
        const loopH = Math.max(colItems.length, 1) * rowH;
        for (let rep = -1; rep <= Math.ceil(H / loopH) + 1; rep++) {
          colItems.forEach((txt, j) => {
            let y = rep * loopH + j * rowH + ((t * speed * dir) % loopH);
            if (y < -rowH || y > H + rowH) return;
            const col = cols[(c + j) % cols.length];
            const bg = col === g.bgNow ? C.white : col;
            boxText(g, txt, c * colW + colW / 2, y, size, { bg, fg: bg === C.yellow || bg === C.white ? C.ink : C.white, align: 'center', reveal: seg(t, 0.2 + c * 0.15 + j * 0.05, 0.9 + c * 0.15 + j * 0.05) });
          });
        }
      }
      const cw = W * (L.portrait ? 0.84 : 0.44), ch = cw * 0.42;
      const r = easeOutBack(seg(t, 1.2, 2.1));
      ctx.fillStyle = g.bgNow || C.night;
      ctx.fillRect(W / 2 - (cw / 2) * r, H / 2 - (ch / 2) * r, cw * r, ch * r);
      if (r > 0.9) {
        drawLogo(g, W / 2, H / 2 - ch * 0.12, cw * 0.78, { rise: riseIn(t, 1.6), text: seg(t, 2, 2.8) });
        kicker(g, 'Alles vielbunt', W / 2, H / 2 + ch * 0.32, 30 * u, g.st.fg, 'center', seg(t, 2.4, 3.6));
      }
    },
  },
  wellen: {
    name: 'Pinke Wellen', dur: 10,
    draw(g, t) {
      const { W, H, u, ctx } = g, L = layout(g);
      const layers = [C.magenta, C.pink, '#F06292', C.rose, C.purple];
      layers.forEach((col, i) => {
        const yb = H * (0.45 + i * 0.12);
        const a = easeOutExpo(seg(t, i * 0.15, 1 + i * 0.15));
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, yb + (1 - a) * H + Math.sin(x / (180 * u) + t * (1 + i * 0.3) + i) * 40 * u + Math.sin(x / (70 * u) - t * 1.7) * 12 * u);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = col === g.bgNow ? C.white : col;
        ctx.globalAlpha = 0.92;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      const size = (L.portrait ? 120 : 150) * u;
      const ls = wrap(g, S.love, size, W - L.m * 2);
      ls.forEach((l, j) => boxText(g, l, W / 2, H * 0.22 + j * size * 1.3, size, { bg: g.st.boxA, fg: g.st.boxAText, align: 'center', reveal: seg(t, 1 + j * 0.25, 1.9 + j * 0.25) }));
      kicker(g, S.kicker, W / 2, H * 0.22 - 30 * u, 28 * u, g.st.fg, 'center', seg(t, 1.5, 3));
    },
  },
};

// Textstreifen fuer die Laufschrift einmal als Bild rendern (Kontur und gefuellt)
let tickerCache = null;
function tickerStrips(g, str, size) {
  const key = [str, size, g.k, g.st.fg, g.st.boxAText, g.u].join('|');
  if (tickerCache && tickerCache.key === key) return tickerCache;
  const m = document.createElement('canvas').getContext('2d');
  font(m, size, 700);
  const tw = m.measureText(str).width;
  const pad = size * 0.2, base = size * 1.05, h = size * 1.4;
  const make = (fill) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil((tw + pad * 2) * g.k);
    c.height = Math.ceil(h * g.k);
    const x = c.getContext('2d');
    x.scale(g.k, g.k);
    font(x, size, 700);
    x.textBaseline = 'alphabetic';
    if (fill) { x.fillStyle = g.st.boxAText; x.fillText(str, pad, base); }
    else { x.strokeStyle = g.st.fg; x.lineWidth = 2.5 * g.u; x.lineJoin = 'round'; x.strokeText(str, pad, base); }
    return c;
  };
  tickerCache = { key, tw, pad, base, h, fill: make(true), stroke: make(false) };
  return tickerCache;
}

// ---------------------------------------------------------------------------
// Uebergaenge

const TRANSITIONS = {
  balken: {
    name: 'Logo-Balken',
    draw(g, phase, q) {
      const { ctx, W, H } = g;
      const n = 5, bw = W / n + 2, cap = bw / 2;
      for (let i = 0; i < n; i++) {
        // Welle laeuft beim Zu- und Aufdecken von links nach rechts
        const k = easeInOut(clamp(q * 1.35 - i * 0.08));
        if (phase === 'in') { const top = H - (H + cap + 4) * k; fillArch(ctx, i * (W / n) - 1, top, bw, H - top + 2, LOGO_COLS[i]); }
        else fillArch(ctx, i * (W / n) - 1, -cap - 4 - (H + cap + 4) * k, bw, H + cap + 6, LOGO_COLS[i]);
      }
    },
  },
  streifen: {
    name: 'Farbstreifen',
    draw(g, phase, q) {
      const { ctx, W, H } = g;
      const n = 6, tw = W / n;
      for (let i = 0; i < n; i++) {
        const k = easeInOut(clamp(q * 1.4 - i * 0.07));
        const h = H * (phase === 'in' ? k : 1 - k);
        ctx.fillStyle = RAINBOW[i];
        const fromTop = (i % 2 === 0) === (phase === 'in');
        ctx.fillRect(i * tw, fromTop ? 0 : H - h, tw + 1, h);
      }
    },
  },
  diagonal: {
    name: 'Diagonal',
    draw(g, phase, q) {
      const { ctx, W, H } = g;
      const n = 6, span = W + H * 2;
      for (let i = 0; i < n; i++) {
        const k = easeInOut(clamp(q * 1.4 - i * 0.07));
        // kraeftig ueberlappen, sonst schimmert an den Schraegkanten die Szene darunter durch
        const bw = span / n + 10;
        const shift = phase === 'in' ? -span * (1 - k) : span * k;
        const a = shift + i * (span / n) - H;
        ctx.fillStyle = RAINBOW[i];
        ctx.beginPath();
        ctx.moveTo(a, H); ctx.lineTo(a + H, 0); ctx.lineTo(a + H + bw, 0); ctx.lineTo(a + bw, H);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  kreis: {
    name: 'Kreise',
    draw(g, phase, q) {
      const { ctx, W, H } = g;
      const R = Math.hypot(W, H) / 2 + 20;
      for (let i = 0; i < 5; i++) {
        // beim Aufdecken oeffnet die oberste Farbe zuerst, darunter werden die Ringe sichtbar
        const k = easeInOut(clamp(q * 1.3 - (phase === 'in' ? i : 4 - i) * 0.07));
        ctx.fillStyle = LOGO_COLS[i];
        ctx.beginPath();
        if (phase === 'in') ctx.arc(W / 2, H / 2, R * k, 0, Math.PI * 2);
        else { ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, R * k, 0, Math.PI * 2, true); }
        ctx.fill('evenodd');
      }
    },
  },
  herz: {
    name: 'Herz',
    draw(g, phase, q) {
      const { ctx, W, H } = g;
      const big = Math.hypot(W, H) * 1.1;
      const cols = [C.rose, C.pink];
      cols.forEach((col, i) => {
        const k = easeInOut(clamp(q * 1.25 - (phase === 'in' ? i : 1 - i) * 0.12));
        ctx.fillStyle = col;
        if (phase === 'in') { heartPath(ctx, W / 2, H / 2 + big * 0.15 * k, big * k); ctx.fill(); }
        else {
          ctx.beginPath();
          ctx.rect(0, 0, W, H);
          const s = big * k;
          ctx.moveTo(W / 2, H / 2 + s * 0.9 + big * 0.15 * k);
          ctx.bezierCurveTo(W / 2 + s * 1.6, H / 2 - s * 0.1, W / 2 + s * 0.9, H / 2 - s * 1.3, W / 2, H / 2 - s * 0.55);
          ctx.bezierCurveTo(W / 2 - s * 0.9, H / 2 - s * 1.3, W / 2 - s * 1.6, H / 2 - s * 0.1, W / 2, H / 2 + s * 0.9 + big * 0.15 * k);
          ctx.fill('evenodd');
        }
      });
    },
  },
};
const TRANS_KEYS = Object.keys(TRANSITIONS);

// ---------------------------------------------------------------------------
// Vorlagen

const TEMPLATES = {
  showreel: { name: 'Showreel', hint: 'Alle Szenen, gut 2 Minuten. Als langer Loop auf Events.', loop: true, noSub: true, scenes: ['logoZoom', 'skyline', 'punktwand', 'headline', 'progress', 'flaggen', 'equalizer', 'kacheln', 'herzen', 'pride', 'termin', 'liste', 'sprechblasen', 'gruppen', 'muster', 'motto', 'wellen', 'ticker', 'konfetti', 'skylineLinie', 'statement', 'danke'] },
  darmstadt: { name: 'Darmstadt', hint: 'Skyline mit Hochzeitsturm, Langem Ludwig und Co., auch als Punktwand.', loop: true, scenes: ['skyline', 'punktwand', 'skylineLinie', 'logo'] },
  darmstadtPink: { name: 'Darmstadt pink', hint: 'Skyline in Weiß auf Pink.', loop: true, style: 'pink', scenes: ['skyline', 'herzen', 'skylineLinie'] },
  csd: { name: 'CSD', hint: 'Progress-Flagge, Pride-Flaggen, Motto.', loop: true, scenes: ['progress', 'flaggen', 'motto', 'pride'] },
  flaggen: { name: 'Pride-Flaggen', hint: 'Alle Flaggen wehen nacheinander, mit Namen. Nahtloser Loop.', loop: true, seamless: true, scenes: ['flaggen'] },
  liebe: { name: 'Liebe', hint: 'Viel Pink, Herzen, Wellen.', loop: true, style: 'rosa', scenes: ['herzen', 'wellen', 'konfetti'] },
  party: { name: 'Schrill und Laut', hint: 'Party-Look: laute Wörter, Equalizer, Konfetti.', loop: true, style: 'pink', scenes: ['motto', 'equalizer', 'konfetti', 'ticker'] },
  community: { name: 'Community', hint: 'Sprechblasen, Gruppen, Angebote.', loop: true, scenes: ['sprechblasen', 'gruppen', 'kacheln'] },
  introKurz: { name: 'Intro kurz', hint: 'Logo baut sich auf. Vor Videos.', loop: false, scenes: ['logo'] },
  introLang: { name: 'Intro lang', hint: 'Zoom ins Logo, Skyline, Headline.', loop: false, scenes: ['logoZoom', 'skyline', 'headline'] },
  warten: { name: 'Gleich geht’s los', hint: 'Wartebildschirm vor Veranstaltungen.', loop: true, scenes: ['logo', 'ticker', 'muster', 'equalizer', 'skyline'] },
  laden: { name: 'Laden', hint: 'Balken als Ladewelle. Nahtloser Loop.', loop: true, seamless: true, scenes: ['loader'] },
  countdown: { name: 'Countdown', hint: 'Zählt runter, danach „Los geht’s!“.', loop: false, scenes: ['countdown'] },
  termin: { name: 'Termine-Karussell', hint: 'Die nächsten Veranstaltungen nacheinander im Look der Insta-Kacheln.', loop: true, carousel: true, scenes: ['termin', 'liste'] },
  termine: { name: 'Terminliste', hint: 'Nächste Termine, wie die Insta-Kachel.', loop: true, scenes: ['liste', 'logo'] },
  ambient: { name: 'Ambient', hint: 'Ruhiges Bogen-Muster als Hintergrund. Nahtloser Loop ohne Übergang.', loop: true, seamless: true, scenes: ['muster'] },
  statement: { name: 'Statement', hint: 'Ein Satz, groß und deutlich.', loop: true, scenes: ['statement', 'logo'] },
  outro: { name: 'Haltung', hint: 'Parolen nacheinander, danach Logo und Website.', loop: true, scenes: ['danke'] },
};
const TPL_KEYS = Object.keys(TEMPLATES);

const TRANS_DUR = 0.75;
// schnelle Szenen warten mit dem ersten Wort, bis der Uebergang vorbei ist
// (im Kiosk gibt es keinen Wisch-Uebergang, dort sorgt der Vorlauf beim Einblenden dafuer)
const LEAD = window.__VB_EMBED ? 0 : 0.8;
function sceneDur(key) {
  const d = SCENES[key].dur;
  return (typeof d === 'function' ? d() : d) * S.stretch;
}
function timeline() {
  const tpl = TEMPLATES[S.template] || TEMPLATES.showreel;
  let acc = 0;
  const parts = tpl.scenes.map((k, i) => { const d = sceneDur(k); const p = { key: k, start: acc, dur: d, i }; acc += d; return p; });
  return { tpl, parts, total: acc };
}
function transFor(i) {
  if (S.transition !== 'mix') return TRANSITIONS[S.transition] || TRANSITIONS.balken;
  return TRANSITIONS[TRANS_KEYS[i % TRANS_KEYS.length]];
}

// ---------------------------------------------------------------------------
// Canvas in voller Aufloesung

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let recording = null;
// Aufloesung passt sich an: nur wenn Bilder spuerbar zu spaet kommen, wird mit weniger Pixeln
// gerechnet; laeuft es wieder rund, geht es zurueck auf volle Aufloesung. Schnelle Rechner merken nichts.
let QUALITY = 1;
const perf = { last: 0, n: 0, slow: 0, fast: 0, calm: 0, minDt: 1e9 };
function watchPerformance(now) {
  const dt = now - perf.last;
  perf.last = now;
  if (recording || paused || embedIdle || document.hidden || dt > 250) { perf.n = 0; perf.slow = 0; perf.fast = 0; return; }
  // schnellste je gemessene Bildfolge = Bildwiederholrate des Schirms (z. B. 4K-Fernseher mit 30 Hz)
  if (dt > 4) perf.minDt = Math.min(perf.minDt, dt);
  // nach einer Groessenaenderung erst einmal zwei Sekunden abwarten
  if (perf.calm > now) return;
  const refresh = Math.min(perf.minDt, 40);
  perf.n++;
  if (dt > Math.max(24, refresh * 1.45)) perf.slow++;
  if (dt < Math.max(18, refresh * 1.15)) perf.fast++;
  if (perf.n >= 120) {
    if (perf.slow > perf.n * 0.3 && QUALITY > 0.5) {
      QUALITY = Math.max(0.5, QUALITY * 0.85);
      sizeCanvas();
      perf.calm = now + 2000;
    } else if (perf.fast > perf.n * 0.97 && QUALITY < 1) {
      perf.good = (perf.good || 0) + 1;
      // erst nach laengerer ruhiger Phase wieder hochschalten
      if (perf.good >= 5) {
        QUALITY = Math.min(1, QUALITY / 0.85);
        sizeCanvas();
        perf.calm = now + 2000;
        perf.good = 0;
      }
    } else perf.good = 0;
    perf.n = 0; perf.slow = 0; perf.fast = 0;
  }
}
let G = null;

function sizeCanvas() {
  const f = FORMATS[S.format] || FORMATS.fill;
  const dpr = Math.min(3, devicePixelRatio || 1) * (recording ? 1 : QUALITY);
  let W, H, cssW, cssH;
  if (!f.w) {
    cssW = innerWidth; cssH = innerHeight;
    const L = 1080 / Math.min(cssW, cssH);
    W = cssW * L; H = cssH * L;
  } else {
    W = f.w; H = f.h;
    const s = Math.min(innerWidth / W, innerHeight / H);
    cssW = W * s; cssH = H * s;
  }
  let pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
  if (recording) { pw = f.w || Math.round(W / 2) * 2; ph = f.h || Math.round(H / 2) * 2; }
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  document.body.classList.toggle('checker', S.style === 'transparent');
  G = { ctx, W, H, u: Math.min(W, H) / 1080, k: pw / W, st: STYLES[S.style] || STYLES.hell };
  ensureWall(G);
}
addEventListener('resize', () => { if (!recording) sizeCanvas(); });

// ---------------------------------------------------------------------------
// Ablauf

let t0 = performance.now(), paused = false, pauseT = 0;
const now = () => (paused ? pauseT : ((performance.now() - t0) / 1000) * S.speed);
function restart() { t0 = performance.now(); pauseT = 0; }

function render(time) {
  const g = G;
  const { tpl, parts, total } = timeline();
  // einmalige Vorlagen bleiben am Ende nicht stehen: die letzte Szene laeuft weiter (wichtig fuers Ausblenden)
  const t = tpl.loop ? ((time % total) + total) % total : Math.max(0, time);
  const cur = parts.find((p) => t >= p.start && t < p.start + p.dur) || parts[parts.length - 1];
  g.ctx.setTransform(g.k, 0, 0, g.k, 0, 0);
  g.ctx.clearRect(0, 0, g.W, g.H);
  g.bgNow = null;
  g.seamless = !!tpl.seamless && parts.length === 1;
  g.noSub = !!tpl.noSub;
  sceneBg(g, cur.i);
  const lt = t - cur.start;
  g.ctx.save();
  SCENES[cur.key].draw(g, lt, cur.dur);
  g.ctx.restore();
  g.ctx.setTransform(g.k, 0, 0, g.k, 0, 0);
  g.ctx.globalAlpha = 1;
  g.ctx.setLineDash([]);
  if (EMBED) reportBg(g);
  const hasNext = tpl.loop || cur.i < parts.length - 1;
  const hasPrev = tpl.loop || cur.i > 0;
  if (!g.seamless && (parts.length > 1 || tpl.loop)) {
    if (hasNext && lt > cur.dur - TRANS_DUR) transFor((cur.i + 1) % parts.length).draw(g, 'in', (lt - (cur.dur - TRANS_DUR)) / TRANS_DUR);
    if (hasPrev && lt < TRANS_DUR) transFor(cur.i).draw(g, 'out', lt / TRANS_DUR);
  }
}

function frame(ts) {
  requestAnimationFrame(frame);
  watchPerformance(ts || performance.now());
  if (!LOGO || !G || embedIdle) return;
  render(now());
}

// ---------------------------------------------------------------------------
// Aufnahme als Video

function pickMime() {
  const list = S.style === 'transparent'
    ? ['video/webm;codecs=vp9', 'video/webm']
    : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
}
function record() {
  if (recording) return;
  const mime = pickMime();
  if (!mime) { toast('Aufnehmen geht in diesem Browser nicht'); return; }
  recording = true;
  sizeCanvas();
  const stream = cv.captureStream(60);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: cv.width > 2000 ? 40e6 : 16e6 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vielbunt-${S.template}-${S.format}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    recording = null;
    document.body.classList.remove('rec');
    sizeCanvas();
    toast('Video gespeichert');
  };
  paused = false;
  restart();
  rec.start();
  recording = rec;
  document.body.classList.add('rec');
  menu.classList.remove('open');
  const { total } = timeline();
  setTimeout(() => rec.stop(), (total / S.speed) * 1000 + 100);
  toast(`Aufnahme läuft (${Math.round(total / S.speed)} s)`);
}

// ---------------------------------------------------------------------------
// Verstecktes Menue (M)

const menu = document.getElementById('menu');
const TEXT_FIELDS = [
  ['kicker', 'Kicker (gesperrte Versalien)'], ['title', 'Headline'], ['sub', 'Unterzeile'],
  ['motto', 'Motto (CSD, Party)'], ['love', 'Liebes-Satz'], ['statement', 'Statement'],
  ['date', 'Datum'], ['time', 'Uhrzeit'], ['eventTitle', 'Veranstaltung'], ['place', 'Ort'],
  ['list', 'Terminliste (Datum | Titel, eine Zeile pro Termin)', true],
  ['tilesTitle', 'Kacheln: Überschrift'], ['tiles', 'Kacheln (eine pro Zeile)', true],
  ['bubblesTitle', 'Sprechblasen: Satz darunter'], ['bubbles', 'Sprechblasen (eine pro Zeile)', true],
  ['groups', 'Gruppen-Wolke (eine pro Zeile)', true],
  ['slogans', 'Haltung: Parolen (eine pro Zeile)', true], ['url', 'Website'],
];
function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

function buildMenu() {
  menu.innerHTML = '';
  const head = h('div', 'm-head', '<div class="m-kicker">vielbunt loop</div><div class="m-title">Motion im vielbunt-Stil</div>');
  const close = h('button', 'm-close', '×');
  close.onclick = () => menu.classList.remove('open');
  head.appendChild(close);
  menu.appendChild(head);
  const body = h('div', 'm-body');
  menu.appendChild(body);
  const sec = (title) => { const s = h('section', 'm-sec'); s.appendChild(h('h3', null, title)); body.appendChild(s); return s; };

  const s1 = sec('Vorlage');
  const grid = h('div', 'm-presets');
  const tileCols = [C.pink, C.yellow, C.green, C.blue, C.purple, C.orange];
  TPL_KEYS.forEach((k, i) => {
    const tp = TEMPLATES[k];
    const b = h('button', 'm-preset' + (S.template === k ? ' on' : ''), `<span class="n">${tp.loop ? 'Loop' : 'Einmal'}</span><span class="t">${tp.name}</span>`);
    b.style.setProperty('--tile', tileCols[i % 6]);
    b.title = tp.hint;
    b.onclick = () => { S.template = k; if (tp.style) S.style = tp.style; save(); restart(); sizeCanvas(); buildMenu(); };
    grid.appendChild(b);
  });
  s1.appendChild(grid);
  const { total } = timeline();
  s1.appendChild(h('div', 'm-hint', `${TEMPLATES[S.template]?.hint || ''} Dauer: ${Math.round(total / S.speed)} s`));

  const s2 = sec('Stil & Format');
  const styles = h('div', 'm-styles');
  for (const [k, st] of Object.entries(STYLES)) {
    const b = h('button', 'm-style' + (S.style === k ? ' on' : ''), st.name);
    b.style.background = k === 'bunt' ? `linear-gradient(90deg, ${RAINBOW.join(',')})` : k === 'verlauf' ? `linear-gradient(135deg, ${C.pink}, ${C.purple})` : k === 'transparent' ? 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0 / 12px 12px' : st.bg;
    b.style.color = st.fg;
    b.onclick = () => { S.style = k; save(); sizeCanvas(); buildMenu(); };
    styles.appendChild(b);
  }
  s2.appendChild(styles);
  const sel = (key, label, opts, after) => {
    const row = h('label', 'm-row', `<div class="m-lab"><span>${label}</span></div>`);
    const se = h('select');
    se.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    se.value = S[key];
    se.onchange = () => { S[key] = se.value; save(); after && after(); };
    row.appendChild(se);
    return row;
  };
  s2.appendChild(sel('format', 'Format', Object.entries(FORMATS).map(([k, f]) => [k, f.name]), sizeCanvas));
  s2.appendChild(sel('transition', 'Übergang', [['mix', 'Abwechselnd'], ...TRANS_KEYS.map((k) => [k, TRANSITIONS[k].name])]));
  for (const [key, label, min, max, step] of [['speed', 'Tempo', 0.5, 2, 0.05], ['stretch', 'Szenenlänge', 0.6, 2.5, 0.05], ['countdown', 'Countdown (Sekunden)', 3, 60, 1]]) {
    const row = h('label', 'm-row', `<div class="m-lab"><span>${label}</span><b>${S[key]}</b></div>`);
    const inp = h('input');
    Object.assign(inp, { type: 'range', min, max, step, value: S[key] });
    inp.oninput = () => { S[key] = +inp.value; row.querySelector('b').textContent = S[key]; save(); };
    row.appendChild(inp);
    s2.appendChild(row);
  }

  const sT = sec('Termine');
  sT.appendChild(sel('live', 'Terminliste', [['an', 'Live aus dem vielbunt-Kalender'], ['aus', 'Eigene Liste unten']], () => { refreshLive(); }));
  sT.appendChild(sel('terminAuto', 'Szene „Termin“', [['an', 'Automatisch die nächsten Veranstaltungen'], ['aus', 'Eigener Termin unten']]));
  {
    const row = h('label', 'm-row', `<div class="m-lab"><span>Termine im Karussell</span><b>${S.terminCount}</b></div>`);
    const inp = h('input');
    Object.assign(inp, { type: 'range', min: 1, max: 8, step: 1, value: S.terminCount });
    inp.oninput = () => { S.terminCount = +inp.value; row.querySelector('b').textContent = S.terminCount; save(); };
    row.appendChild(inp);
    sT.appendChild(row);
  }
  sT.appendChild(h('div', 'm-hint live-status', ''));
  sT.appendChild(sel('skyNames', 'Skyline: Namen der Gebäude', [['aus', 'Aus, nur hervorheben'], ['an', 'Einblenden']]));
  updateLiveStatus();

  const s3 = sec('Texte');
  for (const [key, label, multi] of TEXT_FIELDS) {
    const row = h('label', 'm-row', `<div class="m-lab"><span>${label}</span></div>`);
    const inp = h(multi ? 'textarea' : 'input');
    if (multi) inp.rows = 4;
    inp.value = S[key];
    inp.oninput = () => { S[key] = inp.value; save(); };
    row.appendChild(inp);
    s3.appendChild(row);
  }

  const s4 = sec('Ausgabe');
  const btns = h('div', 'm-btns');
  for (const [t, fn, cls] of [['Video aufnehmen (E)', record, 'primary'], ['Neu starten (R)', restart], ['Vollbild (F)', fullscreen], ['Link kopieren', copyLink], ['Texte zurücksetzen', resetTexts]]) {
    const b = h('button', 'm-btn ' + (cls || ''), t);
    b.onclick = fn;
    btns.appendChild(b);
  }
  s4.appendChild(btns);
  const keys = h('div', 'm-keys');
  keys.innerHTML = [['M', 'Menü'], ['← →', 'Vorlage'], ['1 bis 7', 'Stil'], ['R', 'Neu starten'], ['E', 'Aufnehmen'], ['F', 'Vollbild'], ['Leertaste', 'Pause'], ['. ,', 'Szene vor, zurück']].map(([a, b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`).join('');
  s4.appendChild(keys);
}
function updateLiveStatus() {
  const el = menu.querySelector('.live-status');
  if (!el) return;
  if (S.live !== 'an') el.textContent = 'Es wird die eigene Liste aus dem Feld „Terminliste“ gezeigt.';
  else if (LIVE.list) el.textContent = `${LIVE.list.length} Termine geladen, Stand ${LIVE.at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr. Wird alle 30 Minuten aktualisiert.`;
  else if (LIVE.error) el.textContent = 'Kalender gerade nicht erreichbar, es wird die eigene Liste gezeigt.';
  else el.textContent = 'Lade Termine …';
}
function resetTexts() { for (const [k] of TEXT_FIELDS) S[k] = DEFAULTS[k]; save(); buildMenu(); }
function copyLink() {
  const q = new URLSearchParams();
  for (const k of Object.keys(DEFAULTS)) if (S[k] !== DEFAULTS[k]) q.set(k, S[k]);
  navigator.clipboard?.writeText(location.href.split('?')[0] + '?' + q.toString()).then(() => toast('Link kopiert'));
}
function fullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}
function jumpScene(dir) {
  const { parts, total } = timeline();
  const t = ((now() % total) + total) % total;
  const i = parts.findIndex((p) => t >= p.start && t < p.start + p.dur);
  const next = parts[(i + dir + parts.length) % parts.length];
  t0 = performance.now() - (next.start / S.speed) * 1000;
  if (paused) pauseT = next.start;
  toast(SCENES[next.key].name);
}
const toastEl = document.getElementById('toast');
let toastT = 0;
function toast(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1800); }

// --- Einbettung: der Kiosk spielt einzelne Szenen ab ------------------------
// Szenen, die sich als Zwischenspiel eignen (die Terminuebersicht zeigt der Kiosk selbst)
const EMBED_SCENES = ['logoZoom', 'skyline', 'punktwand', 'headline', 'progress', 'flaggen', 'equalizer', 'kacheln', 'herzen', 'pride', 'termin', 'sprechblasen', 'gruppen', 'muster', 'motto', 'wellen', 'ticker', 'konfetti', 'skylineLinie', 'statement', 'danke'];
let embedIdle = EMBED;
// dem Kiosk die aktuelle Hintergrundfarbe melden, damit die Raender neben der 16:9-Flaeche mitgehen
let lastBg = '';
function reportBg(g) {
  const css = g.st.bg === 'grad' && g.bgNow === C.pink ? `linear-gradient(135deg, ${C.pink}, ${C.purple})` : g.bgNow || g.st.bg || '#000';
  if (css === lastBg || parent === window) return;
  lastBg = css;
  parent.postMessage({ type: 'vb-bg', css }, '*');
}
if (EMBED) {
  S.format = 'fill';
  addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'vb-play' && SCENES[m.scene]) {
      TEMPLATES.__embed = { name: 'Kiosk', hint: '', loop: false, noSub: true, scenes: [m.scene] };
      S.template = '__embed';
      if (m.style && STYLES[m.style]) S.style = m.style;
      sizeCanvas();
      paused = false;
      restart();
      // Vorlauf: waehrend der Kiosk einblendet, steht die Szene auf ihrem Startbild
      if (m.lead) t0 += m.lead * 1000;
      embedIdle = false;
    } else if (m.type === 'vb-stop') {
      embedIdle = true;
      lastBg = '';
    }
  });
}

addEventListener('keydown', (e) => {
  if (EMBED) return;
  if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k === 'm') menu.classList.toggle('open');
  else if (k === 'escape') menu.classList.remove('open');
  else if (k === 'r') restart();
  else if (k === 'e') record();
  else if (k === 'f') fullscreen();
  else if (k === '.') jumpScene(1);
  else if (k === ',') jumpScene(-1);
  else if (k === 'arrowright' || k === 'arrowleft') {
    const i = TPL_KEYS.indexOf(S.template);
    S.template = TPL_KEYS[(i + (k === 'arrowright' ? 1 : -1) + TPL_KEYS.length) % TPL_KEYS.length];
    if (TEMPLATES[S.template].style) S.style = TEMPLATES[S.template].style;
    save(); restart(); sizeCanvas(); buildMenu(); toast(TEMPLATES[S.template].name);
  } else if (k === ' ') {
    e.preventDefault();
    if (paused) { t0 = performance.now() - (pauseT / S.speed) * 1000; paused = false; } else { pauseT = now(); paused = true; }
  } else if (/^[1-7]$/.test(k)) {
    S.style = Object.keys(STYLES)[+k - 1]; save(); sizeCanvas(); buildMenu(); toast(STYLES[S.style].name);
  }
});

// Mauszeiger nach 3 Sekunden ohne Bewegung ausblenden
let idleTimer = 0;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!menu.classList.contains('open')) document.body.classList.add('idle'); }, 3000);
}
addEventListener('pointermove', wake);
addEventListener('pointerdown', wake);
wake();

(async () => {
  try { await Promise.all([document.fonts.load(`700 80px ${FONT}`), document.fonts.load(`400 80px ${FONT}`)]); } catch (e) { /* Ersatzschrift */ }
  prepareLogo();
  refreshLive();
  sizeCanvas();
  buildMenu();
  restart();
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
  // fuer Tests in der Konsole
  if (EMBED && parent !== window) {
    // dem Kiosk sagen, welche Szenen es gibt und wie lang sie dauern
    const scenes = EMBED_SCENES.map((k) => ({ key: k, name: SCENES[k].name, dur: sceneDur(k) }));
    parent.postMessage({ type: 'vb-ready', scenes }, '*');
  }
  window.__loop = { get quality() { return QUALITY; }, watchPerformance, S, LIVE, render, timeline, seek(t) { paused = true; pauseT = t; }, SCENES, sizeCanvas, buildMenu };
})();
