// Rendert Szenen aus vielbunt-loop.html als MP4-Clips fuer kiosk-lite (Pi Zero spielt Videos fluessig, Canvas nicht).
// Aufruf (aus dem Kiosk-Repo):  node kiosk-lite/render-clips.mjs
//                         oder:  node kiosk-lite/render-clips.mjs skyline:nacht herzen:pink ...
// Ohne Szenen werden alle 20 Szenen gerendert, mit denselben Stilen wie auf dem Pi.
// Umgebungsvariablen: VB_LOOP=Pfad/zu/vielbunt-loop.html  SIZE=1280x800  FPS=30  OUT=kiosk-lite/clips  MAXSEC=2 (nur zum Testen: kuerzere Clips)
//
// Chrome rendert jedes Bild einzeln ueber window.__loop.render(t) und nimmt im Takt per MediaRecorder auf
// (H.264 in MP4). Das laeuft in Echtzeit, 20 Szenen dauern also rund vier Minuten. ffmpeg braucht es nicht.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// vielbunt-loop liegt im eigenen Projekt vielbunt-motion
const LOOP = process.env.VB_LOOP || join(homedir(), 'Downloads/vielbunt-motion/vielbunt-loop.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [W, H] = (process.env.SIZE || '1280x800').split('x').map(Number);
const FPS = Number(process.env.FPS) || 30;
const OUT = resolve(process.env.OUT || join(HERE, 'clips'));
const PORT = 9333;

// "termin" fehlt mit Absicht: die Szene zeigt Live-Termine, im Video waeren die sofort veraltet
const ALL = ['logoZoom:pink', 'skyline:nacht', 'punktwand:verlauf', 'headline:pink', 'progress:hell', 'flaggen:pink',
  'equalizer:nacht', 'kacheln:verlauf', 'herzen:pink', 'pride:hell', 'sprechblasen:pink', 'gruppen:nacht',
  'muster:verlauf', 'motto:pink', 'wellen:hell', 'ticker:pink', 'konfetti:nacht', 'skylineLinie:verlauf',
  'statement:pink', 'danke:hell'];
const scenes = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'vb-clips-'));
// wie im Kiosk: vor dem Skript den Einbettungsmodus setzen, dann spielt der Loop einzelne Szenen
const page = join(tmp, 'loop-embed.html');
writeFileSync(page, readFileSync(LOOP, 'utf8').replace('<head>', '<head><script>window.__VB_EMBED = true;<\/script>'));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--force-device-scale-factor=1', '--hide-scrollbars', `--user-data-dir=${join(tmp, 'profil')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch (e) { /* Chrome startet noch */ }
  }
  if (!targets) throw new Error('Chrome ist nicht gestartet');
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const wait = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } });
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'Fehler im Browser');
    return r.result?.result?.value;
  };

  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'file://' + page });
  for (let i = 0; i < 100 && !(await js('!!window.__loop')); i++) await sleep(200);
  if (!(await js('!!window.__loop'))) throw new Error('vielbunt-loop.html hat nicht geladen');
  await sleep(500);

  for (const [n, spec] of scenes.entries()) {
    const [scene, style = 'pink'] = spec.split(':');
    const dur = await js(`(() => { postMessage({ type: 'vb-play', scene: '${scene}', style: '${style}' }, '*'); return new Promise(r => setTimeout(() => r(__loop.timeline().total), 300)); })()`);
    const frames = Math.round((Number(process.env.MAXSEC) || dur) * FPS);
    const file = join(OUT, `${scene}-${style}.mp4`);
    process.stdout.write(`[${n + 1}/${scenes.length}] ${scene} (${style}), ${Math.round(dur * 10) / 10} s ... `);
    const res = await js(`(async () => {
      const cv = document.getElementById('c');
      const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error('Chrome kann kein MP4 aufnehmen');
      const track = cv.captureStream(0).getVideoTracks()[0];
      const rec = new MediaRecorder(new MediaStream([track]), { mimeType: mime, videoBitsPerSecond: 8e6 });
      const chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const stopped = new Promise(r => rec.onstop = r);
      __loop.seek(0); __loop.render(0);
      rec.start();
      const t0 = performance.now();
      for (let f = 0; f < ${frames}; f++) {
        const wait = t0 + f * 1000 / ${FPS} - performance.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const t = f / ${FPS};
        __loop.seek(t); __loop.render(t);
        track.requestFrame();
      }
      await new Promise(r => setTimeout(r, 1000 / ${FPS}));
      rec.stop();
      await stopped;
      const buf = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(bin);
    })()`);
    const buf = Buffer.from(res, 'base64');
    writeFileSync(file, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
  }
  console.log(`fertig: ${OUT}`);
} finally {
  ws?.close();
  chrome.kill();
  await sleep(300);
  rmSync(tmp, { recursive: true, force: true });
}
