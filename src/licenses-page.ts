// Fuellt die Lizenzseite (#/lizenzen) aus der generierten Liste.
//
// Die Daten kommen aus src/generated/licenses.ts, erzeugt von
// scripts/collect-licenses.mjs (laeuft automatisch als prebuild). Deshalb steht
// hier keine einzige Paketangabe im Quelltext: Sie wuerde beim naechsten
// npm install veralten, ohne dass es jemandem auffaellt.
//
// Bewusst per DOM-Knoten statt innerHTML aufgebaut — die Werte stammen aus
// package.json-Feldern Dritter, und textContent kann grundsaetzlich nicht
// ausbrechen.
import { PACKAGE_LICENSES, MODEL_LICENSES } from './generated/licenses';
import { t } from './i18n';

function row(cells: (HTMLElement | string)[]): HTMLElement {
  const tr = document.createElement('div');
  tr.className = 'license-row';
  for (const cell of cells) {
    const div = document.createElement('div');
    if (typeof cell === 'string') div.textContent = cell;
    else div.appendChild(cell);
    tr.appendChild(div);
  }
  return tr;
}

function link(text: string, href: string): HTMLElement {
  // Nur http(s) verlinken: In package.json stehen gelegentlich git:- oder
  // ssh:-Adressen, die im Browser nichts Sinnvolles tun.
  if (!/^https?:\/\//.test(href)) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
  }
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = text;
  return a;
}

// Wird bei jedem Aufruf der Seite neu aufgebaut. Kein "nur einmal"-Riegel:
// Tabellenkopf und Paketzahl entstehen ueber t() und traegen deshalb kein
// data-i18n — applyI18n() wuerde sie beim Sprachwechsel nicht auffrischen, und
// sie blieben in der alten Sprache stehen. 63 Zeilen neu zu bauen ist billiger
// als diese Falle.
export function renderLicenses(): void {
  const pkgHost = document.getElementById('licenses-packages');
  if (pkgHost) {
    pkgHost.textContent = '';
    const head = row([
      t('licenses.count', { n: String(PACKAGE_LICENSES.length) }),
      t('licenses.colVersion'),
      t('licenses.colLicense'),
    ]);
    head.classList.add('license-head');
    pkgHost.appendChild(head);
    for (const p of PACKAGE_LICENSES) {
      pkgHost.appendChild(row([link(p.name, p.homepage), p.version, p.license]));
    }
  }

  const modelHost = document.getElementById('licenses-models');
  if (modelHost) {
    modelHost.textContent = '';
    for (const m of MODEL_LICENSES) {
      modelHost.appendChild(row([link(m.name, m.url), '', m.license]));
    }
  }
}
