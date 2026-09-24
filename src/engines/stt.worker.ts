// Whisper-Spracherkennung in einem Web Worker (transformers.js / ONNX).
// Die Whisper-Modelle sind mehrsprachig — die Zielsprache kommt pro
// Transkription vom Hauptthread mit.

import { pipeline, env } from '@huggingface/transformers';
import { serve, makeAggregator } from '../lib/rpc';

(env as any).allowLocalModels = false;

let transcriber: any = null;

serve({
  async load(
    { model, device, language }: { model: string; device: 'webgpu' | 'wasm'; language: string },
    progress,
  ) {
    const dtype =
      device === 'webgpu'
        ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
        : 'q8';
    transcriber = await pipeline('automatic-speech-recognition', model, {
      dtype,
      device,
      progress_callback: makeAggregator(progress),
    } as any);
    // Warmup: kompiliert Kernel, damit die erste echte Erkennung schnell ist.
    await transcriber(new Float32Array(8000), { language, task: 'transcribe' });
    return { ok: true };
  },

  async transcribe({ audio, language }: { audio: Float32Array; language: string }) {
    if (!transcriber) throw new Error('Spracherkennung nicht geladen.');
    const out = await transcriber(audio, { language, task: 'transcribe' });
    return { text: String(out?.text ?? '').trim() };
  },
});
