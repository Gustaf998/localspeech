// Modellkatalog: welche Modelle es gibt, wie gross sie sind und fuer welche
// Hardware-Klasse sie empfohlen werden. Beschreibungen sind i18n-Schluessel
// (siehe i18n.ts), damit sie in der UI-Sprache erscheinen.

export type Tier = 'light' | 'balanced' | 'strong' | 'max';

export interface LLMOption {
  id: string; // stabiler Settings-Schluessel (URL kann sich aendern, id nicht)
  url: string; // GGUF-Download (bei gesplitteten Modellen: erste Shard-URL)
  name: string;
  params: string;
  dlSizeMB: number;
  tier: Tier;
  descKey: string;
  nCtx: number; // Kontextfenster pro Klasse (bestimmt KV-Cache-Speicher)
  // Sampling fuer die Gespraechsantwort (app.ts uebergibt es an llm.chat).
  // Basis ist Qwens dokumentierter Preset fuer den Non-Thinking-Textmodus
  // (temperature 0.7 / top_p 0.8 / top_k 20). Vorher lief nur das 0.8B mit
  // einem Override, alle anderen mit temperature/top_p 1.0 — Nucleus-Sampling
  // damit faktisch aus, also maximale Varianz. Das war die Hauptursache dafuer,
  // dass die Gespraechsqualitaet von Sitzung zu Sitzung ausgewuerfelt wirkte.
  // Jetzt hat JEDES Modell einen expliziten Eintrag; die Defaults in llm.ts
  // sind nur noch das Netz fuer Modelle ohne Katalogeintrag.
  sampling?: { temperature?: number; topP?: number; topK?: number; presencePenalty?: number };
  // Anzahl History-Nachrichten in buildMessages() (app.ts); Default 16, falls
  // nicht gesetzt. Kleineres Kontextfenster + langer System-Prompt lassen
  // weniger Luft — kleinerer Wert senkt das Risiko, dass ctx_shift mitten im
  // Gespraech greift (kostet erneutes, auf CPU/light-Tier teures Prefill).
  historyTurns?: number;
}

// GGUF-Modelle via wllama (llama.cpp). Wichtig: wllama kann max. 2 GiB pro
// Datei (ArrayBuffer-Limit). Groessere Modelle werden mit `llama-gguf-split`
// in ~512-MB-Shards zerlegt; wllama laedt sie automatisch, wenn man die URL
// der ERSTEN Shard (…-00001-of-0000N.gguf) uebergibt (Bonus: bis zu 5 Shards
// parallel = schnellerer Download). Qwen3.5 (03/2026) deckt als kleinste
// moderne Familie alle Lernsprachen ab (201 Sprachen) und ist der direkte
// Nachfolger unseres bisherigen Qwen3-Lineups.
// 0.8B in Q8_0: unter 1B degradiert Q4 die Sprachqualitaet zu stark.
export const LLM_OPTIONS: LLMOption[] = [
  {
    id: 'qwen35-0.8b',
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q8_0.gguf',
    name: 'Qwen 3.5 · 0.8B',
    params: '0,8 Mrd.',
    dlSizeMB: 812,
    tier: 'light',
    descKey: 'llm.qwen3_06',
    nCtx: 2048,
    // Presence-Strafe hier am NIEDRIGSTEN, nicht am hoechsten: im Browsertest
    // zerlegte 1.5 auf diesem Modell die Grammatik (s. llm.ts). Je kleiner das
    // Modell, desto weniger Reserve hat es, wenn ihm haeufige Woerter im
    // Sampling wegpenalisiert werden. Kuerzeres History-Fenster als Obergrenze
    // ueber dem Token-Budget aus buildMessages (app.ts) — bei nur 2048 Token
    // Kontext bleibt neben dem System-Prompt wenig Luft.
    sampling: { temperature: 0.7, topP: 0.8, topK: 20, presencePenalty: 0.3 },
    historyTurns: 10,
  },
  {
    id: 'qwen35-2b',
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
    name: 'Qwen 3.5 · 2B',
    params: '2 Mrd.',
    dlSizeMB: 1280,
    tier: 'balanced',
    descKey: 'llm.qwen3_17',
    nCtx: 4096,
    sampling: { temperature: 0.7, topP: 0.8, topK: 20, presencePenalty: 0.5 },
  },
  // 4B in Q3_K_S (1,96 GiB): die staerkste Quantisierung, die noch unter
  // wllamas 2-GiB-Datei-Limit passt — Q4_K_M waere 2,55 GiB und braeuchte
  // selbst gehostete Split-Shards. Damit ist das strong-Tier ohne eigenes
  // CDN sofort verfuegbar; Qualitaetsverlust von Q4→Q3_K_S ist bei 4B
  // deutlich milder als bei den kleinen Groessen.
  {
    id: 'qwen35-4b',
    url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q3_K_S.gguf',
    name: 'Qwen 3.5 · 4B',
    params: '4 Mrd.',
    dlSizeMB: 2106,
    tier: 'strong',
    descKey: 'llm.qwen3_4b',
    nCtx: 4096,
    sampling: { temperature: 0.7, topP: 0.8, topK: 20, presencePenalty: 0.5 },
  },
  // IBM Granite 4.1 3B (Apache 2.0, 12 Sprachen inkl. aller 5 Lernsprachen).
  // Einzige der beiden 07-20 recherchierten Kandidaten, die sauber alle drei
  // Kriterien erfuellt (Lizenz/Sprachen/2-GiB-Limit) — Ministral 3B scheitert
  // je nach Version an Lizenz (2410: Mistral Research License) oder
  // Architektur-Reife in llama.cpp (2512: erst seit 12/2025 ueberhaupt
  // konvertierbar). Q4_K_M passt hier (anders als beim 4B oben) noch unter
  // die 2-GiB-Grenze — bessere Quant-Stufe bei aehnlicher Downloadgroesse.
  // Als ungetestete Alternative eingefuegt, NICHT als neue Empfehlung (siehe
  // hardware.ts) — erst nach manuellem Vergleich zum Default machen.
  {
    id: 'granite41-3b',
    url: 'https://huggingface.co/unsloth/granite-4.1-3b-GGUF/resolve/main/granite-4.1-3b-Q4_K_M.gguf',
    name: 'Granite 4.1 · 3B',
    params: '3 Mrd.',
    dlSizeMB: 2100,
    tier: 'strong',
    descKey: 'llm.granite41_3b',
    nCtx: 4096,
    // Kein Qwen-Modell, aber derselbe Preset: 0.7/0.8/20 ist auch fuer Granite
    // ein vernuenftiger Gespraechs-Arbeitspunkt (ungetestet, s. Kommentar oben).
    sampling: { temperature: 0.7, topP: 0.8, topK: 20, presencePenalty: 0.5 },
  },
];

export function llmOptionForId(id: string): LLMOption | undefined {
  return LLM_OPTIONS.find((o) => o.id === id);
}

export interface STTOption {
  id: string;
  name: string;
  dlSizeMB: number;
  descKey: string;
}

export const STT_OPTIONS: STTOption[] = [
  {
    id: 'onnx-community/whisper-tiny',
    name: 'Whisper Tiny',
    dlSizeMB: 60,
    descKey: 'stt.tiny',
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Whisper Base',
    dlSizeMB: 110,
    descKey: 'stt.base',
  },
  {
    id: 'onnx-community/whisper-small',
    name: 'Whisper Small',
    dlSizeMB: 330,
    descKey: 'stt.small',
  },
];

export const TTS_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// q8 (WASM) vs. fp32 (WebGPU — schneller, aber groesserer Download)
export const TTS_SIZE_MB = 95;
export const TTS_SIZE_WEBGPU_MB = 330;

// Phonem-Erkennung fuer die Aussprache-Uebung (optional, nur bei Nutzung
// geladen). wav2vec2-CTC OHNE Sprachmodell-Prior: transkribiert die
// tatsaechlich produzierten Laute, nicht das "wahrscheinlich gemeinte" Wort —
// deshalb, anders als Whisper, faellt eine bewusst falsche Aussprache auch
// wirklich auf. Trainiert auf espeak-phonemisiertem CommonVoice, gibt also
// dasselbe IPA-Alphabet aus wie unser espeak-ng im TTS-Worker (tts.worker.ts)
// — erwartete und gehoerte Phoneme sind direkt vergleichbar.
export const PHONEME_MODEL_ID = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX';
// q8 (WASM, ~318 MB) bzw. fp16 (WebGPU, ~632 MB). Grob fuer die Download-Anzeige.
export const PHONEME_SIZE_MB = 318;
export const PHONEME_SIZE_WEBGPU_MB = 632;

// Dediziertes Uebersetzungsmodell (NLLB-200 distilled, viele-zu-viele ueber
// FLORES-200-Sprachcodes) statt des Chat-LLM: verlaesslicher bei Genus/Kasus
// und Idiomen, weil ein reiner NMT-Kopf statt Instruction-Following. Ein
// einziges Modell deckt alle Sprachpaare ab (kein Download pro Paar).
// dtype 'q8': bei diesem Modell ist die q4-Variante GROESSER als q8/int8
// (riesige Embedding-/LM-Head-Tabelle wird von MatMulNBits nicht erfasst) —
// q8 ist die kleinste Wahl. Laeuft IMMER auf WASM, nie WebGPU (s. app.ts,
// ensureTranslatorReady): dieselbe q8-Kombination liefert auf WebGPU
// reproduzierbar Kauderwelsch statt Uebersetzung.
export const TRANSLATE_MODEL_ID = 'Xenova/nllb-200-distilled-600M';
export const TRANSLATE_SIZE_MB = 895; // encoder_model_quantized + decoder_model_merged_quantized
