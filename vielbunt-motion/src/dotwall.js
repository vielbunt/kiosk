// Punktwand mit der Darmstaedter Skyline (Szene "Punktwand" im vielbunt-loop).
// build() rechnet das Raster fuer eine Flaeche W x H (logische Einheiten) aus,
// draw() zeichnet in einen Kontext, dessen Transformation schon auf diese Einheiten steht.

import { SKY } from './sky-shapes.js';
import logoSvg from './logo.svg';

export const PINK = '#E6175F';
const LOGO_COLS = ['#E6175F', '#FFCB03', '#41B73D', '#13A3DC', '#6546B4'];
const BRAND = ['#E6175F', '#F59C00', '#FFCB03', '#41B73D', '#13A3DC', '#6546B4'];

export const MODES = {
  pink: { name: 'Pink auf Schwarz', bg: '#060407', dot: PINK, off: 'rgba(230,23,95,0.085)', win: '#FFC7DA', fingers: LOGO_COLS, sun: 'rgba(230,23,95,0.2)', logoText: '#fff', logoBars: null },
  weiss: { name: 'Weiß auf Pink', bg: PINK, dot: '#FFFFFF', off: 'rgba(255,255,255,0.13)', win: '#FFD6E4', fingers: ['#fff', '#fff', '#fff', '#fff', '#fff'], sun: 'rgba(255,255,255,0.16)', logoText: '#fff', logoBars: '#fff' },
};
export const MODE_KEYS = Object.keys(MODES);


const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const hash = (n) => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

function nearestLogo(r, g, b) {
  let best = 0, bd = 1e9;
  LOGO_COLS.forEach((hex, i) => {
    const R = parseInt(hex.slice(1, 3), 16), G = parseInt(hex.slice(3, 5), 16), B = parseInt(hex.slice(5, 7), 16);
    const d = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function drawMask(mctx, keys, scale, x0, baseY, solid) {
  const gap = 4;
  let cx = x0;
  const spans = [];
  keys.forEach((key, bi) => {
    const L = SKY[key];
    mctx.save();
    mctx.translate(cx, baseY);
    mctx.scale(scale, scale);
    // Farben fuer die Maske: Grau = Helligkeit, Logofarben nur fuer die Finger des Hochzeitsturms
    const K = { main: '#fff', detail: '#000', detail2: '#bdbdbd', gold: '#fff', roof: '#fff', fingers: LOGO_COLS };
    const P = (col, kind) => {
      if (solid) { if (kind !== 'l') { mctx.fillStyle = '#fff'; mctx.fill(); } return; }
      if (kind === 'l') { mctx.strokeStyle = 'rgba(0,0,0,0.55)'; mctx.lineWidth = 0.16; mctx.stroke(); return; }
      let fill = '#fff';
      if (key === 'turm' && !kind && LOGO_COLS.includes(col)) fill = col;
      else if (kind === 'd') fill = col === '#FFCB03' || col === '#41B73D' ? '#fff' : '#000';
      else if (col === K.detail2) fill = '#bdbdbd';
      else if (col === '#000') fill = '#000';
      mctx.fillStyle = fill;
      mctx.fill();
    };
    L.draw(mctx, P, K);
    mctx.restore();
    spans.push({ key, x0: cx, x1: cx + L.w * scale, name: L.name, bi });
    cx += (L.w + gap) * scale;
  });
  return spans;
}


export function createDotWall() {
  let M = null;
  let LOGO_IMG = null;

  function build(W, H, dpr, S) {
    const gp = Math.max(4, (S.grid * Math.min(W, H)) / 1080);
    const cols = Math.ceil(W / gp) + 1, rows = Math.ceil(H / gp) + 1;
    const portrait = H > W * 1.1;
    const keys = portrait ? ['ludwig', 'turm', 'kapelle']
      : S.set === 'alle' ? ['wald', 'darm', 'loewen', 'ludwig', 'weiss', 'turm', 'kapelle', 'kirche', 'schloss', 'theater']
      : ['wald', 'darm', 'ludwig', 'turm', 'kapelle', 'kirche', 'schloss'];
    const total = keys.reduce((a, k) => a + SKY[k].w, 0) + 4 * (keys.length - 1);
    const scale = Math.min((cols * 0.92) / total, (rows * (portrait ? 0.42 : 0.52)) / 52);
    const baseRow = Math.round(rows * (portrait ? 0.62 : 0.68));
    const x0 = (cols - total * scale) / 2;

    const make = () => { const c = document.createElement('canvas'); c.width = cols; c.height = rows; return c; };
    const mc = make(), sc = make();
    const m = mc.getContext('2d'), sm = sc.getContext('2d');
    m.fillStyle = '#000'; m.fillRect(0, 0, cols, rows);
    const spans = drawMask(m, keys, scale, x0, baseRow, false);
    drawMask(sm, keys, scale, x0, baseRow, true);
    const px = m.getImageData(0, 0, cols, rows).data;
    const inside = sm.getImageData(0, 0, cols, rows).data;

    const bldAt = (c) => { for (const s of spans) if (c >= s.x0 - 1 && c <= s.x1 + 1) return s.bi; return -1; };
    const turmIdx = keys.indexOf('turm');
    const dots = [];
    let topRow = rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const o = (r * cols + c) * 4;
        const a = inside[o + 3] / 255;
        if (a < 0.35) continue;
        const R = px[o], G = px[o + 1], B = px[o + 2];
        const sat = Math.max(R, G, B) - Math.min(R, G, B);
        const bi = bldAt(c);
        const d = { c, r, bi, seed: hash(r * 131 + c * 7.3), h: (baseRow - r) / rows };
        if (sat > 70) { d.type = 'f'; d.fi = nearestLogo(R, G, B); d.I = 1; }
        else {
          d.I = (R / 255) * a;
          d.type = d.I < 0.3 ? 'w' : 'm';
        }
        dots.push(d);
        topRow = Math.min(topRow, r);
      }
    }
    // Hoehe je Gebaeude fuer den Aufbau von unten
    const heights = keys.map(() => 1);
    for (const d of dots) if (d.bi >= 0) heights[d.bi] = Math.max(heights[d.bi], baseRow - d.r);

    // blasse Stadt weit hinten: niedrige Daecher, Giebel, ein paar Tuermchen. Liegt als eigene Ebene hinter den Wahrzeichen.
    const far = [];
    if (S.backdrop) {
      let c = -Math.round(cols * 0.15);
      let k = 0;
      while (c < cols * 1.15) {
        const w = 3 + Math.floor(hash(k * 3.1) * 7);
        const h = 3 + Math.floor(Math.pow(hash(k * 5.7), 1.6) * rows * 0.16);
        const roof = Math.floor(hash(k * 9.3) * 5); // 0 flach, 1 Giebel, 2 Kuppel, 3 Spitze, 4 flach
        for (let dc = 0; dc < w; dc++) {
          const u = (dc + 0.5) / w;
          let top = h;
          if (roof === 1) top = h + Math.round((1 - Math.abs(u - 0.5) * 2) * w * 0.45);
          if (roof === 2) top = h + Math.round(Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)) * w * 0.35);
          if (roof === 3 && dc === Math.floor(w / 2)) top = h + Math.round(rows * 0.05);
          for (let dr = 0; dr < top; dr++) {
            const r = baseRow - dr, cc = c + dc;
            // ab und zu ein Fenster als Luecke, damit es nicht wie eine Flaeche wirkt
            if (hash(cc * 17.3 + r * 3.7) < 0.12) continue;
            far.push({ c: cc, r, I: 0.55 + 0.45 * hash(cc * 1.3 + r) });
          }
        }
        c += w + 1 + Math.floor(hash(k * 7.9) * 4);
        k++;
      }
    }

    // Hintergrund: ausgeschaltete LEDs, einmal vorgezeichnet, groesser als der Schirm fuer die Kamerafahrt
    const mode = MODES[S.mode] || MODES.pink;
    const margin = 0.18;
    const ox = W * margin, oy = H * margin;
    const off = document.createElement('canvas');
    off.width = Math.round((W + ox * 2) * dpr); off.height = Math.round((H + oy * 2) * dpr);
    const oc = off.getContext('2d');
    oc.scale(dpr, dpr);
    const turm = spans[turmIdx];
    const sunC = turm ? (turm.x0 + turm.x1) / 2 : cols / 2, sunR = rows * 0.21, sunY = baseRow - rows * 0.2;
    const rad = (gp * S.size) / 2;
    const c0 = -Math.ceil(ox / gp), c1 = cols + Math.ceil(ox / gp), r0 = -Math.ceil(oy / gp), r1 = rows + Math.ceil(oy / gp);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const inSun = S.sun && (c - sunC) ** 2 + (r - sunY) ** 2 < sunR * sunR && r < baseRow;
        oc.fillStyle = inSun ? mode.sun : mode.off;
        oc.beginPath();
        oc.arc(c * gp + gp / 2 + ox, r * gp + gp / 2 + oy, rad * (inSun ? 0.95 : 0.8), 0, 7);
        oc.fill();
      }
    }
    const sunPos = { x: sunC * gp + gp / 2, y: sunY * gp + gp / 2, r: sunR * gp };
    M = { dpr, W, H, gp, cols, rows, baseRow, dots, spans, heights, off, ox, oy, far, sunPos, turmIdx, keys, mode };
    prepareLogo(S);
  }

  // Logo als Bild (Farben je nach Modus)
  function prepareLogo(S) {
    const mode = MODES[S.mode] || MODES.pink;
    let svg = logoSvg.replace(/fill:#ffffff/g, `fill:${mode.logoText}`);
    if (mode.logoBars) svg = svg.replace(/fill:rgb\([^)]*\)/g, `fill:${mode.logoBars}`);
    svg = svg.replace('<svg ', '<svg width="1682" height="276" ');
    const img = new Image();
    img.onload = () => { LOGO_IMG = img; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const LEVELS = 14;
  function draw(ctx, t, S) {
    if (!M) return;
    const { dpr, W, H, gp, dots, baseRow, heights, mode, keys, turmIdx } = M;
    ctx.fillStyle = mode.bg;
    ctx.fillRect(0, 0, W, H);

    // Kamera: langsamer Schwenk im 40-Sekunden-Loop, leichtes Heben und Senken, echte Perspektive
    const TAU = Math.PI * 2;
    const cam = S.camera;
    const yaw = 0.075 * cam * Math.sin((TAU * t) / 40);
    const pitch = cam * (0.03 + 0.022 * Math.sin((TAU * t) / 20 + 1));
    const dist = Math.max(W, H) * 1.5 * (1 - 0.025 * cam * Math.sin((TAU * t) / 40 + 2));
    const cy0 = H * 0.55;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
    let PX = 0, PY = 0, PK = 1;
    const projTo = (x, y, z) => {
      const X = x - W / 2, Y = y - cy0;
      const X1 = X * cyw + z * syw, Z1 = -X * syw + z * cyw;
      const Y1 = Y * cp - Z1 * spp, Z2 = Y * spp + Z1 * cp;
      PK = dist / (dist + Z2);
      PX = W / 2 + X1 * PK;
      PY = cy0 + Y1 * PK;
    };
    const proj = (x, y, z) => { projTo(x, y, z); return [PX, PY, PK]; };
    // Atmen im 15-Sekunden-Takt
    const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / 15);
    const breathe = 1 - S.pulse * 0.07 + S.pulse * 0.07 * pulse;

    // Hintergrundraster als ferne Ebene
    const zBg = 320 * S.depth + 80;
    {
      const [sx, sy, k] = proj(W / 2, cy0, zBg);
      const bw = (W + M.ox * 2) * k, bh = (H + M.oy * 2) * k;
      ctx.drawImage(M.off, sx - (W / 2 + M.ox) * k, sy - (cy0 + M.oy) * k, bw, bh);
    }
    // weicher Schein hinter dem Hochzeitsturm, atmet mit
    {
      const [gx, gy, k] = proj(M.sunPos.x, M.sunPos.y, zBg * 0.7);
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, M.sunPos.r * 1.9 * k);
      const glowCol = mode.dot === '#FFFFFF' ? '255,255,255' : '230,23,95';
      gr.addColorStop(0, `rgba(${glowCol},${(0.1 + 0.08 * pulse * S.pulse).toFixed(3)})`);
      gr.addColorStop(1, `rgba(${glowCol},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }

    // Eimer je Farbe und Helligkeitsstufe (Zahlen statt Text-Schluessel), dann ein fill pro Eimer
    const colIdx = new Map(), cols = [], buckets = [];
    const add = (col, a, x, y, rr) => {
      const lv = Math.min(LEVELS, Math.round(a * LEVELS));
      if (lv <= 0) return;
      let ci = colIdx.get(col);
      if (ci === undefined) { ci = cols.length; cols.push(col); colIdx.set(col, ci); }
      const bi = ci * (LEVELS + 1) + lv;
      let p = buckets[bi];
      if (!p) { p = new Path2D(); buckets[bi] = p; }
      p.moveTo(x + rr, y);
      p.arc(x, y, rr, 0, Math.PI * 2);
    };

    const rad = (gp * S.size) / 2 * (0.97 + 0.05 * S.pulse * pulse);
    // Tiefe je Wahrzeichen: der Hochzeitsturm steht vorne, die anderen leicht versetzt
    const zB = keys.map((_, bi) => (bi === turmIdx ? -70 : (hash(bi * 4.3 + 1) * 2 - 1) * 55 + 10) * S.depth);
    const zOf = (bi) => (bi >= 0 ? zB[bi] : 0);

    // ferne Stadt als eigene Ebene, liegt unter den Wahrzeichen
    if (M.far.length) {
      const zf = 170 * S.depth + 60;
      const farCol = mode.dot === 'building' ? PINK : mode.dot;
      const fa = (0.24 + 0.08 * pulse * S.pulse) * easeOut(seg(t, 0.2, 2.5));
      const fp = new Path2D();
      for (const f of M.far) {
        projTo(f.c * gp + gp / 2, f.r * gp + gp / 2, zf);
        const rr = rad * 0.78 * PK * (0.8 + 0.2 * f.I);
        fp.moveTo(PX + rr, PY);
        fp.arc(PX, PY, rr, 0, Math.PI * 2);
      }
      ctx.globalAlpha = fa;
      ctx.fillStyle = farCol;
      ctx.fill(fp);
      ctx.globalAlpha = 1;
    }
    const sweepX = S.sweep ? ((t % 16) / 16) * (W + 600) - 300 : -1e5;
    const reflRows = M.rows - baseRow;
    for (const d of dots) {
      // Aufbau: von der Mitte (Hochzeitsturm) nach aussen, jedes Gebaeude waechst von unten
      const order = d.bi >= 0 ? Math.abs(d.bi - turmIdx) : 0;
      const grow = easeOut(seg(t, 0.4 + order * 0.28, 2.0 + order * 0.28));
      if (baseRow - d.r > grow * (heights[d.bi] || 1) + 0.5) continue;
      const x = d.c * gp + gp / 2, y = d.r * gp + gp / 2;
      const z = zOf(d.bi);
      let a, col;
      const wave = 0.86 + 0.14 * Math.sin(d.c * 0.05 - t * 0.9 + d.r * 0.03) * S.shimmer + (1 - S.shimmer) * 0.14;
      const dxs = (x - sweepX) / (gp * 7);
      const sw = dxs > 4 || dxs < -4 ? 0 : Math.exp(-dxs * dxs) * 0.45;
      if (d.type === 'w') {
        if (!S.windows) continue;
        // Fenster gehen langsam an und aus
        const on = clamp((Math.sin(t * (0.25 + d.seed * 0.35) + d.seed * 60) - 0.55) / 0.35);
        if (on <= 0.02) continue;
        a = on * 0.85;
        col = mode.win;
      } else if (d.type === 'f') {
        // Finger leuchten nacheinander auf wie im Logo-Rhythmus
        const pulse = Math.pow(Math.max(0, Math.sin(t * 0.8 - d.fi * 0.55)), 6);
        a = 0.82 + 0.18 * pulse + sw * 0.3;
        col = mode.fingers[d.fi];
      } else {
        // Kanten mit wenig Deckung nicht zu blass werden lassen
        a = Math.min(1, 0.25 + d.I * 0.9) * wave + sw;
        col = mode.dot === 'building' ? BRAND[d.bi % BRAND.length] : mode.dot;
      }
      a = clamp(a * breathe);
      projTo(x, y, z);
      const rr = rad * (0.78 + 0.22 * a) * PK;
      add(col, a, PX, PY, rr);
      // Spiegelung: gleiche Spalte, gespiegelte Zeile, mit Wellengang und Ausblenden
      if (S.reflect > 0) {
        const mr = 2 * baseRow - d.r + 1;
        const depth = (mr - baseRow) / reflRows;
        if (depth < 1) {
          const wob = Math.sin(mr * 0.45 - t * 1.6) * gp * 0.35 * depth;
          projTo(x + wob, mr * gp + gp / 2, z);
          add(col, a * S.reflect * Math.pow(1 - depth, 1.6), PX, PY, rr * 0.9);
        }
      }
    }
    for (let bi = 0; bi < buckets.length; bi++) {
      const p = buckets[bi];
      if (!p) continue;
      ctx.globalAlpha = (bi % (LEVELS + 1)) / LEVELS;
      ctx.fillStyle = cols[Math.floor(bi / (LEVELS + 1))];
      ctx.fill(p);
    }
    ctx.globalAlpha = 1;

    // Horizont als feine Linie, liegt in der Tiefe der Gebaeude
    const hy = baseRow * gp + gp * 1.0;
    const [hx0, hy0] = proj(-W * 0.2, hy, 0), [hx1, hy1] = proj(W * 1.2, hy, 0);
    ctx.strokeStyle = mode.dot === 'building' ? PINK : mode.dot;
    ctx.globalAlpha = 0.45 * easeOut(seg(t, 0, 1.5));
    ctx.lineWidth = Math.max(1, gp * 0.12);
    ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx0 + (hx1 - hx0) * easeOut(seg(t, 0, 1.5)), hy0 + (hy1 - hy0) * easeOut(seg(t, 0, 1.5))); ctx.stroke();
    ctx.globalAlpha = 1;

    // sanfte Vignette gibt Tiefe
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, mode.bg === PINK ? 'rgba(90,0,30,0.28)' : 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (S.logo && LOGO_IMG) {
      const lw = Math.min(W * 0.26, 420);
      ctx.globalAlpha = seg(t, 3, 4.5);
      ctx.drawImage(LOGO_IMG, (W - lw) / 2, H - lw * 0.164 - Math.min(W, H) * 0.05, lw, lw * 0.164);
      ctx.globalAlpha = 1;
    }
  }


  return { build, draw, get M() { return M; } };
}
