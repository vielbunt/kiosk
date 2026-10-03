// Baut die Seiten des Barraum-Kiosks aus src/ nach dist/ und minifiziert sie.
//
//   node barraum/build.mjs        (aus dem Kiosk-Repo, oder npm run build im Ordner barraum)
//
// dist/ enthaelt: start.html (Weiche), standard.html, queerbar.html, event.html, fonts/, assets/ und
// clips/manifest.js (Liste der vorhandenen Clips). Die Clips selbst liegen in clips/ (vielbunt) und
// clips-queerbar/ und kommen beim Deploy dazu (deploy.sh).
// Jede Seite ist eine einzelne Datei: Skripte und Styles stecken drin, nur manifest.js und die Schriften/Bilder
// liegen daneben. Gebraucht werden Node und esbuild (npm install im Ordner barraum).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');
const DIST = join(HERE, 'dist');
const read = f => readFileSync(join(SRC, f), 'utf8');

const js = code => transformSync(code, { loader: 'js', minify: true, target: 'chrome100' }).code.trim();
const css = code => transformSync(code, { loader: 'css', minify: true }).code.trim();

// Bausteine, die in die Seiten wandern
const parts = {
    '<!--CSS-->': `<style>${css(read('base.css'))}</style>`,
    '<!--SHEET-->': `<script>${js(read('sheet.js'))}</script>`,
    '<!--LIB-->': `<script>${js(read('lib.js'))}</script>`,
    // gleiche rrule-Version wie im grossen Kiosk, damit Serientermine genauso gerechnet werden
    '<!--RRULE-->': `<script>${readFileSync(join(HERE, 'rrule-2.7.2.min.js'), 'utf8').trim()}</script>`
};

// Eigene Skripte und Styles einer Seite minifizieren, HTML-Kommentare und Einrueckung raus
function minifyPage(html) {
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => `<script>${js(code)}</script>`);
    html = html.replace(/<style>([\s\S]*?)<\/style>/g, (m, code) => `<style>${css(code)}</style>`);
    return html;
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'clips'), { recursive: true });

let total = 0;
for (const page of ['start', 'standard', 'queerbar', 'event', '7-jahre-queerbar']) {
    let html = read(page + '.html');
    // erst die eigenen Skripte, dann die Bausteine (die sind schon minifiziert)
    html = minifyPage(html);
    for (const [marker, code] of Object.entries(parts)) html = html.split(marker).join(code);
    const left = html.match(/<!--(CSS|SHEET|LIB|RRULE)-->/);
    if (left) throw new Error(`${page}.html: Platzhalter ${left[0]} nicht ersetzt`);
    // Kommentare und Leerzeilen raus, Skripte bleiben unangetastet
    html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n+/g, '\n').replace(/^\s+/gm, '');
    writeFileSync(join(DIST, page + '.html'), html);
    total += html.length;
    console.log(`${page}.html  ${(html.length / 1024).toFixed(1)} KB`);
}

// Schriften (lizenziert, nur lokal) und eingebaute Queerbar-Bilder (Fotos, nur lokal) neben die Seiten
function copyDir(from, to, filter) {
    if (!existsSync(from)) return 0;
    mkdirSync(to, { recursive: true });
    let n = 0;
    for (const f of readdirSync(from)) if (filter(f)) { copyFileSync(join(from, f), join(to, f)); n++; }
    return n;
}
const fonts = copyDir(join(HERE, 'fonts'), join(DIST, 'fonts'), f => f.endsWith('.woff2'));
if (fonts < 2) console.warn('WARNUNG: Cera-Pro-Schriften fehlen in barraum/fonts/ (Cera-Pro-Bold.woff2, Cera-Pro-Black.woff2). Die Seiten fallen auf eine Standardschrift zurueck.');
const assets = copyDir(join(HERE, '..', 'queerbar-kiosk', 'assets'), join(DIST, 'assets'), f => /\.(jpe?g|png|webp)$/i.test(f));
if (!assets) console.warn('WARNUNG: keine Bilder in queerbar-kiosk/assets/, Claim/Acts im Queerbar-Modus haben dann kein Foto.');

// Clip-Liste fuer die Seiten
const list = (dir, ext) => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(ext)).sort() : [];
const vielbunt = list(join(HERE, 'clips'), '.mp4').map(f => 'clips/vielbunt/' + f);
const queerbar = list(join(HERE, 'clips-queerbar'), '.jpg').map(f => f.replace(/\.jpg$/, ''));
writeFileSync(join(DIST, 'clips', 'manifest.js'),
    `window.BK_CLIPS=${JSON.stringify({ vielbunt, queerbar, report: process.env.BK_REPORT || undefined })};\n`);

console.log(`fertig: ${(total / 1024).toFixed(0)} KB Seiten, ${fonts} Schriften, ${assets} Bilder, ${vielbunt.length} Clips (vielbunt), ${queerbar.length} Standbilder (Queerbar)`);
