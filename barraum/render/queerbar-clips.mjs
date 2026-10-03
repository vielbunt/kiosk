// Rendert die Claim- und Motion-Slides aus dem Sheet "Barraum-Kiosk" (Tab Queerbar Slides) als Standbilder (JPEG)
// fuer den Queerbar-Modus des Pi. Aufruf (aus dem Kiosk-Repo):
//
//   node barraum/render/queerbar-clips.mjs            fehlende Bilder rendern, vorhandene bleiben
//   node barraum/render/queerbar-clips.mjs --alle     alles neu rendern
//   node barraum/render/queerbar-clips.mjs --liste    nur zeigen, was gerendert wuerde
//
// Warum Standbilder: Der Pi Zero zeigt ein JPEG praktisch umsonst, Videos mit Laufband und Textanimation
// ruckeln dagegen. Ein Standbild zeigt den fertigen Slide (Text, Foto, Umrandung), ohne Bewegung und ohne Laufband.
// Jeder Slide bekommt einen Schluessel aus allem, was zu sehen ist (src/sheet.js). Die Datei heisst <schluessel>.jpg
// und liegt in barraum/clips-queerbar/. Aendert sich im Sheet Text, Bild oder eine Songliste, aendert sich der
// Schluessel, und das Bild wird beim naechsten Lauf neu gerendert. Bis dahin zeigt der Pi den Slide schlicht als Text.
//
// Aufgenommen wird der echte Queerbar-Kiosk (queerbar-kiosk/queerbar-kiosk.src.html) in Chrome.
// Gebraucht: Node und Google Chrome.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const S = createRequire(import.meta.url)('../src/sheet.js');
const KIOSK_DIR = resolve(HERE, '..', '..', 'queerbar-kiosk');
const OUT = resolve(process.env.OUT || join(HERE, '..', 'clips-queerbar'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [W, H] = (process.env.SIZE || '1280x800').split('x').map(Number);
// so lange laufen die Eingangsanimationen des Slides, danach ist er fertig aufgebaut (Flackern ist im Render-Modus aus)
const SETTLE_MS = Number(process.env.SETTLE_MS) || 3200;
const PORT = 9334, HTTP_PORT = 8794;
const alle = process.argv.includes('--alle');
const nurListe = process.argv.includes('--liste');

async function tab(name) {
    const url = `https://docs.google.com/spreadsheets/d/${S.SHEET_ID}/export?format=csv&gid=${S.GID[name]}&t=${Date.now()}`;
    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok || /^\s*</.test(text)) throw new Error(`Tab ${name} nicht lesbar (Sheet noch fuer alle mit Link freigegeben?)`);
    return text;
}

// ---------- Was soll gerendert werden? ----------

const [slidesCsv, songsCsv, setCsv] = await Promise.all([tab('qslides'), tab('qsongs'), tab('einstellungen')]);
const set = S.settings(setCsv);
const songs = S.qsongs(songsCsv);
const ctx = S.clipContext(set, songs);
const heute = S.barDay(new Date());
// aktive Slides, die noch nicht vorbei sind (auch die, die erst spaeter starten)
const todo = [];
const seen = new Set();
for (const s of S.qslides(slidesCsv)) {
    if (!s.aktiv || (s.bis && s.bis < heute)) continue;
    const key = S.clipKey(s, ctx);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    todo.push({ s, key, dur: ctx.dauer(s) });
}
mkdirSync(OUT, { recursive: true });
const missing = todo.filter(t => alle || !existsSync(join(OUT, t.key + '.jpg')));
console.log(`${todo.length} Slides zum Vorrendern, ${missing.length} davon fehlen${alle ? ' (alle neu)' : ''}`);
for (const t of todo) console.log(`  ${missing.includes(t) ? '*' : ' '} ${t.key}  ${t.s.typ.padEnd(6)} ${t.s.z.filter(Boolean).join(' / ')}`);
if (nurListe || !missing.length) {
    writeManifest();
    process.exit(0);
}

// ---------- kleiner Webserver fuer den Queerbar-Kiosk (Schriften, Bilder) ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = join(KIOSK_DIR, p === '/' ? 'queerbar-kiosk.src.html' : p);
    if (!f.startsWith(KIOSK_DIR) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
});
await new Promise(r => server.listen(HTTP_PORT, '127.0.0.1', r));

// ---------- Chrome ----------

const tmp = mkdtempSync(join(tmpdir(), 'bk-qb-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
    '--force-device-scale-factor=1', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${join(tmp, 'profil')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
        await sleep(200);
        try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch (e) { /* Chrome startet noch */ }
    }
    if (!targets) throw new Error('Chrome ist nicht gestartet');
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const wait = new Map();
    ws.addEventListener('message', m => {
        const d = JSON.parse(m.data);
        if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
    });
    const cdp = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async expr => {
        const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'Fehler im Browser');
        return r.result?.result?.value;
    };
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

    for (const [n, t] of missing.entries()) {
        process.stdout.write(`[${n + 1}/${missing.length}] ${t.key} ... `);
        const slide = { typ: t.s.typ, z: t.s.z, bild: t.s.bild, dauer: t.s.dauer, kategorien: t.s.kategorien };
        const url = `http://127.0.0.1:${HTTP_PORT}/queerbar-kiosk.src.html?render=1&noband=1&slide=${encodeURIComponent(JSON.stringify(slide))}`;
        await cdp('Page.navigate', { url });
        for (let i = 0; i < 150 && !(await js('!!window.__qbReady')); i++) await sleep(200);
        if (!(await js('!!window.__qbReady'))) throw new Error('Queerbar-Kiosk wurde nicht bereit');
        await sleep(300);

        await js('window.__qbRelease()');
        await sleep(SETTLE_MS);
        const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 90, fromSurface: true });
        const buf = Buffer.from(shot.result.data, 'base64');
        writeFileSync(join(OUT, t.key + '.jpg'), buf);
        console.log(`${(buf.length / 1024).toFixed(0)} KB`);
    }
    writeManifest();
} finally {
    ws?.close();
    chrome.kill();
    server.close();
    await sleep(300);
    rmSync(tmp, { recursive: true, force: true });
}

// Liste der vorhandenen Clips, die der Build in clips/manifest.js uebernimmt
function writeManifest() {
    const files = existsSync(OUT) ? readdirSync(OUT).filter(f => f.endsWith('.jpg')).sort() : [];
    writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(files.map(f => f.replace(/\.jpg$/, '')), null, 1) + '\n');
}
