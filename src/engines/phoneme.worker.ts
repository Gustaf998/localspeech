// Phonem-Erkennung fuer die Aussprache-Uebung in einem Web Worker
// (transformers.js / ONNX). wav2vec2-CTC gibt eine IPA-Phonemfolge aus — das,
// was WIRKLICH geklungen hat, ohne den auto-korrigierenden Sprachprior von
// Whisper. Dadurch faellt eine falsche Aussprache tatsaechlich auf.
//
// Wir umgehen die fertige ASR-Pipeline: sie verlangt eine tokenizer.json, die
// dieses Repo (Wav2Vec2PhonemeCTCTokenizer, nur vocab.json) nicht mitliefert.
// Stattdessen Feature-Extractor + CTC-Modell direkt, CTC-Decode von Hand mit
// der mitgelieferten (gevendorten) vocab.json — das ist zugleich offline-sauber,
// weil keine Tokenizer-Dateien nachgeladen werden.

import { AutoModelForCTC, AutoFeatureExtractor, env } from '@huggingface/transformers';
import { serve, makeAggregator } from '../lib/rpc';
import vocab from './phoneme-vocab.json';

(env as any).allowLocalModels = false;

let model: any = null;
let featureExtractor: any = null;

// id -> Phonem-Token. <pad>=0 (CTC-Blank), <s>=1, </s>=2, <unk>=3 werden verworfen.
const ID2TOK: string[] = [];
for (const [tok, id] of Object.entries(vocab as Record<string, number>)) ID2TOK[id] = tok;
const DROP = new Set([0, 1, 2, 3]);

// Greedy-CTC-Decode: pro Zeitschritt argmax, gleiche Ids zusammenfassen,
// Blank/Sondertokens entfernen, Rest als (space-separierte) Phonemfolge.
function ctcDecode(logits: { data: Float32Array; dims: number[] }): string {
  const [, T, V] = logits.dims;
  const data = logits.data;
  const out: string[] = [];
  let prev = -1;
  for (let t = 0; t < T; t++) {
    const off = t * V;
    let best = 0;
    let bestVal = -Infinity;
    for (let v = 0; v < V; v++) {
      const x = data[off + v];
      if (x > bestVal) {
        bestVal = x;
        best = v;
      }
    }
    if (best !== prev && !DROP.has(best)) out.push(ID2TOK[best] ?? '');
    prev = best;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

serve({
  async load(
    { model: modelId, device }: { model: string; device: 'webgpu' | 'wasm' },
    progress,
  ) {
    const dtype = device === 'webgpu' ? 'fp16' : 'q8';
    const report = makeAggregator(progress);
    featureExtractor = await AutoFeatureExtractor.from_pretrained(modelId, {
      progress_callback: report,
    } as any);
    model = await AutoModelForCTC.from_pretrained(modelId, {
      dtype,
      device,
      progress_callback: report,
    } as any);
    // Warmup: kompiliert die Kernel, damit die erste echte Erkennung schnell ist.
    const warm = await featureExtractor(new Float32Array(16000), { sampling_rate: 16000 });
    await model(warm);
    return { ok: true };
  },

  // Rohe IPA-Phonemfolge der Aufnahme (space-separierte espeak-Phoneme).
  async recognize({ audio }: { audio: Float32Array }) {
    if (!model || !featureExtractor) throw new Error('Phonem-Erkennung nicht geladen.');
    const inputs = await featureExtractor(audio, { sampling_rate: 16000 });
    const { logits } = await model(inputs);
    return { phonemes: ctcDecode(logits) };
  },
});
