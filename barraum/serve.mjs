// Kleiner Testserver: liefert dist/ und blendet die Clips so ein, wie sie auf dem Pi liegen.
//   node barraum/serve.mjs [port]     dann http://localhost:8795/start.html (oder standard.html?modus=standard ...)
// Der Parameter ?modus=queerbar|standard|event haelt die Seite fest, ohne dass das Sheet den Modus umschaltet.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 8795;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };

function resolvePath(p) {
    if (p.startsWith('/clips/vielbunt/')) return join(HERE, 'clips', p.slice(16));
    if (p.startsWith('/clips/queerbar/')) return join(HERE, 'clips-queerbar', p.slice(16));
    return join(HERE, 'dist', p === '/' ? 'start.html' : p);
}
createServer((req, res) => {
    const f = resolvePath(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    const buf = readFileSync(f);
    // Range-Anfragen, damit Videos im Browser abspielen
    const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
    if (range) {
        const a = +range[1], b = range[2] ? +range[2] : buf.length - 1;
        res.writeHead(206, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'content-range': `bytes ${a}-${b}/${buf.length}`, 'accept-ranges': 'bytes', 'content-length': b - a + 1 });
        res.end(buf.subarray(a, b + 1));
    } else {
        res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'accept-ranges': 'bytes', 'content-length': buf.length });
        res.end(buf);
    }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/start.html`));
