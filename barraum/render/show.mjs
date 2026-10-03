// Rendert die komplette Queerbar-Show (alle aktiven Slides aus dem Sheet, mit ihren Animationen, Uebergaengen
// und dem Laufband) als EIN Video fuer den Modus 7-jahre-queerbar. Aufruf (aus dem Kiosk-Repo):
//
//   node barraum/render/show.mjs                    Slides, wie sie heute im Sheet aktiv sind
//   node barraum/render/show.mjs --tag=09.10.2026   Slides, wie sie an diesem Barabend aktiv waeren
//
// Ergebnis in barraum/clips-7jahre/: show.mp4 (eine Schleife, laeuft nahtlos von vorn) und show.js (Zeitleiste und
// Lage der Preise). Preise und Ausverkauft stehen NICHT im Video, der Pi legt sie live aus dem Sheet (Tab Queerbar
// Getraenke) als Overlay darueber. Alles andere (Texte, Fotos, Hervorhebungen, Kategorien) steckt im Video:
// aendert sich das im Sheet, muss neu gerendert werden. Dauer: rund die dreifache Laenge der Show in Echtzeit.
//
// Wie es funktioniert: Der echte Queerbar-Kiosk spielt in Chrome mit den Parametern show, noprice (und tag) fuer sich
// selbst durch. Aufgenommen wird per Screencast, das Skript schneidet genau einen Durchlauf heraus: von Beginn des
// Uebergangs in den ersten Slide bis zum naechsten Beginn dieses Uebergangs. So passt das Ende nahtlos zum Anfang
// (nur das Laufband springt dabei, was im Uebergang untergeht). ffmpeg macht daraus H.264.
// Gebraucht: Node, Google Chrome, ffmpeg (mit libx264).
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIOSK_DIR = resolve(HERE, '..', '..', 'queerbar-kiosk');
const OUT = resolve(process.env.OUT || join(HERE, '..', 'clips-7jahre'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [W, H] = (process.env.SIZE || '1280x800').split('x').map(Number);
const FPS = 30;
const PORT = 9335, HTTP_PORT = 8796;
const tag = (process.argv.find(a => a.startsWith('--tag=')) || '').slice(6);

// ---------- Webserver fuer den Queerbar-Kiosk ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = join(KIOSK_DIR, p === '/' ? 'queerbar-kiosk.src.html' : p);
    if (!f.startsWith(KIOSK_DIR) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
});
await new Promise(r => server.listen(HTTP_PORT, '127.0.0.1', r));

const tmp = mkdtempSync(join(tmpdir(), 'bk-show-'));
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
    let onFrame = null;
    ws.addEventListener('message', m => {
        const d = JSON.parse(m.data);
        if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
        else if (d.method === 'Page.screencastFrame' && onFrame) onFrame(d.params);
    });
    const cdp = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async expr => {
        const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'Fehler im Browser');
        return r.result?.result?.value;
    };
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

    // Bilder gleich auf die Platte, das sind ein paar tausend
    const frames = [];
    let seq = 0;
    onFrame = p => {
        const name = `f${String(seq++).padStart(6, '0')}.jpg`;
        writeFileSync(join(tmp, name), Buffer.from(p.data, 'base64'));
        frames.push({ ts: p.metadata.timestamp, name });
        cdp('Page.screencastFrameAck', { sessionId: p.sessionId });
    };
    const url = `http://127.0.0.1:${HTTP_PORT}/queerbar-kiosk.src.html?render=1&show=1&noprice=1${tag ? '&tag=' + encodeURIComponent(tag) : ''}`;
    await cdp('Page.navigate', { url });
    // Screencast erst starten, wenn die Seite steht (sonst bricht ihn die Navigation ab)
    for (let i = 0; i < 150 && !(await js('!!window.__qbLog').catch(() => false)); i++) await sleep(200);
    await cdp('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 2 });

    // laufen lassen, bis der erste Slide zum dritten Mal beginnt
    const t0wall = Date.now();
    let log = [];
    for (;;) {
        await sleep(2000);
        log = await js('window.__qbLog') || [];
        const firsts = log.filter(e => e.ev === 'reveal' && e.i === log.find(x => x.ev === 'reveal')?.i);
        const n = log.find(e => e.ev === 'reveal')?.n || 0;
        process.stdout.write(`\r${Math.round((Date.now() - t0wall) / 1000)} s, ${log.filter(e => e.ev === 'reveal').length} Slides gezeigt (Durchlauf ${firsts.length}), ${frames.length} Bilder   `);
        if (firsts.length >= 3) break;
        if (Date.now() - t0wall > 15 * 60 * 1000) throw new Error('Zeitueberschreitung beim Aufnehmen');
        if (!n && Date.now() - t0wall > 60000) throw new Error('Der Kiosk zeigt keine Slides');
    }
    console.log();
    await sleep(300);
    await cdp('Page.stopScreencast');
    onFrame = null;
    log = await js('window.__qbLog');

    // ---------- einen Durchlauf herausschneiden ----------

    const reveals = log.filter(e => e.ev === 'reveal');
    const firstI = reveals[0].i, N = reveals[0].n;
    const starts = reveals.filter(e => e.i === firstI);          // Beginn des ersten Slides: initial, Durchlauf 2, Durchlauf 3
    const nextBefore = r => log.filter(e => e.ev === 'next' && e.t <= r.t).pop();
    const tStart = nextBefore(starts[1]).t / 1000;
    const tEnd = nextBefore(starts[2]).t / 1000;
    const L = tEnd - tStart;
    console.log(`Durchlauf: ${L.toFixed(2)} s, ${N} Slides`);

    // Zeitleiste der Slides im Schnitt (Durchlauf 2)
    const inCut = log.filter(e => e.t / 1000 >= tStart - 0.01 && e.t / 1000 < tEnd + 3);
    const slides = [];
    for (const rv of reveals.filter(r => r.t / 1000 >= tStart && r.t / 1000 < tEnd)) {
        const shown = log.find(e => e.ev === 'shown' && e.i === rv.i && e.t >= rv.t);
        const leave = log.find(e => e.ev === 'next' && e.t > shown.t);
        const geom = log.find(e => e.ev === 'geom' && e.i === rv.i && e.t >= rv.t);
        slides.push({
            i: rv.i, typ: rv.typ,
            from: +(shown.t / 1000 - tStart).toFixed(2),
            to: +(Math.min(leave.t / 1000, tEnd) - tStart).toFixed(2),
            prices: geom ? geom.geom : null
        });
    }
    void inCut;

    // Bilder -> MP4
    const useFrames = frames.filter(f => f.ts >= tStart - 0.2 && f.ts <= tEnd);
    let startIdx = 0;
    useFrames.forEach((f, i) => { if (f.ts <= tStart) startIdx = i; });
    const cut = useFrames.slice(startIdx);
    cut[0] = { ts: tStart, name: cut[0].name };
    let list = '';
    cut.forEach((f, i) => {
        const next = i < cut.length - 1 ? cut[i + 1].ts : tEnd;
        list += `file '${f.name}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
    });
    list += `file '${cut[cut.length - 1].name}'\n`;
    writeFileSync(join(tmp, 'list.txt'), list);
    mkdirSync(OUT, { recursive: true });
    const mp4 = join(OUT, 'show.mp4');
    const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'),
        '-t', L.toFixed(3), '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow',
        // Baseline ohne B-Bilder und CABAC: der Pi Zero dekodiert in Software, das ist so am billigsten
        '-tune', 'fastdecode', '-bf', '0', '-refs', '1', '-crf', '20', '-maxrate', '4M', '-bufsize', '8M', '-profile:v', 'baseline', '-level', '3.2', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg ist fehlgeschlagen');

    const gaps = cut.slice(1).filter((f, i) => f.ts - cut[i].ts > 0.07).length;
    const info = { w: W, h: H, duration: +L.toFixed(3), built: new Date().toISOString(), tag: tag || null, slides };
    writeFileSync(join(OUT, 'show.js'), 'window.BK_SHOW=' + JSON.stringify(info) + ';\n');
    console.log(`fertig: ${mp4} (${(statSync(mp4).size / 1e6).toFixed(1)} MB, ${cut.length} Bilder, ${gaps} Luecken ueber 70 ms)`);
    console.log(slides.map(s => `  ${s.i} ${s.typ.padEnd(6)} ${s.from}-${s.to} s${s.prices ? `, ${s.prices.length} Preise` : ''}`).join('\n'));
} finally {
    ws?.close();
    chrome.kill();
    server.close();
    await sleep(300);
    rmSync(tmp, { recursive: true, force: true });
}
