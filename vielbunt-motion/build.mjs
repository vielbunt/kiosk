// Baut vielbunt-loop.html als eigenstaendige Datei, laeuft offline und per Doppelklick
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

let css = readFileSync('src/style.css', 'utf8');
css = css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync('src/' + f).toString('base64')})`);

const res = await build({
  entryPoints: ['src/loop.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  loader: { '.svg': 'text' },
  write: false,
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/loop.html', 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
writeFileSync('vielbunt-loop.html', html);
console.log(`vielbunt-loop.html: ${(html.length / 1024).toFixed(0)} KB`);
