// Mikrofon-Aufnahme mit Pegelanzeige und automatischem Stopp bei Stille.
// Liefert 16-kHz-Mono-Float32-Audio fuer Whisper.

export interface RecorderCallbacks {
  onLevel?: (rms: number) => void;
  onAutoStop?: () => void; // Stille erkannt -> Aufrufer beendet die Aufnahme
}

const SPEECH_THRESHOLD = 0.02; // ab hier gilt: es wird gesprochen
const SILENCE_THRESHOLD = 0.012;
const SILENCE_MS = 1600; // so lange Stille nach Sprache => Auto-Stopp (laesst
// natuerliche Denkpausen zu, statt mitten im Satz abzuschneiden)
const VAD_INTERVAL_MS = 60;
// Erst nach so viel zusammenhaengender Sprache gilt es als "gesprochen" — kurze
// Geraeusche, Klicks oder das Nachklingen der KI-Stimme loesen so keinen
// (leeren) Auto-Stopp aus.
const MIN_VOICE_MS = 240;
const VOICE_RESET_MS = 500; // laengere Luecke => Sprech-Zaehler zuruecksetzen
const MAX_MS = 60_000;

export class Recorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private analyserCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: number | null = null;
  private warming: Promise<void> | null = null; // laufendes warm(), gegen Doppel-getUserMedia
  private releaseEpoch = 0; // steigt bei cancel(); entlarvt ein warm(), das waehrenddessen freigegeben wurde
  recording = false;
  private spoke = false;
  // Wird aufgerufen, wenn das Mikrofon waehrend einer laufenden Aufnahme von
  // aussen verschwindet (Geraet getrennt, OS-Berechtigung entzogen, ein
  // anderer Prozess uebernimmt es exklusiv) — NICHT bei unserem eigenen
  // stop()/cancel(). Ohne diesen Haken bliebe die App im "listening"-Zustand
  // haengen, obwohl gar nichts mehr aufgenommen wird (das eigentliche
  // "Mikro schaltet sich im Freihandmodus irgendwann ab"-Symptom).
  onDeviceLost: (() => void) | null = null;

  // Mikrofon-Pipeline einmalig hochfahren und WARM halten: getUserMedia plus
  // Echo-Unterdrueckung/AGC brauchen beim ersten Zugriff ~1–2 s, bis der
  // Eingang eingeschwungen ist — in dieser Zeit wird der Satzanfang
  // verschluckt. Indem Stream + AudioContext zwischen den Zuegen erhalten
  // bleiben (statt bei jedem stop() freigegeben zu werden), ist das Mikro im
  // naechsten Zug sofort scharf. Erst cancel() gibt es fuer die Privatsphaere
  // wirklich frei (Stummschalten/Verlassen).
  async warm(): Promise<void> {
    if (this.stream && this.analyserCtx) {
      if (this.analyserCtx.state === 'suspended') await this.analyserCtx.resume();
      return;
    }
    if (this.warming) return this.warming; // schon am Hochfahren -> nicht doppelt
    const epoch = this.releaseEpoch;
    this.warming = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // wichtig: verhindert, dass die KI sich selbst hoert
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Wurde waehrend getUserMedia stummgeschaltet/verlassen, den frisch
      // geoeffneten Stream sofort wieder freigeben — nicht das Mikro offen lassen.
      if (epoch !== this.releaseEpoch) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      this.stream = stream;
      this.analyserCtx = ctx;
      this.analyser = analyser;
      // 'ended' feuert laut Spec nur, wenn die Quelle selbst wegfaellt — nicht
      // durch unseren eigenen track.stop() in cancel(). Damit ist jeder Aufruf
      // hier ein echter, unerwarteter Mikrofon-Verlust.
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => this.handleTrackEnded());
      }
    })();
    try {
      await this.warming;
    } finally {
      this.warming = null;
    }
  }

  async start(cb: RecorderCallbacks): Promise<void> {
    if (this.recording) return;
    await this.warm();
    const analyser = this.analyser!;
    this.chunks = [];
    this.spoke = false;
    this.mediaRecorder = new MediaRecorder(this.stream!);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
    this.recording = true;

    // Pegel & Stille-Erkennung (nutzt die dauerhaft warme Analyse-Pipeline)
    const buf = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();
    let lastVoice = performance.now();
    let voiceMs = 0; // zusammenhaengend erkannte Sprache
    let lastAbove = 0; // Zeitpunkt des letzten Frames ueber der Sprech-Schwelle

    this.vadTimer = window.setInterval(() => {
      if (!this.recording) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      cb.onLevel?.(rms);
      const now = performance.now();
      if (rms > SPEECH_THRESHOLD) {
        // Ausreisser (langes Loch seit dem letzten lauten Frame) setzen den
        // Zaehler zurueck, damit nur echte, zusammenhaengende Sprache zaehlt.
        if (now - lastAbove > VOICE_RESET_MS) voiceMs = 0;
        lastAbove = now;
        voiceMs += VAD_INTERVAL_MS;
        if (voiceMs >= MIN_VOICE_MS) this.spoke = true;
        lastVoice = now;
      } else if (rms > SILENCE_THRESHOLD) {
        lastVoice = now;
      }
      const tooLong = now - startedAt > MAX_MS;
      if ((this.spoke && now - lastVoice > SILENCE_MS) || tooLong) {
        // Nur ein einziges Mal ausloesen — der Timer wird sofort gestoppt,
        // damit sich Auto-Stopps nicht ueberlagern.
        if (this.vadTimer !== null) {
          clearInterval(this.vadTimer);
          this.vadTimer = null;
        }
        cb.onAutoStop?.();
      }
    }, VAD_INTERVAL_MS);
  }

  get hasSpeech(): boolean {
    return this.spoke;
  }

  // Pipeline als tot markieren und (nur wenn gerade wirklich aufgenommen
  // wurde) den Aufrufer benachrichtigen, damit er den Zustand aufraeumen und
  // im Freihandmodus einen frischen Anlauf starten kann, statt still auf
  // einem toten Stream sitzen zu bleiben.
  private handleTrackEnded() {
    if (!this.stream) return; // laengst durch cancel()/neuen warm() ersetzt
    const wasRecording = this.recording;
    this.recording = false;
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    this.mediaRecorder = null;
    this.stream = null;
    this.analyser = null;
    this.analyserCtx?.close();
    this.analyserCtx = null;
    if (wasRecording) this.onDeviceLost?.();
  }

  // Beendet die Aufnahme und liefert 16-kHz-Mono-Audio. Stream + Analyse
  // bleiben WARM, damit der naechste Zug ohne Einschwing-Verzoegerung startet.
  async stop(): Promise<Float32Array> {
    if (!this.mediaRecorder || !this.recording) return new Float32Array(0);
    this.recording = false;
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }

    const mr = this.mediaRecorder;
    const stopped = new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });
    mr.stop();
    await stopped;
    this.mediaRecorder = null;

    const blob = new Blob(this.chunks);
    this.chunks = [];
    if (blob.size === 0) return new Float32Array(0);

    // Dekodieren + auf 16 kHz mono resamplen
    const arrayBuf = await blob.arrayBuffer();
    const decodeCtx = new AudioContext();
    let decoded: AudioBuffer;
    try {
      decoded = await decodeCtx.decodeAudioData(arrayBuf);
    } finally {
      decodeCtx.close();
    }
    const targetRate = 16_000;
    const frames = Math.ceil(decoded.duration * targetRate);
    if (frames === 0) return new Float32Array(0);
    const offline = new OfflineAudioContext(1, frames, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }

  // Harte Freigabe: bricht eine laufende Aufnahme ab UND gibt die warm
  // gehaltene Mikro-Pipeline frei (getUserMedia-Stream + AudioContext). Fuers
  // Stummschalten/Verlassen zwingend — sonst leuchtet das Mikro weiter, obwohl
  // gerade nicht aufgenommen wird.
  cancel() {
    this.releaseEpoch++; // ein gerade laufendes warm() gibt seinen Stream danach selbst frei
    this.recording = false;
    if (this.vadTimer !== null) clearInterval(this.vadTimer);
    this.vadTimer = null;
    this.mediaRecorder?.stop();
    this.mediaRecorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.analyserCtx?.close();
    this.analyserCtx = null;
    this.chunks = [];
  }
}
