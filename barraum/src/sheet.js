// Reine Funktionen rund ums Google Sheet "Barraum-Kiosk": CSV lesen, Tabs auswerten, Clip-Schluessel bilden.
// Laeuft im Browser (wird in die Seiten eingebaut) und in Node (render/queerbar-clips.mjs), damit beide
// denselben Schluessel fuer denselben Slide ausrechnen. Keine DOM-Zugriffe hier drin.
(function (root) {
    'use strict';

    const SHEET_ID = '152xB92pnSdWQGcb8QO9tB1J0yOjslCxOAsFX6Ap9d1k';
    // gid je Tab (aendern sich nicht, auch wenn ein Tab umbenannt wird)
    const GID = { einstellungen: 3, event: 5, ablauf: 6, karte: 7, qslides: 0, qdrinks: 1, qsongs: 2 };
    // Worker mit CORS, siehe worker/worker.js (Googles Export geht von file:// aus nicht)
    const PROXY = 'https://shy-recipe-d443.me-02a.workers.dev/sheet/';
    const MODES = ['standard', 'queerbar', 'event', '7-jahre-queerbar'];

    function parseCSV(text) {
        const rows = [];
        let row = [], f = '', q = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) {
                if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
                else f += c;
            } else if (c === '"') q = true;
            else if (c === ',') { row.push(f); f = ''; }
            else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
            else if (c !== '\r') f += c;
        }
        if (f !== '' || row.length) { row.push(f); rows.push(row); }
        return rows;
    }

    // erste Zeile = Kopf, Spalten klein geschrieben
    function table(rows) {
        const head = (rows[0] || []).map(h => h.trim().toLowerCase());
        return rows.slice(1).map(r => {
            const o = {};
            head.forEach((h, i) => { if (h) o[h] = (r[i] == null ? '' : r[i]).trim(); });
            return o;
        });
    }
    function pick(o, ...keys) {
        for (const k of keys) for (const h in o) if (h.startsWith(k)) return o[h];
        return '';
    }
    const truthy = v => /^(true|wahr|ja|x|1|✓|✔)$/i.test(String(v || '').trim());
    function parseNum(v) {
        const s = String(v == null ? '' : v).trim().replace(/[€\s]/g, '').replace(/[.,]-$/, '');
        if (!/^\d+([.,]\d+)?$/.test(s)) return null;
        return parseFloat(s.replace(',', '.'));
    }
    function parseDate(v) {
        const s = String(v || '').trim();
        let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
        return null;
    }

    // Schluessel-Wert-Tabs (Einstellungen, Event): Schluessel klein, Werte als Text
    function keyValues(csv) {
        const out = {};
        parseCSV(csv || '').slice(1).forEach(r => { if (r[0] && r[0].trim()) out[r[0].trim().toLowerCase()] = (r[1] || '').trim(); });
        return out;
    }
    function kvGet(kv, ...prefixes) {
        for (const p of prefixes) for (const k in kv) if (k.startsWith(p)) return kv[k];
        return '';
    }

    // ---------- Einstellungen ----------

    function settings(csv) {
        const kv = keyValues(csv);
        const modus = String(kv['modus'] || '').toLowerCase();
        return {
            modus: MODES.includes(modus) ? modus : 'standard',
            karteStandard: truthy(kvGet(kv, 'getränkekarte standard', 'getraenkekarte standard')),
            clipsStandard: kvGet(kv, 'clips standard') === '' ? true : truthy(kvGet(kv, 'clips standard')),
            dauerPics: parseNum(kvGet(kv, 'dauer sharepics')) || 20,
            dauerTermine: parseNum(kvGet(kv, 'dauer termine')) || 30,
            dauerKarte: parseNum(kvGet(kv, 'dauer getränkekarte', 'dauer getraenkekarte')) || 20,
            // Queerbar-Kiosk
            band: ['songs', 'text', 'aus'].includes((kv['laufband'] || '').toLowerCase()) ? kv['laufband'].toLowerCase() : 'songs',
            bandText: kvGet(kv, 'laufband-text', 'laufbandtext'),
            dauer: parseNum(kvGet(kv, 'standard-dauer')) || 10,
            vielbunt: kvGet(kv, 'vielbunt') === '' ? true : truthy(kvGet(kv, 'vielbunt')),
            euro: truthy(kvGet(kv, 'preise mit euro'))
        };
    }

    // ---------- Getraenkekarte des Barraums ----------

    function karte(csv) {
        return table(parseCSV(csv || '')).map(o => ({
            aktiv: truthy(pick(o, 'aktiv')),
            name: pick(o, 'getränk', 'getraenk'),
            zusatz: pick(o, 'zusatz'),
            alkohol: truthy(pick(o, 'alkohol')),
            treff: parseNum(pick(o, 'preis treff')),
            event: parseNum(pick(o, 'preis event'))
        })).filter(d => d.aktiv && d.name);
    }

    // ---------- Event ----------

    function eventKV(csv) {
        const kv = keyValues(csv);
        return {
            name: kv['veranstaltung'] || '',
            untertitel: kv['untertitel'] || '',
            gruss: kv['begrüßung'] || kv['begruessung'] || kv['begrüssung'] || 'Herzlich willkommen zur Veranstaltung',
            sharepics: (kv['sharepics'] || '').split('|').map(s => s.trim()).filter(Boolean),
            automatik: kv['automatik'] === undefined || kv['automatik'] === '' ? true : truthy(kv['automatik']),
            datum: parseDate(kv['datum']),
            suchwort: kv['suchwort'] || '',
            preise: /^treff$/i.test(kv['preise'] || '') ? 'treff' : 'event'
        };
    }

    // Ablauf-Tabs (Event-Ablauf): eine Zeile = ein Slide
    function ablauf(csv) {
        return table(parseCSV(csv || '')).map(o => ({
            aktiv: truthy(pick(o, 'aktiv')),
            typ: pick(o, 'typ').toLowerCase(),
            dauer: parseNum(pick(o, 'dauer')),
            z: [pick(o, 'zeile 1'), pick(o, 'zeile 2'), pick(o, 'zeile 3'), pick(o, 'zeile 4')],
            bild: pick(o, 'bild'),
            ab: parseDate(pick(o, 'zeigen ab')),
            bis: parseDate(pick(o, 'zeigen bis'))
        })).filter(s => s.typ);
    }

    // Ein Barabend zaehlt bis 6 Uhr morgens
    function barDay(now) {
        const d = new Date(now.getTime() - 6 * 3600 * 1000);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function inRange(s, day) {
        return s.aktiv && (!s.ab || s.ab <= day) && (!s.bis || s.bis >= day);
    }

    // ---------- Queerbar ----------

    const QTYPES = ['claim', 'karte', 'special', 'motion', 'acts', 'info', 'bild'];

    function qslides(csv) {
        return table(parseCSV(csv || '')).map(o => ({
            aktiv: truthy(pick(o, 'aktiv')),
            typ: pick(o, 'typ').toLowerCase(),
            dauer: parseNum(pick(o, 'dauer')),
            z: [pick(o, 'zeile 1'), pick(o, 'zeile 2'), pick(o, 'zeile 3'), pick(o, 'zeile 4')],
            bild: pick(o, 'bild'),
            kategorien: pick(o, 'kategor'),
            trans: (pick(o, 'übergang', 'uebergang') || 'blende').toLowerCase(),
            ab: parseDate(pick(o, 'zeigen ab')),
            bis: parseDate(pick(o, 'zeigen bis'))
        })).filter(s => QTYPES.includes(s.typ));
    }
    function qdrinks(csv) {
        return table(parseCSV(csv || '')).map(o => ({
            aktiv: truthy(pick(o, 'aktiv')),
            kat: pick(o, 'kategorie'),
            name: pick(o, 'getränk', 'getraenk', 'name'),
            extra: pick(o, 'zusatz'),
            preis: pick(o, 'preis'),
            hot: truthy(pick(o, 'highlight')),
            out: truthy(pick(o, 'ausverkauft'))
        })).filter(d => d.name);
    }
    function qsongs(csv) {
        return parseCSV(csv || '').slice(1).map(r => (r[0] || '').trim()).filter(Boolean);
    }

    // ---------- Clip-Schluessel ----------

    // 32-Bit-FNV-1a, reicht fuer Dateinamen
    function hash(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return h.toString(16).padStart(8, '0');
    }
    // Version hochzaehlen, wenn sich das Aussehen der Clips aendert (z. B. neue Queerbar-Kiosk-Fassung)
    const CLIP_VERSION = 4;

    // Nur Claim und Motion werden vorgerendert (als Standbild, ohne Laufband). Der Schluessel enthaelt alles, was zu sehen ist.
    function clipKey(s, ctx) {
        if (s.typ === 'claim') return 'claim-' + hash(JSON.stringify([CLIP_VERSION, s.z, s.bild, ctx.vielbunt]));
        if (s.typ === 'motion') return 'motion-' + hash(JSON.stringify([CLIP_VERSION, s.z[0], ctx.songs, ctx.vielbunt]));
        return null;
    }
    // Alles, was clipKey braucht, aus den Rohdaten
    function clipContext(set, songs) {
        return { dauer: s => s.dauer || set.dauer || 10, songs, vielbunt: set.vielbunt };
    }

    const api = {
        SHEET_ID, GID, PROXY, MODES, QTYPES, CLIP_VERSION,
        parseCSV, table, pick, truthy, parseNum, parseDate, keyValues, kvGet,
        settings, karte, eventKV, ablauf, barDay, inRange, qslides, qdrinks, qsongs, hash, clipKey, clipContext
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BKSheet = api;
})(typeof self !== 'undefined' ? self : this);
