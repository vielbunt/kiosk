// Gemeinsame Bausteine der drei Barraum-Kioske (standard, queerbar, event).
// Haelt sich bewusst klein: kein Framework, immer nur ein Slide im DOM, keine Uebergaenge,
// weil der Pi Zero 2 W (425 MB RAM) sonst ins Ruckeln kommt.
(function () {
    'use strict';
    const S = window.BKSheet;
    const Q = new URLSearchParams(location.search);
    const BK = window.BK = { S, Q };

    const REFRESH_MS = 30 * 60 * 1000;        // Posts und Termine
    const WATCH_MS = 60 * 1000;               // Einstellungen (Modus)
    const SHEET_MS = 5 * 60 * 1000;           // uebrige Tabs
    const RELOAD_MS = 6 * 3600 * 1000;        // Seite komplett neu laden (Chromium wird mit der Zeit traege)
    const WP_API_URL = 'https://www.vielbunt.org/wp-json/wp/v2/posts';
    const ICS_URL = 'https://shy-recipe-d443.me-02a.workers.dev/';
    const LOOKAHEAD_DAYS = 90;
    const MAX_EVENTS = 8;
    const CAT_VERANSTALTUNG = 465, CAT_JUGEND = 578, CAT_QUEERBAR = 558;
    const startedAt = Date.now();

    // ---------- kleine Helfer ----------

    BK.el = function (tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    };
    const el = BK.el;
    // Der Pi hat keine Emoji-Schrift (Debian ohne fonts-noto-color-emoji), die Zeichen kaemen als Kaestchen. Deshalb raus.
    BK.clean = t => String(t == null ? '' : t).replace(/[\p{Extended_Pictographic}\u200d\ufe0f\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u20e3]/gu, '').replace(/\s{2,}/g, ' ').trim();
    BK.wait = ms => new Promise(r => setTimeout(r, ms));
    const fmtDate = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtTime = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    BK.today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

    async function fetchWithTimeout(url, ms = 30000, opts = {}) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), ms);
        try {
            const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
            if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
            return res;
        } finally { clearTimeout(id); }
    }
    BK.fetchWithTimeout = fetchWithTimeout;

    // Drive-Freigabelink in direkte Bildadresse umbauen, sonst unveraendert
    BK.imgUrl = function (u) {
        const n = String(u || '').trim();
        const drive = n.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
        if (drive) return 'https://lh3.googleusercontent.com/d/' + drive[1] + '=w1600';
        return n;
    };

    BK.preload = function (urls, ms = 8000) {
        return Promise.all(urls.map(url => new Promise(resolve => {
            const img = new Image();
            const done = () => resolve();
            img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(done);
            img.onerror = done;
            setTimeout(done, ms);
            img.src = url;
        })));
    };

    // ---------- Sheet ----------

    function cacheGet(k) { try { return localStorage.getItem('bk:' + k); } catch (e) { return null; } }
    function cacheSet(k, v) { try { localStorage.setItem('bk:' + k, v); } catch (e) { /* egal */ } }

    // Tab als CSV-Text: erst ueber den Worker (CORS auch von file:// aus), dann direkt bei Google.
    // Bei Fehlern der letzte gespeicherte Stand, sonst Fehler.
    BK.tab = async function (name) {
        const gid = S.GID[name];
        const urls = [];
        if (!Q.get('sheet')) urls.push(`${S.PROXY}${gid}?t=${Date.now()}`);
        urls.push(`https://docs.google.com/spreadsheets/d/${Q.get('sheet') || S.SHEET_ID}/export?format=csv&gid=${gid}&t=${Date.now()}`);
        let err;
        for (const url of urls) {
            try {
                const text = await (await fetchWithTimeout(url, 15000, { cache: 'no-store' })).text();
                if (/^\s*</.test(text)) throw new Error('Tab ' + name + ' liefert kein CSV');
                cacheSet('tab:' + name, text);
                return text;
            } catch (e) { err = e; }
        }
        const old = cacheGet('tab:' + name);
        if (old != null) return old;
        throw err;
    };

    // ---------- Modus-Weiche ----------

    // Prueft jede Minute die kleine Einstellungen-Tabelle. Aendert sich der Modus, wechselt die Seite.
    // onSettings(set, raw) kommt bei jeder Aenderung der Einstellungen (und einmal direkt am Anfang, wenn schon bekannt).
    BK.watchMode = function (current, onSettings) {
        let last = cacheGet('tab:einstellungen');
        const forced = Q.get('modus');
        if (last != null) onSettings(S.settings(last), last);
        async function tick() {
            try {
                const raw = await BK.tab('einstellungen');
                const set = S.settings(raw);
                BK.report('modus=' + set.modus + '&aktuell=' + current);
                if (!forced && set.modus !== current) {
                    const url = new URL(set.modus + '.html', location.href);
                    location.replace(url.href);
                    return;
                }
                if (raw !== last) { last = raw; onSettings(set, raw); }
            } catch (e) { console.warn('Einstellungen:', e.message); BK.report('fehler=' + encodeURIComponent('Einstellungen: ' + e.message)); }
        }
        tick();
        setInterval(tick, WATCH_MS);
    };

    // ---------- Posts (WordPress) ----------

    function decodeHtml(s) {
        const t = document.createElement('textarea');
        t.innerHTML = s;
        return t.value;
    }

    // aus dem srcset die kleinste Version nehmen, die fuer die Bildschirmhoehe noch reicht
    function pickSrc(img) {
        const w = +img.getAttribute('width'), h = +img.getAttribute('height');
        const need = w && h ? innerHeight * w / h : innerWidth / 2;
        const cands = (img.getAttribute('srcset') || '').split(',')
            .map(s => s.trim().split(/\s+/))
            .map(([url, size]) => ({ url, w: parseInt(size, 10) }))
            .filter(c => c.url && c.w)
            .sort((a, b) => a.w - b.w);
        const hit = cands.find(c => c.w >= need);
        return hit ? hit.url : img.getAttribute('src');
    }

    // "14.10.: Name", "05.-09.10. Name", "05.10. - 09.10. Name" -> { from, to, name }
    BK.parseTitle = function (title, today) {
        const t = decodeHtml(title || '').trim();
        const m = t.match(/^(\d{1,2})\.(?:(\d{1,2})\.)?(?:(\d{4})\.?)?\s*(?:[–—-]\s*(\d{1,2})\.(\d{1,2})\.(?:(\d{4}))?)?\s*:?\s*/);
        if (!m || !(m[2] || m[5])) return { from: null, to: null, name: BK.clean(t) };
        const d1 = +m[1], m1 = +(m[2] || m[5]), d2 = +(m[4] || m[1]), m2 = +(m[5] || m[2]);
        let y1 = +(m[3] || 0) || today.getFullYear();
        const hadYear = !!m[3];
        // ohne Jahr: liegt das Datum weit in der Vergangenheit, ist das naechste Jahr gemeint
        if (!hadYear && (today - new Date(y1, m1 - 1, d1)) / 864e5 > 180) y1++;
        const from = new Date(y1, m1 - 1, d1);
        let to = new Date(+(m[6] || 0) || y1, m2 - 1, d2);
        if (to < from) to = new Date(to.getFullYear() + 1, m2 - 1, d2);
        return { from, to, name: BK.clean(t.slice(m[0].length)) };
    };

    BK.fetchPosts = async function () {
        const today = BK.today();
        const since = new Date(today.getTime() - 21 * 864e5).toISOString();
        const res = await fetchWithTimeout(`${WP_API_URL}?after=${since}&per_page=100&_fields=title,content,categories,link`);
        const posts = await res.json();
        const out = [];
        for (const post of posts) {
            const title = post.title?.rendered || '';
            if (/abgesagt/i.test(title)) continue;
            const p = BK.parseTitle(title, today);
            if (p.to && p.to < today) continue; // schon vorbei
            const doc = new DOMParser().parseFromString(post.content.rendered, 'text/html');
            const imgs = Array.from(doc.querySelectorAll('img')).map(pickSrc).filter(Boolean);
            if (!imgs.length) continue;
            out.push({
                title: decodeHtml(title), name: p.name, from: p.from, to: p.to,
                // meist zwei Bilder pro Beitrag (Hauptbild und Zusatzbild), mehr braucht keiner
                images: imgs.length === 1 ? [imgs[0]] : [imgs[0], imgs[imgs.length - 1]],
                cats: post.categories || [], sortDate: p.from ? p.from.getTime() : 0
            });
        }
        return out.sort((a, b) => a.sortDate - b.sortDate);
    };

    // Beitraege fuers Sharepic-Karussell im Standard-Modus (ohne Queerbar, das ist ein Abendprogramm mit Alkohol)
    BK.standardPosts = posts => posts.filter(p => !p.cats.includes(CAT_QUEERBAR));

    // Woerter eines Titels zum Vergleichen (ohne Satzzeichen, nur ab 3 Buchstaben)
    const words = t => BK.clean(t).toLowerCase().split(/[^a-z0-9äöüß]+/).filter(w => w.length >= 3);
    const NO_EVENT = /wochenprogramm|jugendtreff|offener treff|treffbunt|villaq/i;

    // Das Event, das gerade stattfindet (oder per Datum/Suchwort aus dem Sheet gewaehlt wird).
    // Mehrere Events an einem Tag: Die Uhrzeit entscheidet. Der Kalender kennt Uhrzeiten, die WordPress-Beitraege nicht,
    // deshalb wird das laufende Kalender-Event dem passenden Beitrag zugeordnet (gleiche Woerter im Titel).
    // cal: Kalendertermine mit Uhrzeit, now: aktuelle Zeit (zum Testen ueberschreibbar)
    BK.findEvents = function (posts, ev, cal, now) {
        now = now || new Date();
        const today = BK.today();
        const isEvent = p => p.cats.includes(CAT_VERANSTALTUNG) && !p.cats.includes(CAT_JUGEND) && !NO_EVENT.test(p.title);
        const cands = posts.filter(p => p.from && isEvent(p));
        if (ev.suchwort) {
            const w = ev.suchwort.toLowerCase();
            const hit = posts.filter(p => p.title.toLowerCase().includes(w));
            if (hit.length) return { list: hit, tag: 'gewaehlt' };
        }
        const day = ev.datum || today;
        const todays = cands.filter(p => p.from <= day && p.to >= day);

        // Kalender: was laeuft jetzt (30 Minuten vor Beginn bis zum Ende), sonst was kommt heute noch als Naechstes
        if (!ev.datum && cal && cal.length) {
            const timed = cal.filter(c => !c.allDay && c.end && !NO_EVENT.test(c.summary || '')
                && (c.start.toDateString() === now.toDateString() || (c.start <= now && c.end >= now)));
            const running = timed.filter(c => c.start.getTime() - 30 * 60000 <= now && c.end >= now)
                .sort((a, b) => Math.abs(a.start - now) - Math.abs(b.start - now));
            const upcoming = timed.filter(c => c.start > now).sort((a, b) => a.start - b.start);
            const pickCal = running[0] || null;
            // passenden Beitrag finden
            const matchPost = c => {
                const cw = new Set(words(c.summary));
                let best = null, score = 0;
                for (const p of (todays.length ? todays : cands)) {
                    const sc = words(p.name).filter(w => cw.has(w)).length;
                    if (sc > score) { best = p; score = sc; }
                }
                return best;
            };
            if (pickCal) {
                const p = matchPost(pickCal) || (todays.length === 1 ? todays[0] : null);
                return { list: p ? [p] : [], tag: 'laeuft', cal: pickCal, name: p ? p.name : BK.clean(pickCal.summary) };
            }
            if (todays.length > 1 && upcoming[0]) {
                // gerade nichts im Kalender: das naechste heute, sonst das erste des Tages
                const p = matchPost(upcoming[0]);
                if (p) return { list: [p], tag: 'gleich', cal: upcoming[0], name: p.name };
            }
        }
        if (todays.length) return { list: todays, tag: 'heute' };
        const next = cands.filter(p => p.from > day).sort((a, b) => a.from - b.from)[0];
        if (next) return { list: [next], tag: 'naechstes' };
        return { list: [], tag: 'keins' };
    };

    // ---------- Termine (Kalender-Worker) ----------

    function parseICSDate(s) {
        if (!s) return null;
        const y = +s.substr(0, 4), m = +s.substr(4, 2) - 1, d = +s.substr(6, 2);
        if (s.length === 8) return new Date(y, m, d);
        const h = +s.substr(9, 2) || 0, mi = +s.substr(11, 2) || 0, se = +s.substr(13, 2) || 0;
        return s.endsWith('Z') ? new Date(Date.UTC(y, m, d, h, mi, se)) : new Date(y, m, d, h, mi, se);
    }
    const unescapeICS = s => (s || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

    function parseICS(text) {
        const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
        const all = [];
        let cur = null;
        for (const line of lines) {
            if (line.startsWith('BEGIN:VEVENT')) cur = {};
            else if (line.startsWith('END:VEVENT')) { if (cur) all.push(cur); cur = null; }
            else if (cur) {
                const v = line.slice(line.indexOf(':') + 1);
                if (line.startsWith('SUMMARY')) cur.summary = BK.clean(unescapeICS(v));
                else if (line.startsWith('DTSTART')) { cur.start = parseICSDate(v); cur.tz = line.includes('TZID'); }
                else if (line.startsWith('DTEND')) cur.end = parseICSDate(v);
                else if (line.startsWith('RRULE:')) cur.rrule = v;
                else if (line.startsWith('EXDATE')) (cur.ex = cur.ex || []).push(...v.split(',').map(d => parseICSDate(d).getTime()));
                else if (line.startsWith('CLASS:')) cur.cls = v.trim();
                else if (line.startsWith('UID:')) cur.uid = v.trim();
                else if (line.startsWith('RECURRENCE-ID')) cur.recId = parseICSDate(v);
            }
        }
        const moved = {};
        for (const e of all) if (e.recId && e.uid) (moved[e.uid] = moved[e.uid] || []).push(e.recId.getTime());

        const day0 = BK.today();
        const until = new Date(day0.getTime() + LOOKAHEAD_DAYS * 864e5);
        const out = [];
        for (const e of all) {
            if (!e.start) continue;
            const cls = (e.cls || 'PUBLIC').toUpperCase();
            if (cls === 'PRIVATE' || cls === 'CONFIDENTIAL') continue;
            // interne Termine filtert schon der Worker (worker/filter.js)
            if (!e.rrule) {
                if (e.start >= day0 && e.start <= until && !(e.ex && e.ex.includes(e.start.getTime())))
                    out.push({ summary: e.summary, start: e.start, end: e.end || null, allDay: !e.tz && e.start.getHours() === 0 && e.start.getMinutes() === 0 && !e.end });
                continue;
            }
            const u = e.rrule.match(/UNTIL=(\d{8})/);
            if (u && parseICSDate(u[1]) < day0) continue;
            if (!window.rrule) continue;
            try {
                const s = e.start;
                // rrule rechnet in UTC, Ortszeit deshalb als "naive UTC" durchreichen (wie im grossen Kiosk)
                const dt = e.tz ? new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds())) : s;
                const skip = (e.uid && moved[e.uid]) || [];
                for (const n of window.rrule.rrulestr(e.rrule, { dtstart: dt }).between(day0, until, true)) {
                    const d = e.tz ? new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()) : n;
                    const t = d.getTime();
                    if ((e.ex && e.ex.includes(t)) || skip.includes(t)) continue;
                    out.push({ summary: e.summary, start: d, end: e.end ? new Date(d.getTime() + (e.end - e.start)) : null });
                }
            } catch (err) { console.error('RRULE kaputt', e.rrule, err); }
        }
        return out.sort((a, b) => a.start - b.start);
    }

    BK.fetchEvents = async function () {
        const text = await (await fetchWithTimeout(ICS_URL)).text();
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('kein Kalender');
        const all = parseICS(text);
        // events: die naechsten fuer die Uebersicht, cal: alles in den naechsten zwei Tagen mit Uhrzeit (fuers laufende Event)
        const bis = BK.today().getTime() + 2 * 864e5;
        return { events: all.slice(0, MAX_EVENTS), cal: all.filter(e => e.start.getTime() < bis) };
    };

    // ---------- Daten halten ----------

    // Posts + Termine, getrennt abgesichert und im localStorage gemerkt. fn(data) bei jedem neuen Stand.
    BK.dataLoop = function (fn) {
        let data = null;
        try {
            const d = JSON.parse(cacheGet('data'));
            if (d) {
                d.events.forEach(e => { e.start = new Date(e.start); });
                d.cal = (d.cal || []).map(e => Object.assign(e, { start: new Date(e.start), end: e.end && new Date(e.end) }));
                d.posts.forEach(p => { p.from = p.from && new Date(p.from); p.to = p.to && new Date(p.to); });
                data = d;
            }
        } catch (e) { data = null; }
        async function refresh() {
            const [p, e] = await Promise.allSettled([BK.fetchPosts(), BK.fetchEvents()]);
            if (p.status === 'rejected') console.warn('Posts:', p.reason);
            if (e.status === 'rejected') console.warn('Termine:', e.reason);
            if (p.status === 'rejected' && e.status === 'rejected') return false;
            data = {
                posts: p.status === 'fulfilled' ? p.value : (data ? data.posts : []),
                events: e.status === 'fulfilled' ? e.value.events : (data ? data.events : []),
                cal: e.status === 'fulfilled' ? e.value.cal : (data ? data.cal || [] : []),
                ts: Date.now()
            };
            cacheSet('data', JSON.stringify(data));
            fn(data);
            return true;
        }
        return {
            get data() { return data; },
            refresh,
            async start() {
                if (data) fn(data);
                let ok = false;
                try { ok = await refresh(); } catch (e) { console.warn(e); }
                setInterval(() => refresh().catch(e => console.warn(e)), REFRESH_MS);
                // neuer Tag: Termine und Event von gestern sind nicht mehr dran
                let day = BK.today().getTime();
                setInterval(() => {
                    const t = BK.today().getTime();
                    if (t !== day) { day = t; refresh().catch(() => { if (data) fn(data); }); }
                }, 60000);
                return ok;
            }
        };
    };

    // Tabs, die nur gelegentlich schwanken (Karte, Event, Ablauf): alle fuenf Minuten still neu
    BK.sheetLoop = function (names, fn, ms) {
        let last = '';
        async function load() {
            try {
                const raw = await Promise.all(names.map(n => BK.tab(n)));
                const key = raw.join('\u0001');
                if (key !== last) { last = key; fn(raw); }
            } catch (e) { console.warn('Sheet:', e.message); }
        }
        load();
        setInterval(load, ms || SHEET_MS);
        return load;
    };

    // ---------- Umrandete Schrift ----------

    // Nur der Rand ist sichtbar, innen durchsichtig. Ein SVG-Filter nimmt den Aussenrand der ganzen Buchstabenform
    // (ein Text-Stroke zeigt dagegen Ueberlappungen einzelner Buchstabenteile, z. B. beim Q, als innere Linien).
    const NS = 'http://www.w3.org/2000/svg';
    let defs = null;
    const rings = {};
    function ring(r) {
        r = Math.max(1, Math.round(r * 2) / 2);
        const id = 'ring-' + String(r).replace('.', '_');
        if (!defs) {
            defs = document.createElementNS(NS, 'svg');
            defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
            defs.style.cssText = 'position:absolute;width:0;height:0';
            document.body.appendChild(defs);
        }
        if (!rings[id]) {
            const f = document.createElementNS(NS, 'filter');
            f.setAttribute('id', id);
            f.setAttribute('x', '-10%'); f.setAttribute('y', '-30%'); f.setAttribute('width', '120%'); f.setAttribute('height', '160%');
            f.setAttribute('color-interpolation-filters', 'sRGB');
            const add = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); f.appendChild(e); };
            add('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: r, result: 'd' });
            add('feComposite', { in: 'd', in2: 'SourceAlpha', operator: 'out', result: 'r' });
            add('feFlood', { 'flood-color': '#E6175F', result: 'f' });
            add('feComposite', { in: 'f', in2: 'r', operator: 'in' });
            defs.appendChild(f);
            rings[id] = true;
        }
        return `url(#${id})`;
    }
    // Nach dem Einhaengen aufrufen (die Schriftgroesse muss bekannt sein): alle .outl bekommen den Randfilter
    BK.outline = function (root) {
        root.querySelectorAll('.outl').forEach(e => {
            const fs = parseFloat(getComputedStyle(e).fontSize) || 40;
            e.style.filter = ring(fs * 0.0375);
        });
    };

    // ---------- Slides ----------

    BK.msg = function (text, sub) {
        const m = el('div', 'msg', text);
        if (sub) m.appendChild(el('small', null, sub));
        return m;
    };

    BK.pics = function (images) {
        const wrap = el('div', 'sharepics' + (images.length === 1 ? ' single' : ''));
        for (const src of images) { const i = el('img'); i.src = src; wrap.appendChild(i); }
        return wrap;
    };

    BK.events = function (events) {
        const day0 = BK.today();
        const wrap = el('div', 'events');
        wrap.appendChild(el('h1', null, 'Nächste Termine von vielbunt:'));
        const list = el('div', 'event-list');
        for (const e of events.filter(e => e.start >= day0)) {
            const item = el('div', 'event-item');
            item.appendChild(el('div', 'event-date', fmtDate(e.start)));
            item.appendChild(el('div', 'event-title', e.summary || 'Termin'));
            const allDay = e.start.getHours() === 0 && e.start.getMinutes() === 0;
            item.appendChild(el('div', 'event-time', allDay ? 'Ganztägig' : fmtTime(e.start) + ' Uhr'));
            list.appendChild(item);
        }
        wrap.appendChild(list);
        return wrap;
    };

    // Info: Ueberschrift + Textzeilen, Bild: Vollbild
    BK.info = function (lines) {
        const w = el('div', 'info');
        if (lines[0]) w.appendChild(el('h1', null, BK.clean(lines[0])));
        lines.slice(1).filter(Boolean).forEach(t => w.appendChild(el('p', null, BK.clean(t))));
        return w;
    };
    BK.fullImage = function (src) {
        const w = el('div', 'sharepics single');
        const i = el('img'); i.src = BK.imgUrl(src);
        w.appendChild(i);
        return w;
    };

    // Getraenkekarte im Stil der Tafel im Barraum.
    // rows: Zeilen aus S.karte(), preis: 'treff' | 'event', alkohol: Zeilen mit Alkohol zeigen?
    BK.menu = function (rows, preis, alkohol) {
        const items = rows.filter(r => alkohol || !r.alkohol);
        const price = r => r.alkohol ? null : (preis === 'event' ? r.event : r.treff);
        const priced = items.map(price).filter(p => p != null);
        const same = priced.length > 1 && priced.every(p => p === priced[0]);
        const fmt = p => (Number.isInteger(p) ? String(p) : p.toFixed(2).replace('.', ',')) + ' €';

        const w = el('div', 'menu');
        const head = el('div', 'menu-head');
        head.appendChild(el('div', 'menu-title', 'Queeres Zentrum'));
        head.appendChild(el('div', 'menu-sub', 'Drinx'));
        w.appendChild(head);
        w.appendChild(el('div', 'menu-stripe'));

        const body = el('div', 'menu-body' + (items.length > 6 ? ' two' : ''));
        const list = el('div', 'menu-list');
        for (const r of items) {
            const row = el('div', 'menu-item');
            row.appendChild(el('span', 'menu-name', r.name));
            if (r.zusatz) row.appendChild(el('span', 'menu-extra', r.zusatz));
            const p = price(r);
            if (p != null && !same) { row.appendChild(el('span', 'menu-dots')); row.appendChild(el('span', 'menu-price', fmt(p))); }
            list.appendChild(row);
        }
        body.appendChild(list);
        if (same) {
            const all = el('div', 'menu-all');
            all.appendChild(el('span', 'menu-all-l', preis === 'event' ? '@Event · alles' : 'Alles'));
            all.appendChild(el('span', 'menu-all-p', fmt(priced[0])));
            body.appendChild(all);
        }
        w.appendChild(body);
        return w;
    };

    // Willkommen (Event-Modus): ruhig, nur Text
    BK.welcome = function (gruss, name, sub) {
        const w = el('div', 'welcome');
        w.appendChild(el('div', 'welcome-gruss', BK.clean(gruss)));
        if (name) {
            name = BK.clean(name);
            const n = el('div', 'welcome-name', name);
            // lange Namen kleiner setzen
            const len = name.length;
            n.style.fontSize = len > 38 ? '6.2vh' : len > 24 ? '8.2vh' : len > 14 ? '10.5vh' : '13vh';
            w.appendChild(n);
        }
        if (sub) w.appendChild(el('div', 'welcome-sub', BK.clean(sub)));
        return w;
    };

    // ---------- Abspielen ----------

    // Eine Liste aus Eintraegen { dur: ms, node: () => Element | Promise<Element>, src?: Video, pre?: [Bild-URLs] }.
    // Immer nur ein Slide im DOM. setList() tauscht die Liste, ohne den laufenden Slide zu unterbrechen.
    BK.player = function (stage) {
        let list = [], pos = 0, timer = null, running = false;
        const api = {
            // ph: true markiert Platzhalter-Slides, die beim ersten echten Stand sofort abgeloest werden
            setList(l) {
                const wasPh = list.length > 0 && list.every(i => i.ph);
                list = l || [];
                if (pos >= list.length || (wasPh && !list.every(i => i.ph))) pos = 0;
                if (!running) { running = true; step(); }
                else if (wasPh && !list.every(i => i.ph)) step();
            },
            skip() { step(); }
        };

        function show(node) { stage.replaceChildren(node); if (node.querySelector) BK.outline(node); }

        async function step() {
            clearTimeout(timer);
            // Nach ein paar Stunden einmal sauber neu starten, aber nur an einer Slide-Grenze
            if (Date.now() - startedAt > RELOAD_MS && navigator.onLine) { location.reload(); return; }
            if (!list.length) {
                show(BK.msg('Gerade nichts zu zeigen.', 'Mehr auf vielbunt.org'));
                timer = setTimeout(step, 15000);
                return;
            }
            const item = list[pos];
            pos = (pos + 1) % list.length;
            try {
                const src = typeof item.src === 'function' ? item.src() : item.src;
                if (item.src && !src) {
                    // kein Clip vorhanden (Liste leer): Slide ueberspringen
                    timer = setTimeout(step, 50);
                } else if (src) {
                    const v = el('video');
                    v.muted = true; v.autoplay = true; v.playsInline = true;
                    v.disableRemotePlayback = true;
                    v.setAttribute('controlslist', 'noremoteplayback nodownload nofullscreen');
                    let done = false;
                    const next = () => { if (!done) { done = true; step(); } };
                    v.onended = next;
                    // fehlt der Clip oder ist er kaputt, einfach weiter
                    v.onerror = () => { console.warn('Clip fehlt:', src); next(); };
                    v.src = src;
                    v.addEventListener('ended', () => {
                        const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : { totalVideoFrames: 0, droppedVideoFrames: 0 };
                        BK.report('clip=' + encodeURIComponent(src) + '&frames=' + q.totalVideoFrames + '&dropped=' + q.droppedVideoFrames);
                    });
                    show(v);
                    BK.report('video=' + encodeURIComponent(src) + '&page=' + location.pathname.split('/').pop());
                    timer = setTimeout(next, item.dur || 90000);
                } else {
                    if (item.pre && item.pre.length) await BK.preload(item.pre);
                    const node = await item.node();
                    show(node);
                    BK.report('slide=' + encodeURIComponent((node.className || '').toString()) + '&page=' + location.pathname.split('/').pop());
                    timer = setTimeout(step, item.dur);
                }
            } catch (e) {
                console.warn('Slide kaputt:', e);
                timer = setTimeout(step, 1000);
            }
        }
        document.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(); });
        return api;
    };

    // Zum Testen: jeden Slide-Wechsel an einen lokalen Log-Server melden (BK_REPORT in clips/manifest.js, sonst aus)
    BK.report = function (what) {
        const url = window.BK_CLIPS && window.BK_CLIPS.report;
        if (url) new Image().src = url + '?' + what + '&t=' + Date.now();
    };

    // Clip-Liste: aus clips/manifest.js (window.BK_CLIPS), vom Build geschrieben
    BK.clips = () => window.BK_CLIPS || { vielbunt: [], queerbar: {} };

    // Reihum den naechsten Clip aus einer Liste
    BK.rotator = function (names) {
        let i = 0;
        return () => names.length ? names[i++ % names.length] : null;
    };
})();
