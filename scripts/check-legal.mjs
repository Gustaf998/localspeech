// Prueft, dass Rechtstexte und UI-Texte in allen sechs Sprachen vollstaendig
// sind — und dass index.html/app.html keinen Schluessel verwenden, den es
// nicht gibt.
//
// Warum ein eigenes Skript: Ein fehlender Schluessel faellt beim Bauen NICHT
// auf. t() faellt still auf Englisch bzw. Deutsch zurueck, die Seite sieht
// heil aus — und ein spanischer Nutzer liest deutsche Rechtstexte. Genau das
// soll hier auffliegen, bevor deployt wird.
//
// Aufruf: npm run check:legal   (Exit-Code 1 bei Befund)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['de', 'en', 'es', 'fr', 'it', 'pt'];
let fehler = 0;

const meldung = (text) => {
  console.error('  ✗ ' + text);
  fehler++;
};

// Schluessel je Sprachblock einer Woerterbuch-Datei einsammeln. Bewusst per
// Textanalyse statt Import: Das Skript soll ohne TypeScript-Toolchain laufen.
function keysProSprache(datei) {
  const zeilen = fs.readFileSync(path.join(root, datei), 'utf8').split(/\r?\n/);
  const ergebnis = {};
  let aktuell = null;
  for (const zeile of zeilen) {
    const start = zeile.match(/^const (de|en|es|fr|it|pt)\s*:\s*\w+\s*=\s*\{/);
    if (start) {
      aktuell = start[1];
      ergebnis[aktuell] = new Set();
      continue;
    }
    if (aktuell && /^\};/.test(zeile)) {
      aktuell = null;
      continue;
    }
    const treffer = zeile.match(/^\s*'([^']+)':/);
    if (aktuell && treffer) ergebnis[aktuell].add(treffer[1]);
  }
  return ergebnis;
}

for (const datei of ['src/i18n.ts', 'src/legal-i18n.ts']) {
  console.log(`\n${datei}`);
  const proSprache = keysProSprache(datei);
  const fehlende = LANGS.filter((l) => !proSprache[l]);
  if (fehlende.length) {
    meldung(`Sprachbloecke nicht gefunden: ${fehlende.join(', ')}`);
    continue;
  }
  const referenz = proSprache.de;
  console.log(`  Referenz (de): ${referenz.size} Schluessel`);
  for (const lang of LANGS) {
    if (lang === 'de') continue;
    const fehlt = [...referenz].filter((k) => !proSprache[lang].has(k));
    const ueberzaehlig = [...proSprache[lang]].filter((k) => !referenz.has(k));
    if (fehlt.length) meldung(`${lang}: ${fehlt.length} Schluessel fehlen → ${fehlt.join(', ')}`);
    if (ueberzaehlig.length)
      meldung(`${lang}: ${ueberzaehlig.length} unbekannte Schluessel → ${ueberzaehlig.join(', ')}`);
    if (!fehlt.length && !ueberzaehlig.length) console.log(`  ✓ ${lang} vollstaendig`);
  }
}

// Verwendete Schluessel im Markup gegen die Woerterbuecher pruefen.
const alleKeys = new Set([
  ...keysProSprache('src/i18n.ts').de,
  ...keysProSprache('src/legal-i18n.ts').de,
]);

console.log('\nMarkup');
for (const datei of ['index.html', 'app.html']) {
  const html = fs.readFileSync(path.join(root, datei), 'utf8');
  const verwendet = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) verwendet.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const paar of m[1].split(';')) {
      const k = paar.split(':')[1];
      if (k) verwendet.add(k.trim());
    }
  }
  const unbekannt = [...verwendet].filter((k) => !alleKeys.has(k));
  if (unbekannt.length) meldung(`${datei}: Schluessel ohne Uebersetzung → ${unbekannt.join(', ')}`);
  else console.log(`  ✓ ${datei}: alle ${verwendet.size} Schluessel vorhanden`);
}

console.log('');
if (fehler) {
  console.error(`FEHLGESCHLAGEN — ${fehler} Befund(e).`);
  process.exit(1);
}
console.log('Alle Sprachen vollstaendig.');
