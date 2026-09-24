// Hauptthread-Wrapper fuer den Kokoro-TTS-Worker.
// Nutzt bevorzugt WebGPU (deutlich schnellere Generierung = niedrigere
// Latenz bis zum ersten Ton) und faellt bei Problemen auf WASM zurueck.

import { WorkerClient, type DownloadProgress } from '../lib/rpc';
import { TTS_MODEL_ID } from '../catalog';

export interface SpokenAudio {
  audio: Float32Array;
  sr: number;
}

// Sprachkontext fuer die Synthese: espeak-Code + kurzer Warmup-Satz.
export interface TTSLang {
  espeak: string;
  warmup: string;
}

export class TTSEngine {
  private client: WorkerClient | null = null;
  ready = false;
  device: 'webgpu' | 'wasm' | null = null;

  async load(
    preferWebgpu: boolean,
    voice: string,
    lang: TTSLang,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<void> {
    if (this.ready) return;

    const tryLoad = async (device: 'webgpu' | 'wasm') => {
      this.client?.terminate();
      this.client = new WorkerClient(
        new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' }),
      );
      await this.client.call(
        'load',
        { model: TTS_MODEL_ID, device, voice, espeak: lang.espeak, warmup: lang.warmup },
        { onProgress },
      );
      this.device = device;
    };

    try {
      await tryLoad(preferWebgpu ? 'webgpu' : 'wasm');
    } catch (err) {
      if (!preferWebgpu) throw err;
      console.warn('TTS auf WebGPU fehlgeschlagen — Fallback auf WASM:', err);
      await tryLoad('wasm');
    }
    this.ready = true;
  }

  // Stimm-Vektor einer Stimme vorladen, damit der Wechsel latenzfrei ist.
  async warmVoice(voice: string, lang: TTSLang): Promise<void> {
    if (!this.client || !this.ready) return;
    try {
      await this.client.call('warmVoice', { voice, espeak: lang.espeak, warmup: lang.warmup });
    } catch {
      /* unkritisch */
    }
  }

  async speak(text: string, voice: string, speed: number, lang: TTSLang): Promise<SpokenAudio> {
    if (!this.client || !this.ready) throw new Error('TTS not ready.');
    return await this.client.call<SpokenAudio>('speak', {
      text,
      voice,
      speed,
      espeak: lang.espeak,
    });
  }

  // Erwartete IPA-Phonemfolge je Wort (fuer die Aussprache-Uebung).
  async phonemizeWords(words: string[], espeak: string): Promise<string[]> {
    if (!this.client || !this.ready) throw new Error('TTS not ready.');
    const { ipa } = await this.client.call<{ ipa: string[] }>('phonemizeWords', {
      words,
      espeak,
    });
    return ipa;
  }
}
