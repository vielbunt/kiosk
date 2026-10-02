// Gemeinsame Regeln fuer alle Terminanzeigen (kiosk.html, kiosk-lite, vielbunt-loop, Postergenerator).
// Der Worker wendet sie auf den Kalender an, bevor er ihn ausliefert. Die Anzeigen muessen also nix
// mehr selbst filtern, sie lesen nur noch die Markierung X-VIELBUNT-INTERN.

// Interne Termine (Auf-/Abbau, intern, Blocker, Vormerkung, Klausur, Kasse, abgesagt ...) fliegen ganz raus
export const AUSBLENDEN = /\b(?:auf|ab)bau(?:en)?\b|\bintern(?:e[nrs]?)?\b|^\W*(?:blocker|vormerkung)\b|klausur|kassen(?:prüfung|übergabe|meeting)|\babrechnung\b|\binventur\b|abgesagt/i;

// Treffen von AGs, AKs, Vorstand ... bleiben sichtbar, werden aber blasser dargestellt.
// Kuerzel nur als eigenes Wort (sonst waere HALLOWEEN wegen "HA" intern), Unter-AG, U-AK, UUAK und AGs zaehlen mit.
const KUERZEL = /(?:^|[^\p{L}])U{0,2}(?:AGL|AGs?|AKÖ|AKs?|JAK|JV|HA)(?![\p{L}])/u;
const GRAU = /vorstandssitzung|jugendvorstand|mitgliederversammlung|renovierung|runder tisch/i;
export const istIntern = (titel) => KUERZEL.test(titel) || GRAU.test(titel);

const UNSICHTBAR = new Set(['PRIVATE', 'CONFIDENTIAL']);

// ICS-Text rein, gefilterter ICS-Text raus. Zeilenenden und Faltung des Originals bleiben erhalten.
// Bewusst mit indexOf statt grosser Regexe: im kostenlosen Cloudflare-Tarif gibt es nur 10 ms CPU pro Aufruf.
export function filtereKalender(ics) {
  const nl = ics.includes('\r\n') ? '\r\n' : '\n';
  const teile = []; // abwechselnd Text dazwischen und einzelne VEVENTs
  const termine = [];
  let pos = 0;
  for (;;) {
    const a = ics.indexOf('BEGIN:VEVENT', pos);
    if (a < 0) break;
    let e = ics.indexOf('END:VEVENT', a);
    if (e < 0) break;
    e += 'END:VEVENT'.length;
    if (ics[e] === '\r') e++;
    if (ics[e] === '\n') e++;
    teile.push(ics.slice(pos, a));
    const text = ics.slice(a, e);
    termine.push({ i: teile.length, text, ...lies(text) });
    teile.push(text);
    pos = e;
  }
  teile.push(ics.slice(pos));

  const raus = new Set();
  const exdates = new Map(); // UID -> EXDATE-Zeilen fuer die Serie
  const serien = new Set();
  for (const t of termine) if (!t.rid) serien.add(t.uid);

  for (const t of termine) {
    const weg = AUSBLENDEN.test(t.titel) || UNSICHTBAR.has(t.klasse) || t.status === 'CANCELLED';
    if (!weg) continue;
    raus.add(t.i);
    // geloeschte Ausnahme einer Serie: Termin muss als EXDATE in die Serie, sonst taucht der
    // urspruengliche Serientermin an dieser Stelle wieder auf
    if (t.rid && serien.has(t.uid)) {
      if (!exdates.has(t.uid)) exdates.set(t.uid, []);
      exdates.get(t.uid).push('EXDATE' + t.rid);
    }
  }

  for (const t of termine) {
    if (raus.has(t.i)) { teile[t.i] = ''; continue; }
    const extra = [];
    if (!t.rid && exdates.has(t.uid)) extra.push(...exdates.get(t.uid));
    if (istIntern(t.titel)) extra.push('X-VIELBUNT-INTERN:TRUE');
    if (!extra.length) continue;
    const ende = t.text.lastIndexOf('END:VEVENT');
    teile[t.i] = t.text.slice(0, ende) + extra.join(nl) + nl + t.text.slice(ende);
  }
  return teile.join('');
}

// Liest UID, SUMMARY, CLASS, STATUS und RECURRENCE-ID in einem Durchgang ueber die Zeilen.
// Gefaltete Zeilen (beginnen mit Leerzeichen oder Tab) haengen an der Zeile davor.
const FELDER = ['UID', 'SUMMARY', 'CLASS', 'STATUS', 'RECURRENCE-ID'];

function lies(text) {
  const roh = {};
  let start = text.indexOf('\n') + 1; // erste Zeile ist BEGIN:VEVENT
  while (start > 0 && start < text.length) {
    let ende = text.indexOf('\n', start);
    if (ende < 0) ende = text.length;
    const c = text.charCodeAt(start);
    // nur Zeilen, die mit U, S, C oder R anfangen, koennen interessant sein
    if (c === 85 || c === 83 || c === 67 || c === 82) {
      for (const name of FELDER) {
        if (roh[name] === undefined && text.startsWith(name, start)) {
          const z = text.charCodeAt(start + name.length);
          if (z !== 58 && z !== 59) continue; // ":" oder ";"
          while (ende < text.length && (text[ende + 1] === ' ' || text[ende + 1] === '\t')) {
            const n = text.indexOf('\n', ende + 1);
            ende = n < 0 ? text.length : n;
          }
          let wert = text.slice(start + name.length, ende);
          if (wert.includes('\n')) wert = wert.replace(/\r?\n[ \t]/g, '');
          roh[name] = wert.endsWith('\r') ? wert.slice(0, -1) : wert;
          break;
        }
      }
    }
    if (text.startsWith('BEGIN:VALARM', start)) break; // Erinnerungen haben eigene SUMMARY/STATUS
    start = ende + 1;
  }
  const wert = (name) => { const r = roh[name] || ''; return r.slice(r.indexOf(':') + 1); };
  return {
    uid: wert('UID').trim(),
    titel: wert('SUMMARY').replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' '),
    klasse: wert('CLASS').trim().toUpperCase(),
    status: wert('STATUS').trim().toUpperCase(),
    // alles hinter "RECURRENCE-ID", also Parameter plus Wert, z. B. ";TZID=Europe/Berlin:20261005T190000"
    rid: roh['RECURRENCE-ID'] || '',
  };
}
