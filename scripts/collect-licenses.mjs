// Sammelt die Lizenzangaben aller ausgelieferten Abhaengigkeiten und erzeugt
// daraus zwei Artefakte:
//
//   public/third-party-licenses.txt  — die vollstaendigen Lizenztexte. Das ist
//       das rechtlich relevante Stueck: Apache-2.0 (Ziffer 4) und die
//       MIT/BSD/ISC-Lizenzen verlangen, dass Lizenz und Urhebervermerk der
//       Weitergabe beiliegen. Die Datei landet ueber public/ im Build und ist
//       damit Teil der ausgelieferten Seite.
//
//   src/generated/licenses.ts       — eine kompakte Liste (Name, Version,
//       Lizenz) fuer die Lizenzseite in der App. Bewusst OHNE die Volltexte,
//       damit das Bundle klein bleibt; die Seite verlinkt auf die .txt.
//
// Aufruf: npm run licenses     (laeuft auch automatisch vor jedem Build)
//
// Warum generiert und nicht handgepflegt: Bei jedem `npm install` kann sich der
// Baum aendern. Eine handgetippte Liste veraltet still — und eine veraltete
// Namensnennung ist so gut wie keine.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Die KI-Modelle sind keine npm-Pakete — sie werden zur Laufzeit vom Browser
// direkt bei Hugging Face geladen. Wir liefern sie also nicht aus, nennen sie
// aber trotzdem: NLLB verlangt die Namensnennung ausdruecklich, und bei den
// uebrigen ist sie fair. Lizenzen von Hand geprueft (huggingface.co/api/models).
const MODELS = [
  { name: 'Qwen3.5 (0.8B / 2B / 4B, GGUF via unsloth)', license: 'Apache-2.0', url: 'https://huggingface.co/Qwen' },
  { name: 'IBM Granite 4.1 3B (GGUF via unsloth)', license: 'Apache-2.0', url: 'https://huggingface.co/ibm-granite' },
  { name: 'OpenAI Whisper (tiny / base / small, ONNX)', license: 'Apache-2.0', url: 'https://huggingface.co/openai/whisper-base' },
  { name: 'Kokoro-82M v1.0 (ONNX)', license: 'Apache-2.0', url: 'https://huggingface.co/hexgrad/Kokoro-82M' },
  { name: 'wav2vec2-lv-60-espeak-cv-ft (ONNX)', license: 'Apache-2.0', url: 'https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft' },
  // NLLB-200 ist das einzige Modell, dessen Lizenz die Namensnennung
  // ausdruecklich VERLANGT (CC-BY) — und das einzige mit einer Einschraenkung
  // auf nicht-kommerzielle Nutzung (NC). Es darf hier also unter keinen
  // Umstaenden fehlen.
  {
    name: 'NLLB-200 distilled 600M (Übersetzung) — nur nicht-kommerzielle Nutzung',
    license: 'CC-BY-NC-4.0',
    url: 'https://huggingface.co/facebook/nllb-200-distilled-600M',
  },
];

// Kandidaten-Dateinamen fuer den Lizenztext innerhalb eines Pakets.
const LICENSE_FILES = /^(LICENSE|LICENCE|COPYING|NOTICE)(\.(md|txt))?$/i;

function prodPackages() {
  const json = JSON.parse(
    execSync('npm ls --omit=dev --all --json', { cwd: root, maxBuffer: 1e8 }).toString(),
  );
  const seen = new Map();
  (function walk(node) {
    for (const [name, info] of Object.entries(node.dependencies ?? {})) {
      if (!seen.has(name)) seen.set(name, info.version ?? '');
      walk(info);
    }
  })(json);
  return [...seen].sort(([a], [b]) => a.localeCompare(b));
}

function readPackage(name) {
  try {
    return JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Volltext aus dem Paket lesen. Fehlt er, bleibt es beim Lizenz-Kuerzel — das
// ist bei kleinen MIT-Paketen ueblich und kein Mangel, solange der
// Urhebervermerk erhalten bleibt.
function licenseText(name) {
  const dir = join(root, 'node_modules', name);
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    if (LICENSE_FILES.test(entry)) {
      try {
        return readFileSync(join(dir, entry), 'utf8').trim();
      } catch {
        return null;
      }
    }
  }
  return null;
}

function authorOf(pkg) {
  const a = pkg?.author;
  if (typeof a === 'string') return a;
  if (a?.name) return a.email ? `${a.name} <${a.email}>` : a.name;
  return null;
}

const packages = prodPackages();
const rows = [];
const blocks = [];
const skipped = [];

for (const [name, version] of packages) {
  const pkg = readPackage(name);
  // Nicht installierte Pakete uebergehen. Das sind ausschliesslich optionale,
  // plattformspezifische Binaerpakete (@img/sharp-* fuer macOS/Linux,
  // @napi-rs/canvas-*), die npm fuer fremde Betriebssysteme im Baum fuehrt,
  // ohne sie zu installieren. Sie sind .node-Binaerdateien und landen niemals
  // im Browser-Bundle — sie zu nennen waere irrefuehrend, und ihre Lizenz
  // waere ohnehin nur zu raten.
  if (!pkg) {
    skipped.push(name);
    continue;
  }
  const license = pkg.license ?? (pkg.licenses ? JSON.stringify(pkg.licenses) : 'unbekannt');
  const homepage = pkg?.homepage ?? (typeof pkg?.repository === 'string' ? pkg.repository : pkg?.repository?.url) ?? '';
  rows.push({ name, version, license, homepage: homepage.replace(/^git\+/, '').replace(/\.git$/, '') });

  const text = licenseText(name);
  const author = authorOf(pkg);
  blocks.push(
    [
      '='.repeat(78),
      `${name} ${version}`,
      `Lizenz: ${license}`,
      author ? `Urheber: ${author}` : null,
      homepage ? `Projekt: ${homepage}` : null,
      '='.repeat(78),
      '',
      text ?? '(Kein Lizenztext im Paket enthalten — es gilt die oben genannte Lizenz.)',
      '',
    ]
      .filter((l) => l !== null)
      .join('\n'),
  );
}

const header = `LocalSpeech — Lizenzen der verwendeten Komponenten
Erzeugt am ${new Date().toISOString().slice(0, 10)} durch scripts/collect-licenses.mjs
NICHT VON HAND BEARBEITEN — bei Aenderungen "npm run licenses" ausfuehren.

LocalSpeech selbst steht unter der GNU General Public License v3.0 oder spaeter
(siehe LICENSE im Quelltext). Grund: Die Aussprache-Umwandlung nutzt eSpeak NG,
das unter GPL-3.0-or-later steht und mit ausgeliefert wird.

Quelltext: https://github.com/b3002025/browserofflineai

Nachfolgend die Lizenzen von ${rows.length} Paketen, danach die zur Laufzeit
geladenen KI-Modelle.

Zum Umfang: Aufgefuehrt sind alle installierten Pakete des Produktionsbaums.
Ein Teil davon (sharp, onnxruntime-node, @napi-rs/canvas) wird nur von
transformers.js auf der Node-Seite benoetigt und ist NICHT Teil der an Browser
ausgelieferten Dateien; sie sind der Vollstaendigkeit halber dennoch genannt.
Uebergangen wurden ${skipped.length} nicht installierte, plattformspezifische
Binaerpakete fuer fremde Betriebssysteme, die in keiner Auslieferung vorkommen.

`;

const modelSection = [
  '',
  '#'.repeat(78),
  '# KI-Modelle (werden vom Browser direkt bei Hugging Face geladen)',
  '#'.repeat(78),
  '',
  ...MODELS.map((m) => `${m.name}\n  Lizenz: ${m.license}\n  Quelle: ${m.url}\n`),
].join('\n');

mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'third-party-licenses.txt'), header + blocks.join('\n') + modelSection, 'utf8');

// Die eigene Lizenz mit ausliefern. GPL-3.0 verlangt, dass der Lizenztext der
// Weitergabe beiliegt — und die Weitergabe ist hier die Website selbst. Als
// Kopie in public/ kommt er von derselben Domain wie die Anwendung, ohne dass
// jemand dafuer auf GitHub angewiesen ist.
try {
  writeFileSync(join(root, 'public', 'license.txt'), readFileSync(join(root, 'LICENSE'), 'utf8'), 'utf8');
} catch {
  console.warn('  ! LICENSE nicht gefunden — public/license.txt nicht erzeugt');
}

mkdirSync(join(root, 'src', 'generated'), { recursive: true });
writeFileSync(
  join(root, 'src', 'generated', 'licenses.ts'),
  `// ERZEUGT von scripts/collect-licenses.mjs — nicht von Hand bearbeiten.
// Kompakte Liste fuer die Lizenzseite. Die Volltexte liegen in
// public/third-party-licenses.txt.

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  homepage: string;
}

export const PACKAGE_LICENSES: LicenseEntry[] = ${JSON.stringify(rows, null, 2)};

export const MODEL_LICENSES: { name: string; license: string; url: string }[] = ${JSON.stringify(MODELS, null, 2)};
`,
  'utf8',
);

const counts = rows.reduce((acc, r) => ((acc[r.license] = (acc[r.license] ?? 0) + 1), acc), {});
console.log(`${rows.length} Pakete erfasst (${skipped.length} nicht installierte uebergangen):`);
for (const [lic, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${lic}`);
}
console.log(`\n  public/third-party-licenses.txt`);
console.log(`  src/generated/licenses.ts`);
