// Hauptthread-Wrapper fuer den Whisper-Worker.

import { WorkerClient, type DownloadProgress } from '../lib/rpc';

export class STTEngine {
  private client: WorkerClient | null = null;
  currentModel: string | null = null;
  ready = false;

  async load(
    model: string,
    device: 'webgpu' | 'wasm',
    language: string,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<void> {
    if (this.ready && this.currentModel === model) return;
    this.client?.terminate();
    this.ready = false;
    this.client = new WorkerClient(
      new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' }),
    );
    await this.client.call('load', { model, device, language }, { onProgress });
    this.currentModel = model;
    this.ready = true;
  }

  async transcribe(audio: Float32Array, language: string): Promise<string> {
    if (!this.client || !this.ready) throw new Error('STT not ready.');
    const { text } = await this.client.call<{ text: string }>(
      'transcribe',
      { audio, language },
      { transfer: [audio.buffer as ArrayBuffer] },
    );
    return text;
  }
}
