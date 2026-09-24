// Hauptthread-Wrapper fuer den Phonem-Erkennungs-Worker (Aussprache-Uebung).
// Wird — anders als STT/TTS/LLM — NICHT beim Start geladen, sondern erst beim
// ersten Nutzen der Aussprache-Uebung (grosser, optionaler Download).

import { WorkerClient, type DownloadProgress } from '../lib/rpc';

export class PhonemeEngine {
  private client: WorkerClient | null = null;
  private loading: Promise<void> | null = null;
  ready = false;

  // Idempotent: paralleles ensure() teilt sich denselben Ladevorgang, ein
  // zweiter Aufruf nach erfolgreichem Laden ist ein no-op.
  ensure(
    model: string,
    device: 'webgpu' | 'wasm',
    onProgress: (p: DownloadProgress) => void,
  ): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      this.client = new WorkerClient(
        new Worker(new URL('./phoneme.worker.ts', import.meta.url), { type: 'module' }),
      );
      try {
        await this.client.call('load', { model, device }, { onProgress });
        this.ready = true;
      } catch (err) {
        this.client?.terminate();
        this.client = null;
        throw err;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  async recognize(audio: Float32Array): Promise<string> {
    if (!this.client || !this.ready) throw new Error('Phonem-Erkennung nicht bereit.');
    const { phonemes } = await this.client.call<{ phonemes: string }>(
      'recognize',
      { audio },
      { transfer: [audio.buffer as ArrayBuffer] },
    );
    return phonemes;
  }
}
