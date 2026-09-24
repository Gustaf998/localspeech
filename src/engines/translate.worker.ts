// Uebersetzung ueber ein dediziertes NLLB-200-Modell in einem Web Worker
// (transformers.js / ONNX) — ersetzt das Chat-LLM als Uebersetzer. NLLB ist
// ein reiner NMT-Kopf (kein Instruction-Following), kennt Sprachen aber ueber
// FLORES-200-Codes (z. B. "eng_Latn"), nicht ISO-639-1.

import { pipeline, env } from '@huggingface/transformers';
import { serve, makeAggregator } from '../lib/rpc';

(env as any).allowLocalModels = false;

let translator: any = null;

// NLLB ist ein reines Satz-Uebersetzungsmodell (auf Satzpaaren trainiert, nicht
// auf Absaetzen) — gibt man ihm eine mehrsaetzige Antwort als EIN Aufruf,
// uebersetzt es oft nur einen Satz und laesst den Rest stillschweigend weg
// (real beobachtet: "Hello! Where do you call home?" -> nur die Haelfte kam
// durch). Fix: satzweise aufteilen, jeden Satz einzeln uebersetzen, wieder
// zusammenfuegen — so bleibt jeder Modellaufruf im trainierten Satz-Regime.
// "।" ist der Devanagari-Satzpunkt (falls doch mal Hindi-Text reinkommt).
const SENTENCE_SPLIT = /[^.!?…।]+[.!?…।]+["')\]]?|[^.!?…।]+$/g;
function splitSentences(text: string): string[] {
  const parts = text.match(SENTENCE_SPLIT) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

async function translateText(text: string, srcLang: string, tgtLang: string): Promise<string> {
  const sentences = splitSentences(text);
  const results: string[] = [];
  for (const sentence of sentences) {
    const out = await translator(sentence, { src_lang: srcLang, tgt_lang: tgtLang, no_repeat_ngram_size: 3 });
    results.push(String(out?.[0]?.translation_text ?? '').trim());
  }
  return results.join(' ').trim();
}

serve({
  async load(
    { model, device, srcLang, tgtLang, warmup }: {
      model: string;
      device: 'webgpu' | 'wasm';
      srcLang: string;
      tgtLang: string;
      warmup: string;
    },
    progress,
  ) {
    translator = await pipeline('translation', model, {
      dtype: 'q8',
      device,
      progress_callback: makeAggregator(progress),
    } as any);
    // Warmup: kompiliert Kernel, damit die erste echte Uebersetzung schnell ist.
    await translator(warmup, { src_lang: srcLang, tgt_lang: tgtLang, no_repeat_ngram_size: 3 });
    return { ok: true };
  },

  async translate({ text, srcLang, tgtLang }: { text: string; srcLang: string; tgtLang: string }) {
    if (!translator) throw new Error('Uebersetzer nicht geladen.');
    return { text: await translateText(text, srcLang, tgtLang) };
  },
});
