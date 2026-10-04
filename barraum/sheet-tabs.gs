/**
 * Optional: blendet im Google Sheet "Barraum-Kiosk" alle Tabs aus, die der gewählte Modus nicht braucht.
 *
 * Einbauen (einmalig, geht nicht automatisch):
 *   1. Im Sheet: Erweiterungen > Apps Script
 *   2. Den vorhandenen Code ersetzen durch diese Datei, speichern
 *   3. Im Tab Start den Modus einmal ändern. Google fragt nach einer Berechtigung (nur für dieses Sheet), bestätigen.
 *
 * Danach zeigt das Sheet nur noch die passenden Tabs. Der Bildschirm im Barraum liest hidden Tabs genauso wie sichtbare.
 * Alles wieder einblenden: im Apps-Script-Editor die Funktion alleZeigen ausführen.
 */
const TABS_IMMER = ['Start', 'Einstellungen', 'Kioske', 'Details'];
const TABS_JE_MODUS = {
  'standard': ['Getränkekarte'],
  'event': ['Event', 'Event-Ablauf', 'Getränkekarte'],
  'queerbar': ['Queerbar Slides', 'Queerbar Getränke', 'Queerbar Songs'],
  '7-jahre-queerbar': ['Queerbar Slides', 'Queerbar Getränke', 'Queerbar Songs'],
  'praesentation': []
};

function onEdit(e) {
  if (!e || !e.range) return;
  const blatt = e.range.getSheet();
  if (blatt.getName() !== 'Start' || e.range.getA1Notation() !== 'B3') return;
  zeigeFuer(String(e.value || '').trim());
}

function zeigeFuer(modus) {
  const ss = SpreadsheetApp.getActive();
  const sichtbar = new Set(TABS_IMMER.concat(TABS_JE_MODUS[modus] || []));
  // erst einblenden, dann ausblenden, damit immer mindestens ein Tab sichtbar bleibt
  ss.getSheets().forEach(s => { if (sichtbar.has(s.getName())) s.showSheet(); });
  ss.getSheets().forEach(s => { if (!sichtbar.has(s.getName())) s.hideSheet(); });
}

function alleZeigen() {
  SpreadsheetApp.getActive().getSheets().forEach(s => s.showSheet());
}
