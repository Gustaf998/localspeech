// Hauptthread-Wrapper fuer den NLLB-Uebersetzungs-Worker. Wird erst beim
// ersten Uebersetzungswunsch geladen (nicht Teil des Pflicht-Setups) — der
// Download ist mit ~900 MB deutlich groesser als das, was jede Sitzung
// braucht, wenn die Uebersetzung nie benutzt wird.

import { WorkerClient, type DownloadProgress } from '../lib/rpc';

export class TranslateEngine {
  private client: WorkerClient | null = null;
  ready = false;
  private loading: Promise<void> | null = null;

  load(
    model: string,
    device: 'webgpu' | 'wasm',
    srcLang: string,
    tgtLang: string,
    warmup: string,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.client = new WorkerClient(
      new Worker(new URL('./translate.worker.ts', import.meta.url), { type: 'module' }),
    );
    this.loading = this.client
      .call('load', { model, device, srcLang, tgtLang, warmup }, { onProgress })
      .then(() => {
        this.ready = true;
        this.loading = null;
      })
      .catch((err) => {
        this.loading = null;
        this.client = null;
        throw err;
      });
    return this.loading;
  }

  async translate(text: string, srcLang: string, tgtLang: string): Promise<string> {
    if (!this.client || !this.ready) throw new Error('Translator not ready.');
    const { text: out } = await this.client.call<{ text: string }>('translate', {
      text,
      srcLang,
      tgtLang,
    });
    return out;
  }
}
