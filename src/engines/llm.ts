// wllama-Wrapper (llama.cpp als WASM+WebGPU): laedt GGUF-Modelle, cached sie
// in OPFS und streamt Antworten tokenweise. Inferenz laeuft in wllamas
// eigenem internen Worker (UI bleibt fluessig).

import {
  Wllama,
  CacheManager,
  ModelManager,
  ModelValidationStatus,
  WllamaAbortError,
} from '@wllama/wllama';
import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import compatWasmUrl from '@wllama/wllama-compat/wasm/wllama.wasm?url';
import compatWorkerCode from '@wllama/wllama-compat/wasm/wllama.js?raw';
import type { LLMOption } from '../catalog';

export interface LLMProgress {
  pct: number;
  text: string;
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatOpts {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  presencePenalty?: number;
}

// Debug-Notausstieg: ?cpu=1 erzwingt reine CPU-Inferenz (WebGPU umgehen).
const forceCpu = new URLSearchParams(location.search).has('cpu');
// Debug: ?think=1 laesst das Hybridmodell vor der Antwort denken (mehr
// Kohaerenz bei kleinen Modellen, aber spuerbar spaetere erste Antwort).
const forceThinking = new URLSearchParams(location.search).has('think');

function createWllama(): Wllama {
  const w = new Wllama({ default: wllamaWasmUrl }, { allowOffline: true });
  // Compat-Assets (Safari / Browser ohne JSPI+Memory64) lokal statt vom CDN —
  // die App muss offline funktionieren. wllama aktiviert den Modus selbst.
  w.setCompat({ wasm: compatWasmUrl, worker: { code: compatWorkerCode } });
  return w;
}

export class LLMEngine {
  private wllama: Wllama | null = null;
  currentModel: string | null = null;

  // nCtx: Kontextfenster-Override (z. B. kleiner Korrektor-Kontext) — spart
  // KV-Cache-Speicher gegenueber dem Katalog-Standard des Modells.
  async load(
    opt: LLMOption,
    onProgress: (p: LLMProgress) => void,
    gpu: boolean,
    nCtx = opt.nCtx,
  ): Promise<void> {
    if (this.wllama && this.currentModel === opt.id) return;

    // Modellwechsel: wllama kann nicht in eine geladene Instanz nachladen.
    if (this.wllama) {
      await this.wllama.exit();
      this.wllama = null;
      this.currentModel = null;
    }

    // wllama nutzt ohne n_threads nur die HAELFTE der Kerne (eigener Default:
    // floor(hardwareConcurrency/2)) — auf dem CPU-only-Pfad (kein WebGPU, laut
    // hardware.ts ohnehin nur ~4-8 Tok/s) verschenkt das die Haelfte der
    // Rechenleistung. GPU-gebunden ist die volle Kernzahl unkritisch (Threads
    // werden dort nur fuer Sampling/Nicht-Offload-Reste gebraucht); CPU-gebunden
    // bleibt ein Kern fuer UI/STT/TTS-Worker frei, um Jank zu vermeiden.
    const cores = navigator.hardwareConcurrency || 4;
    const cpuBound = !gpu || forceCpu;
    const n_threads = cpuBound ? Math.max(1, cores - 1) : cores;

    const loadParams = {
      n_ctx: nCtx,
      n_gpu_layers: gpu && !forceCpu ? 99999 : 0,
      n_threads,
      flash_attn: true,
      cache_type_k: 'q8_0',
      cache_type_v: 'q8_0',
      // Letztes Netz, das im Betrieb NICHT mehr greifen darf: llama.cpp
      // verwirft beim Context-Shift die aeltesten Tokens zuerst — und das ist
      // der System-Prompt mit der Persona. Danach kennt das Modell nur noch den
      // sichtbaren Dialog und vertauscht die Rollen ("haelt den Nutzer fuer
      // Einstein"). Ein n_keep, das den System-Prompt schuetzen wuerde, laesst
      // sich nicht setzen: wllama exportiert keine tokenize()-API, die Laenge
      // ist also nicht bestimmbar. Stattdessen budgetiert buildMessages()
      // (app.ts) den Prompt selbst, sodass n_ctx gar nicht erst gesprengt wird.
      ctx_shift: true,
      // Qwen3-Hybridmodelle: Denkmodus im Chat-Template normalerweise aus
      // (Latenz); ueber ?think=1 zum Testen einschaltbar.
      default_template_kwargs: { enable_thinking: forceThinking },
      progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
        // Deckt nur den Download ab; das eigentliche Laden in WASM/GPU meldet
        // nichts -> bei 99% deckeln und erst nach dem Await 100% melden.
        onProgress({
          pct: total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0,
          text: '',
        });
      },
    } as const;

    let wllama = createWllama();
    try {
      await wllama.loadModelFromUrl(opt.url, loadParams);
    } catch (err) {
      if (err instanceof WllamaAbortError) throw err;
      // Selbstheilung: Ein frueher abgebrochener Download hinterlaesst eine
      // unvollstaendige Datei ohne Metadaten in OPFS. wllama haelt sie dann
      // fuer bereits geladen und scheitert dauerhaft (z. B. "Model file not
      // found"). Kaputte Cache-Eintraege der URL entfernen und einmal frisch
      // herunterladen.
      await wllama.exit().catch(() => {});
      await LLMEngine.purgeCacheEntries(opt.url).catch(() => {});
      wllama = createWllama();
      await wllama.loadModelFromUrl(opt.url, loadParams);
    }
    this.wllama = wllama;
    this.currentModel = opt.id;
    onProgress({ pct: 100, text: '' });
  }

  // Entfernt alle Cache-Dateien (inkl. Metadaten) zu einer Modell-URL —
  // auch halbfertige Reste, die ModelManager.getModels() nicht mehr zuordnet.
  private static async purgeCacheEntries(url: string): Promise<void> {
    const cm = new CacheManager();
    for (const shard of ModelManager.parseModelUrl(url)) {
      const name = await cm.getNameFromURL(shard);
      await cm.deleteMany((e) => e.name === name);
    }
  }

  // Streamt die Antwort; liefert Text-Deltas. opts fuer Nebenaufgaben wie den
  // Tutor-/Uebersetzungs-Pass (deterministisch, kurz) — ohne opts: Gespraechs-
  // Defaults. Fuer die Nebenaufgaben will man temperature 0 und keine
  // Presence-Strafe (die verfaelscht sonst woertliche Korrekturen/Uebersetzungen).
  async *chat(
    messages: ChatMsg[],
    signal?: { aborted: boolean },
    opts?: LLMChatOpts,
  ): AsyncGenerator<string> {
    if (!this.wllama) throw new Error('Sprachmodell ist noch nicht geladen.');
    const abort = new AbortController();
    this.abort = abort;

    let stream: AsyncIterable<{ choices: { delta?: { content?: string | null } }[] }>;
    try {
      stream = await this.wllama.createChatCompletion({
        messages,
        stream: true,
        // Qwen3.5-Modellkarte fuer Non-Thinking-Textmodus: temperature 0.7,
        // top_p 0.8, top_k 20. Hier stand frueher 1.0/1.0 — top_p 1.0 schaltet
        // das Nucleus-Sampling faktisch ab, was die Gespraechsqualitaet von
        // Sitzung zu Sitzung ausgewuerfelt hat.
        // presence_penalty ist der von Qwen empfohlene Hebel gegen nicht
        // terminierende Wiederholungsschleifen (nicht repeat_penalty) — aber
        // nur in kleiner Dosis. Im Browsertest (0.8B, presence 1.5) kamen
        // Antworten wie ",. sounds a sturdy. is for, chairs wonderful." heraus:
        // die Strafe gilt flach fuer JEDES Token im Fenster penalty_last_n
        // (~64), und dieses Fenster umfasst auch die Nutzernachricht. Das
        // Modell wird also ausgerechnet dafuer bestraft, die Woerter des
        // Lerners aufzugreifen ("tables and chairs" -> "oak tables sound
        // sturdy") — genau das, was ein natuerliches Gespraech ausmacht.
        // Gegen die eigentlich stoerende Wiederholung ueber mehrere ZUEGE
        // hilft der Parameter ohnehin nicht (das Fenster ist viel zu kurz);
        // dagegen wirken die Regeln im System-Prompt und der Turn-Anker
        // (conversation.ts).
        // Diese Werte greifen nur fuer Modelle ohne sampling-Eintrag im
        // Katalog — regulaer kommen sie aus catalog.ts.
        temperature: opts?.temperature ?? 0.7,
        top_p: opts?.topP ?? 0.8,
        top_k: opts?.topK ?? 20,
        penalty_present: opts?.presencePenalty ?? 0.5,
        max_tokens: opts?.maxTokens ?? 220,
        abortSignal: abort.signal,
      });
    } catch (e) {
      if (e instanceof WllamaAbortError) return;
      throw e;
    }

    // Hybridmodelle koennen trotz enable_thinking:false einen (leeren)
    // <think>-Block voranstellen — den Anfang puffern und ausfiltern.
    let head = '';
    let filtering = true;
    try {
      for await (const chunk of stream) {
        if (signal?.aborted) {
          abort.abort();
          break;
        }
        let delta = chunk.choices[0]?.delta?.content;
        if (!delta) continue;
        if (filtering) {
          head += delta;
          const lead = head.trimStart();
          if (lead.startsWith('<think>')) {
            const end = lead.indexOf('</think>');
            if (end < 0 && lead.length < 4000) continue; // weiter puffern
            delta = end >= 0 ? lead.slice(end + '</think>'.length).trimStart() : lead;
          } else if ('<think>'.startsWith(lead)) {
            continue; // koennte noch ein <think>-Anfang werden
          } else {
            delta = lead;
          }
          filtering = false;
          if (!delta) continue;
        }
        yield delta;
      }
    } catch (e) {
      if (!(e instanceof WllamaAbortError)) throw e;
    }
  }

  // Einmaliger, gesammelter Durchlauf fuer Nebenaufgaben (Tutor-Korrektur,
  // Uebersetzung): kein Streaming noetig, gibt den ganzen Text zurueck. Nutzt
  // dieselbe <think>-Filterung und Abbruch-Logik wie chat(). Laeuft dank der
  // Serialisierung in app.ts nie gleichzeitig mit einer Gespraechsantwort.
  async complete(messages: ChatMsg[], opts?: LLMChatOpts): Promise<string> {
    let out = '';
    for await (const delta of this.chat(messages, undefined, opts)) out += delta;
    return out.trim();
  }

  private abort: AbortController | null = null;

  interrupt() {
    this.abort?.abort();
  }

  // Modell komplett freigeben (Worker beenden, GPU-/WASM-Speicher zurueckgeben)
  // — fuer den Korrektor, wenn er zum aktiven Modell nicht mehr gebraucht wird.
  async unload(): Promise<void> {
    const w = this.wllama;
    this.wllama = null;
    this.currentModel = null;
    if (w) await w.exit().catch(() => {});
  }

  static async isCached(url: string): Promise<boolean> {
    try {
      const models = await new ModelManager().getModels();
      const m = models.find((m) => m.url === url);
      return !!m && m.validate() === ModelValidationStatus.VALID;
    } catch {
      return false;
    }
  }

  static async deleteFromCache(url: string): Promise<void> {
    const models = await new ModelManager().getModels({ includeInvalid: true });
    await models.find((m) => m.url === url)?.remove();
    // Auch Reste entfernen, die getModels() nicht mehr zuordnen kann.
    await LLMEngine.purgeCacheEntries(url).catch(() => {});
  }
}
