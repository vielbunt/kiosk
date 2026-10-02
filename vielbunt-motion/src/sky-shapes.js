// Darmstadt als flache Silhouetten, nach Fotos nachgezeichnet.
// Genutzt von den Skyline-Szenen und der Punktwand im vielbunt-loop.

const C = { yellow: '#FFCB03', green: '#41B73D' };
const LOGO_COLS = ['#E6175F', '#FFCB03', '#41B73D', '#13A3DC', '#6546B4'];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// Balken wie im Logo: gerader Schaft, oben ein exakter Halbkreis
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

// Einheiten ungefaehr Meter, Ursprung unten links, y nach oben negativ.
// P(farbe) fuellt die aktuelle Form, P(farbe, 'd') ist ein Detail (Fenster), P(farbe, 'l') eine feine Linie.

const R = (c, x, y, w, h) => c.rect(x, y, w, h);
function archWin(c, x, y, w, h) {
  // Rundbogenfenster: y = Unterkante
  const r = w / 2;
  c.moveTo(x, y);
  c.lineTo(x, y - h + r);
  c.arc(x + r, y - h + r, r, Math.PI, 0);
  c.lineTo(x + w, y);
  c.closePath();
}
export function onionPath(c, cx, y, r, h) {
  c.beginPath();
  c.moveTo(cx - r * 0.72, y);
  c.bezierCurveTo(cx - r * 1.3, y - h * 0.32, cx - r * 0.55, y - h * 0.72, cx, y - h);
  c.bezierCurveTo(cx + r * 0.55, y - h * 0.72, cx + r * 1.3, y - h * 0.32, cx + r * 0.72, y);
  c.closePath();
}
function cross(c, x, y, s) { c.beginPath(); R(c, x - 0.08 * s, y - 2.4 * s, 0.16 * s, 2.4 * s); R(c, x - 0.6 * s, y - 1.8 * s, 1.2 * s, 0.16 * s); }
function hLine(c, x0, x1, y) { c.moveTo(x0, y); c.lineTo(x1, y); }

export const SKY = {
  wald: { w: 34, h: 43, name: 'Waldspirale', draw(c, P, K) {
    // gestufte Terrassen mit gewellter Oberkante
    const steps = 8;
    c.beginPath();
    c.moveTo(0, 0);
    for (let i = 0; i < steps; i++) {
      const x = i * 3.2, top = -(4 + i * 3.4);
      c.lineTo(x, top);
      c.bezierCurveTo(x + 1, top - 0.9, x + 2.2, top + 0.5, x + 3.2, top - 0.3);
    }
    c.lineTo(steps * 3.2, 0);
    c.closePath();
    P(K.main);
    // runder Eckturm mit grosser goldener Zwiebel
    c.beginPath(); c.moveTo(25.2, 0); c.lineTo(25.2, -33); c.bezierCurveTo(25.2, -35, 33.8, -35, 33.8, -33); c.lineTo(33.8, 0); c.closePath(); P(K.main);
    onionPath(c, 29.5, -34.2, 3.6, 7.2); P(K.gold);
    c.beginPath(); c.arc(29.5, -41.8, 0.45, 0, 7); P(K.gold);
    // kleine Tuermchen mit Kugeln
    for (const [x, top] of [[7.8, -11.8], [17.4, -22]]) {
      c.beginPath(); R(c, x - 0.8, top - 3.6, 1.6, 3.8); P(K.main);
      onionPath(c, x, top - 3.6, 1.2, 2.6); P(K.gold);
    }
    // gewellte Fassadenbaender
    c.beginPath();
    for (let y = -3; y > -32; y -= 3) {
      c.moveTo(0.3, y);
      for (let x = 0.3; x < 33.6; x += 0.8) {
        const topAt = x < 25.2 ? -(4 + Math.floor(x / 3.2) * 3.4) : -33;
        if (y < topAt + 0.6) { c.moveTo(x + 0.8, y + Math.sin((x + 0.8) * 0.9) * 0.25); continue; }
        c.lineTo(x + 0.8, y + Math.sin((x + 0.8) * 0.9) * 0.25);
      }
    }
    P(K.detail, 'l');
    // unregelmaessige Fenster mit bunten Rahmen
    for (let i = 0; i < 46; i++) {
      const x = 0.8 + hash(i) * 32;
      const topAt = x < 25.2 ? -(4 + Math.floor(x / 3.2) * 3.4) : -33;
      const y = -1 - hash(i + 40) * (-topAt - 2.5);
      c.beginPath(); archWin(c, x, y, 0.8, 1.2); P(LOGO_COLS[i % 5], 'd');
    }
    // Baeume auf den Terrassen
    for (let i = 0; i < 7; i++) {
      const x = 1.6 + i * 3.2, y = -(4 + i * 3.4) - 0.2;
      c.beginPath(); c.arc(x, y - 1, 1.1, 0, 7); c.arc(x + 0.9, y - 0.6, 0.8, 0, 7); c.arc(x - 0.8, y - 0.5, 0.7, 0, 7); P(C.green, 'd');
    }
  } },
  darm: { w: 36, h: 20, name: 'darmstadtium', draw(c, P, K) {
    // Natursteinblock mit schraegen Waenden
    c.beginPath(); c.moveTo(0, 0); c.lineTo(1.4, -17.5); c.lineTo(12.4, -19.4); c.lineTo(13.2, 0); c.closePath(); P(K.main);
    c.beginPath();
    for (let k = 0; k < 7; k++) { const y = -3 - k * 2.2; const x0 = 1.8 + ((k * 3.7) % 5); R(c, x0, y, 3.4 + (k % 3), 0.45); }
    P(K.detail, 'd');
    // Glashalle, kippt nach aussen
    c.beginPath(); c.moveTo(14.2, -2.4); c.lineTo(11.8, -16.6); c.lineTo(35, -18.2); c.lineTo(32.2, -2.4); c.closePath(); P(K.main);
    c.beginPath(); R(c, 14.8, -2.4, 17, 2.4); P(K.detail2);
    // Pfosten und Riegel
    c.beginPath();
    for (let i = 1; i < 14; i++) { const u = i / 14; c.moveTo(14.2 + (32.2 - 14.2) * u, -2.4); c.lineTo(11.8 + (35 - 11.8) * u, -16.6 - 1.6 * u); }
    for (let j = 1; j < 6; j++) { const v = j / 6; hLine(c, 14.2 - 2.4 * v, 32.2 + 2.8 * v, -2.4 - 14.2 * v - 0.8 * v); }
    P(K.detail, 'l');
    // Dachkante steht vor
    c.beginPath(); c.moveTo(11.3, -16.6); c.lineTo(35.6, -18.3); c.lineTo(35.6, -18.9); c.lineTo(11.3, -17.2); c.closePath(); P(K.main);
    // Rest der Stadtmauer davor
    c.beginPath(); c.moveTo(9, 0); c.lineTo(9.3, -2.8); c.lineTo(12, -3.3); c.lineTo(15, -2.9); c.lineTo(18.5, -3.4); c.lineTo(21, -2.6); c.lineTo(21.2, 0); c.closePath(); P(K.detail2);
    c.beginPath();
    for (let i = 0; i < 14; i++) R(c, 9.6 + (i % 7) * 1.6 + (i > 6 ? 0.8 : 0), -0.9 - (i > 6 ? 1.1 : 0), 1.1, 0.5);
    P(K.detail, 'd');
  } },
  loewen: { w: 26, h: 13.5, name: 'Löwentor', draw(c, P, K) {
    const xs = [0, 4, 8, 16.6, 20.6, 24.6];
    for (const [a, b] of [[0, 9.4], [16.6, 26]]) { c.beginPath(); R(c, a, -1.6, b - a, 1.6); R(c, a - 0.1, -1.9, b - a + 0.2, 0.3); P(K.main); }
    for (const x of xs) {
      c.beginPath(); R(c, x, -10, 1.4, 10); R(c, x - 0.15, -10.35, 1.7, 0.35); P(K.main);
      c.beginPath(); R(c, x, -8.7, 1.4, 0.32); R(c, x, -8.05, 1.4, 0.16); P(K.detail, 'd');
      // sitzender Loewe mit Maehne, Blick nach vorne
      c.beginPath();
      c.moveTo(x - 0.05, -10.35);
      c.lineTo(x - 0.05, -11.1);
      c.quadraticCurveTo(x + 0.1, -11.9, x + 0.55, -12.1);
      c.lineTo(x + 1.5, -12.1);
      c.lineTo(x + 1.5, -10.35);
      c.closePath();
      c.moveTo(x + 1.75, -12.45);
      c.arc(x + 1.05, -12.45, 0.72, 0, 7);
      P(K.main);
      c.beginPath(); c.arc(x + 1.08, -12.35, 0.34, 0, 7); P(K.detail2, 'd');
      c.beginPath(); R(c, x + 0.95, -11.4, 0.28, 1.05); R(c, x + 1.3, -11.4, 0.28, 1.05); P(K.detail, 'l');
    }
  } },
  ludwig: { w: 8, h: 40, name: 'Langer Ludwig', draw(c, P, K) {
    c.beginPath(); R(c, 0, -0.8, 8, 0.8); R(c, 0.6, -1.6, 6.8, 0.8); R(c, 1.1, -2.2, 5.8, 0.6); R(c, 1.4, -7.4, 5.2, 5.2); R(c, 1.0, -8.2, 6, 0.8); P(K.main);
    c.beginPath(); R(c, 2.2, -6.5, 3.6, 3.2); P(K.detail, 'l');
    c.beginPath(); R(c, 2.1, -9.0, 3.8, 0.8); R(c, 2.35, -9.6, 3.3, 0.6); P(K.main);
    c.beginPath(); c.moveTo(2.5, -9.6); c.lineTo(2.8, -32.6); c.lineTo(5.2, -32.6); c.lineTo(5.5, -9.6); c.closePath(); P(K.main);
    c.beginPath();
    for (let i = 1; i < 6; i++) { const u = i / 6; c.moveTo(2.5 + 3 * u, -10); c.lineTo(2.8 + 2.4 * u, -32.3); }
    P(K.detail, 'l');
    c.beginPath(); c.moveTo(2.7, -32.6); c.lineTo(2.2, -33.4); c.lineTo(5.8, -33.4); c.lineTo(5.3, -32.6); c.closePath(); R(c, 2.0, -34.2, 4, 0.8); R(c, 2.7, -35.4, 2.6, 1.2); P(K.main);
    // Ludwig I. im Mantel
    c.beginPath(); c.moveTo(3.1, -35.4); c.lineTo(4.95, -35.4); c.lineTo(4.6, -38.4); c.quadraticCurveTo(4, -38.9, 3.4, -38.4); c.closePath(); c.moveTo(4.45, -39.15); c.arc(4, -39.15, 0.45, 0, 7); P(K.main);
  } },
  weiss: { w: 10, h: 40, name: 'Weißer Turm', draw(c, P, K) {
    c.beginPath(); c.moveTo(0.5, 0); c.lineTo(0.5, -2); c.lineTo(0.8, -2); c.lineTo(1.1, -25); c.lineTo(8.9, -25); c.lineTo(9.2, -2); c.lineTo(9.5, -2); c.lineTo(9.5, 0); c.closePath(); P(K.main);
    c.beginPath(); hLine(c, 0.95, 9.05, -9); hLine(c, 1.05, 8.95, -17); P(K.detail, 'l');
    c.beginPath(); archWin(c, 4.4, -5, 1.2, 2.4); archWin(c, 2.5, -12, 1, 2.2); archWin(c, 6.5, -12, 1, 2.2); archWin(c, 4.45, -19.5, 1.1, 2.2); P(K.detail, 'd');
    c.beginPath(); c.arc(5, -22.4, 1.25, 0, 7); P(K.detail, 'd');
    c.beginPath(); c.moveTo(5, -22.4); c.lineTo(5, -23.3); c.moveTo(5, -22.4); c.lineTo(5.7, -22.1); P(K.main, 'l');
    c.beginPath(); R(c, 0.6, -26.2, 8.8, 1.2); P(K.main);
    c.beginPath(); for (let x = 1.1; x < 9; x += 0.8) R(c, x, -25.9, 0.35, 0.7); P(K.detail, 'd');
    c.beginPath(); c.moveTo(1, -26.2); c.bezierCurveTo(1, -30.2, 3.4, -30.6, 4.2, -32); c.lineTo(5.8, -32); c.bezierCurveTo(6.6, -30.6, 9, -30.2, 9, -26.2); c.closePath(); P(K.main);
    c.beginPath(); c.moveTo(3, -26.4); c.quadraticCurveTo(3.4, -30, 4.5, -31.8); c.moveTo(7, -26.4); c.quadraticCurveTo(6.6, -30, 5.5, -31.8); c.moveTo(5, -26.4); c.lineTo(5, -31.8); P(K.detail, 'l');
    c.beginPath(); R(c, 4.2, -34.6, 1.6, 2.7); P(K.main);
    c.beginPath(); archWin(c, 4.65, -32.4, 0.7, 1.6); P(K.detail, 'd');
    onionPath(c, 5, -34.6, 1.0, 2.4); P(K.main);
    c.beginPath(); R(c, 4.93, -39.8, 0.14, 2.9); c.moveTo(5.35, -38.4); c.arc(5, -38.4, 0.35, 0, 7); P(K.main);
  } },
  turm: { w: 14, h: 49, name: 'Hochzeitsturm', draw(c, P, K) {
    c.beginPath(); R(c, 0, -2, 14, 2); R(c, 0.3, -4, 13.4, 2); R(c, 0.6, -6, 12.8, 2); P(K.main);
    c.beginPath(); R(c, 0.9, -33.4, 12.2, 27.6); P(K.main);
    c.beginPath(); hLine(c, 0.9, 13.1, -6.2); hLine(c, 0.9, 13.1, -17.6); hLine(c, 0.9, 13.1, -30.6); P(K.detail, 'l');
    // Eckbandfenster im 4. und 5. OG als Sprossenreihe
    c.beginPath();
    for (const [y, h] of [[-20.8, 3.2], [-26, 2.6]]) for (let x = 6.3; x < 13.05; x += 0.84) R(c, x, y - h, 0.62, h);
    P(K.detail, 'd');
    // Treppenhausfenster, klein, uebereinander
    c.beginPath(); for (let k = 0; k < 5; k++) R(c, 2.3, -8.2 - k * 2.9, 0.7, 1.7); P(K.detail, 'd');
    c.beginPath(); R(c, 3.8, -13.2, 1.6, 1.2); R(c, 3.8, -29.4, 1.6, 1.4); P(K.detail, 'd');
    // die fuenf Finger mit innerem Bogen und Aussichtsfenster
    const tops = [40.7, 44.6, 48.5, 44.6, 40.7];
    for (let k = 0; k < 5; k++) {
      const x = 0.9 + k * 2.44 + 0.08;
      arch(c, x, -tops[k], 2.28, tops[k] - 33.2); P(K.fingers[k]);
      arch(c, x + 0.4, -tops[k] + 0.4, 1.48, tops[k] - 34.6); P(K.detail, 'l');
      c.beginPath(); archWin(c, x + 0.55, -34, 1.18, 2.3); P(K.detail, 'd');
    }
    c.beginPath(); R(c, 0.7, -33.4, 12.6, 0.35); P(K.main);
  } },
  kapelle: { w: 20, h: 28, name: 'Russische Kapelle', draw(c, P, K) {
    // Apsis links
    c.beginPath(); R(c, 0.5, -7, 3, 7); P(K.main);
    onionPath(c, 2, -7, 1.3, 2.8); P(K.gold); cross(c, 2, -9.8, 0.55); P(K.gold);
    // Schiff mit Kokoschnik-Giebeln
    c.beginPath(); R(c, 3.3, -9.5, 11, 9.5); for (let k = 0; k < 3; k++) { c.moveTo(3.5 + k * 3.6 + 3.6, -9.5); c.arc(5.3 + k * 3.6, -9.5, 1.8, 0, Math.PI, true); } P(K.main);
    c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(3.9 + k * 3.6 + 2.8, -9.5); c.arc(5.3 + k * 3.6, -9.5, 1.4, 0, Math.PI, true); } P(K.detail, 'l');
    c.beginPath(); for (let k = 0; k < 3; k++) archWin(c, 4.7 + k * 3.6, -3.5, 1.2, 3.2); P(K.detail, 'd');
    // hoher Tambour mit Bogenfenstern und grosse Zwiebel
    c.beginPath(); R(c, 7, -17.6, 4.2, 8.1); for (let k = 0; k < 3; k++) { c.moveTo(7.7 + k * 1.4 + 0.7, -17.6); c.arc(7.7 + k * 1.4, -17.6, 0.7, 0, Math.PI, true); } P(K.main);
    c.beginPath(); for (let k = 0; k < 3; k++) archWin(c, 7.45 + k * 1.3, -12, 0.6, 2.6); P(K.detail, 'd');
    onionPath(c, 9.1, -18.3, 3.0, 6.8); P(K.gold);
    c.beginPath(); c.moveTo(9.1, -25.1); c.bezierCurveTo(8, -22, 7.6, -20, 7.6, -18.3); c.moveTo(9.1, -25.1); c.bezierCurveTo(10.2, -22, 10.6, -20, 10.6, -18.3); P(K.detail, 'l');
    cross(c, 9.1, -25.1, 1); P(K.gold);
    // Glockenturm ueber dem Eingang mit steilem Zeltdach
    c.beginPath(); R(c, 14.6, -13, 3.4, 13); P(K.main);
    c.beginPath(); archWin(c, 15.5, 0, 1.6, 4.4); archWin(c, 15.65, -10, 1.3, 2.3); P(K.detail, 'd');
    c.beginPath(); R(c, 15.1, -9.2, 2.4, 2.6); P(K.gold, 'd');
    c.beginPath(); c.moveTo(14.4, -13); c.lineTo(16.3, -21.2); c.lineTo(18.2, -13); c.closePath(); P(K.roof);
    c.beginPath(); c.moveTo(15, -14.5); c.lineTo(17.6, -14.5); c.moveTo(15.4, -16.3); c.lineTo(17.2, -16.3); c.moveTo(15.8, -18.1); c.lineTo(16.8, -18.1); P(K.detail, 'l');
    onionPath(c, 16.3, -21.1, 0.9, 2.1); P(K.gold); cross(c, 16.3, -23.2, 0.5); P(K.gold);
  } },
  kirche: { w: 40, h: 35, name: 'Ludwigskirche', draw(c, P, K) {
    c.beginPath(); R(c, 0, -17, 40, 17); R(c, -0.5, -18, 41, 1); R(c, 1.2, -20, 37.6, 2); P(K.main);
    c.beginPath(); for (let x = 1.6; x < 39; x += 3.3) { if (x > 12.5 && x < 27.5) continue; c.moveTo(x, -0.2); c.lineTo(x, -16.8); } P(K.detail, 'l');
    c.beginPath(); for (const x of [3.2, 6.5, 9.8, 28.4, 31.7, 35]) archWin(c, x, -9, 1.6, 4.6); P(K.detail, 'd');
    // flache Kuppel mit Stufenringen
    c.beginPath(); c.ellipse(20, -20, 17.6, 11.6, 0, Math.PI, 0); c.closePath(); P(K.main);
    c.beginPath(); for (const s of [0.96, 0.9]) c.ellipse(20, -20, 17.6 * s, 11.6 * (0.2 + (1 - s) * 2.2), 0, Math.PI, 0); P(K.detail, 'l');
    c.beginPath(); c.ellipse(20, -20, 12, 10.2, 0, Math.PI * 1.08, Math.PI * 1.92); P(K.detail, 'l');
    c.beginPath(); R(c, 18.2, -33.6, 3.6, 2.2); c.ellipse(20, -33.6, 2.1, 1.3, 0, Math.PI, 0); R(c, 19.85, -36, 0.3, 1.2); P(K.main);
    c.beginPath(); R(c, 18.8, -33.2, 0.6, 1.3); R(c, 20.6, -33.2, 0.6, 1.3); P(K.detail, 'd');
    // Portalbau mit grosser Bogennische
    c.beginPath(); R(c, 12.6, -18.6, 14.8, 0.7); R(c, 13, -17.9, 14, 17.9); P(K.detail2);
    c.beginPath(); archWin(c, 16.5, 0, 7, 13.8); P(K.detail, 'd');
    c.beginPath(); R(c, 18.7, -6, 2.6, 6); archWin(c, 18.2, -7.5, 3.6, 3.4); P(K.detail2);
  } },
  schloss: { w: 40, h: 52, name: 'Schloss', draw(c, P, K) {
    for (const x0 of [0, 25]) {
      c.beginPath(); R(c, x0, -15, 15, 15); c.moveTo(x0 + 0.2, -15); c.lineTo(x0 + 1.6, -19.4); c.lineTo(x0 + 13.4, -19.4); c.lineTo(x0 + 14.8, -15); P(K.main);
      c.beginPath(); for (let x = x0 + 1.2; x < x0 + 14; x += 2.6) { R(c, x, -12.8, 1.1, 2.4); R(c, x, -7.4, 1.1, 2.4); R(c, x, -2.6, 1.1, 2); } P(K.detail, 'd');
      c.beginPath(); for (let x = x0 + 2.4; x < x0 + 13; x += 3.3) archWin(c, x, -16, 0.9, 1.6); P(K.detail, 'd');
      c.beginPath(); hLine(c, x0, x0 + 15, -5.6); hLine(c, x0, x0 + 15, -10.4); P(K.detail, 'l');
    }
    c.beginPath(); R(c, 15, -30, 10, 30); P(K.main);
    c.beginPath(); c.moveTo(15.6, -0.2); c.lineTo(15.6, -29.8); c.moveTo(24.4, -0.2); c.lineTo(24.4, -29.8); hLine(c, 15, 25, -15.3); P(K.detail, 'l');
    c.beginPath(); archWin(c, 19, 0, 2, 4.2); archWin(c, 19.2, -8.4, 1.6, 3.2); archWin(c, 19.2, -18.4, 1.6, 3); P(K.detail, 'd');
    c.beginPath(); c.arc(20, -26.2, 2, 0, 7); P(K.gold, 'd');
    c.beginPath(); c.moveTo(20, -26.2); c.lineTo(20, -27.6); c.moveTo(20, -26.2); c.lineTo(21, -25.8); P(K.main, 'l');
    c.beginPath(); R(c, 15.8, -36.6, 8.4, 6.6); R(c, 15.4, -37.3, 9.2, 0.7); P(K.main);
    c.beginPath(); archWin(c, 17, -30.8, 1.8, 4.2); archWin(c, 21.2, -30.8, 1.8, 4.2); P(K.detail, 'd');
    c.beginPath(); c.moveTo(15.9, -37.3); c.bezierCurveTo(15.9, -41, 18.2, -41.2, 18.9, -42.8); c.lineTo(21.1, -42.8); c.bezierCurveTo(21.8, -41.2, 24.1, -41, 24.1, -37.3); c.closePath(); P(K.main);
    c.beginPath(); c.moveTo(20, -37.5); c.lineTo(20, -42.6); c.moveTo(17.8, -37.5); c.quadraticCurveTo(18.2, -40.5, 19.2, -42.6); c.moveTo(22.2, -37.5); c.quadraticCurveTo(21.8, -40.5, 20.8, -42.6); P(K.detail, 'l');
    c.beginPath(); R(c, 18.9, -45.8, 2.2, 3.1); P(K.main);
    c.beginPath(); archWin(c, 19.55, -43.1, 0.9, 1.8); P(K.detail, 'd');
    onionPath(c, 20, -45.8, 1.3, 2.4); P(K.main);
    c.beginPath(); R(c, 19.93, -51.8, 0.14, 3.8); c.moveTo(20.4, -49.3); c.arc(20, -49.3, 0.4, 0, 7); P(K.main);
  } },
  theater: { w: 38, h: 24, name: 'Staatstheater', draw(c, P, K) {
    c.beginPath(); R(c, 4, -13, 30, 13); R(c, 13, -23.6, 13, 10.6); P(K.main);
    c.beginPath(); hLine(c, 4, 34, -11.2); for (let x = 14.6; x < 25.5; x += 1.6) { c.moveTo(x, -23.2); c.lineTo(x, -13.4); } P(K.detail, 'l');
    c.beginPath(); R(c, 6, -9.2, 26, 5.6); P(K.detail2);
    c.beginPath(); for (let x = 7.3; x < 31.5; x += 1.3) { c.moveTo(x, -9); c.lineTo(x, -3.8); } P(K.detail, 'l');
    c.beginPath(); c.roundRect ? c.roundRect(0, -10.6, 38, 1.5, 0.75) : R(c, 0, -10.6, 38, 1.5); P(K.main);
    // Pilzstuetzen auf dem Georg-Buechner-Platz
    for (const x of [2.6, 10.4, 27.6, 35.4]) {
      c.beginPath(); R(c, x - 0.35, -6.2, 0.7, 6.2);
      c.moveTo(x - 0.35, -6.2); c.bezierCurveTo(x - 0.45, -7.3, x - 2.8, -7.6, x - 3.1, -8); c.lineTo(x + 3.1, -8); c.bezierCurveTo(x + 2.8, -7.6, x + 0.45, -7.3, x + 0.35, -6.2); c.closePath();
      P(K.main);
    }
  } },
};

