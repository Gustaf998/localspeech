// Kokoro-TTS (realistische Stimme) in einem Web Worker.
//
// kokoro-js kann von Haus aus nur Englisch: sein "phonemizer" buendelt nur
// die englischen espeak-Daten und die Stimmliste ist fest verdrahtet. Das
// Kokoro-Modell selbst spricht aber auch Spanisch, Franzoesisch, Italienisch,
// Portugiesisch und Hindi — die Stimm-Vektoren liegen im selben Modell-Repo.
// Fuer diese Sprachen phonemisieren wir selbst mit einem vollstaendigen
// eSpeak-NG-WASM-Build und rufen generate_from_ids direkt auf, das im
// Gegensatz zu generate() keine Stimmvalidierung macht.

import { KokoroTTS } from 'kokoro-js';
import ESpeakNg from 'espeak-ng';
import espeakWasmUrl from 'espeak-ng/dist/espeak-ng.wasm?url';
import { serve, makeAggregator } from '../lib/rpc';

let tts: any = null;

// Das espeak-WASM (~18 MB, enthaelt alle Sprachdaten) wird einmal geladen
// und fuer jeden Aufruf wiederverwendet; pro Satz kostet die Instanziierung
// nur ~40 ms — vernachlaessigbar neben der eigentlichen Audio-Generierung.
let espeakBinary: ArrayBuffer | null = null;

async function phonemizeEspeak(text: string, lang: string): Promise<string> {
  if (!espeakBinary) {
    espeakBinary = await (await fetch(espeakWasmUrl)).arrayBuffer();
  }
  const mod = await ESpeakNg({
    wasmBinary: espeakBinary,
    arguments: ['--phonout', 'out.txt', '--sep=', '-q', '-b', '1', '--ipa=3', '-v', lang, text],
  });
  const raw: string = mod.FS.readFile('out.txt', { encoding: 'utf8' });
  return raw
    .replace(/\([a-z-]+\)/g, '') // Sprachwechsel-Marker wie "(en)"
    .replace(/[‍͜͡]/g, '') // ZWJ/Ties: t‍ʃ -> tʃ (Tokenizer-Vokabular)
    .replace(/\s+/g, ' ')
    .trim();
}

// Kokoro haengt an jeden Schnipsel eine spuerbare Stille an (~0,5–2 s). Die
// wird sonst vollstaendig abgespielt, bevor die Wiedergabe endet — dadurch
// bleibt das Mikrofon nach dem letzten Wort quaelend lange gesperrt. Wir
// schneiden fuehrende/abschliessende Stille weg und lassen nur ein kurzes
// Polster stehen, damit Wortanfang/-ende nicht hart abgeschnitten klingen.
function trimSilence(audio: Float32Array, sampleRate: number): Float32Array {
  const threshold = 0.012; // unter diesem Betrag gilt ein Sample als still
  const pad = Math.round(sampleRate * 0.04); // 40 ms Polster an beiden Enden
  let start = 0;
  let end = audio.length;
  while (start < end && Math.abs(audio[start]) < threshold) start++;
  while (end > start && Math.abs(audio[end - 1]) < threshold) end--;
  if (start >= end) return audio; // reine Stille: unveraendert lassen
  start = Math.max(0, start - pad);
  end = Math.min(audio.length, end + pad);
  return audio.slice(start, end);
}

async function synth(text: string, voice: string, speed: number, espeak: string) {
  if (espeak === 'en-us' || espeak === 'en-gb') {
    // Englisch ueber kokoro-js selbst — inkl. dessen Text-Normalisierung.
    return await tts.generate(text, { voice, speed });
  }
  const phonemes = await phonemizeEspeak(text, espeak);
  if (!phonemes) throw new Error('Leere Phonemfolge');
  const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
  return await tts.generate_from_ids(input_ids, { voice, speed });
}

serve({
  async load(
    { model, device, voice, espeak, warmup }:
      { model: string; device: 'webgpu' | 'wasm'; voice: string; espeak: string; warmup: string },
    progress,
  ) {
    const dtype = device === 'webgpu' ? 'fp32' : 'q8';
    tts = await KokoroTTS.from_pretrained(model, {
      dtype,
      device,
      progress_callback: makeAggregator(progress),
    } as any);
    // Warmup mit der gewaehlten Stimme: kompiliert die Kernel UND laedt den
    // Stimm-Vektor vor — die erste echte Antwort startet dadurch sofort.
    await synth(warmup, voice, 1.0, espeak);
    return { ok: true };
  },

  // Zusaetzliche Stimme vorwaermen (z. B. nach Stimmwechsel in den Optionen)
  async warmVoice({ voice, espeak, warmup }: { voice: string; espeak: string; warmup: string }) {
    if (!tts) throw new Error('TTS not loaded.');
    await synth(warmup, voice, 1.0, espeak);
    return { ok: true };
  },

  async speak(
    { text, voice, speed, espeak }:
      { text: string; voice: string; speed: number; espeak: string },
  ) {
    if (!tts) throw new Error('TTS not loaded.');
    const result = await synth(text, voice, speed, espeak);
    const sr = result.sampling_rate as number;
    const audio = trimSilence(result.audio as Float32Array, sr);
    return {
      audio,
      sr,
      __transfer: [audio.buffer],
    };
  },

  // Fuer die Aussprache-Uebung: die erwartete IPA-Phonemfolge je Wort. Nutzt
  // denselben espeak-NG-Build wie die Synthese (immer espeak, auch fuers
  // Englische) — damit stimmt das Alphabet mit dem wav2vec2-espeak-Modell
  // ueberein. Braucht KEIN geladenes Kokoro-Modell, nur das espeak-WASM.
  async phonemizeWords({ words, espeak }: { words: string[]; espeak: string }) {
    const ipa = await Promise.all(words.map((w) => phonemizeEspeak(w, espeak)));
    return { ipa };
  },
});
