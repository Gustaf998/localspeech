// Sequenzielle Wiedergabe-Queue fuer TTS-Audio-Schnipsel (Satz fuer Satz).
// Ein AnalyserNode haengt im Signalweg und liefert Lautstaerke + Spektral-
// Schwerpunkt in Echtzeit — daraus speist sich die Lippensynchronisation
// der Persona-Portraets (ui/avatar.ts).

import type { SpeechLevels } from '../ui/avatar';

export class SpeechPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private input: GainNode | null = null;
  private timeData: Uint8Array | null = null;
  private freqData: Uint8Array | null = null;
  private queue: AudioBuffer[] = [];
  private current: AudioBufferSourceNode | null = null;
  private playing = false;
  onPlaybackChange: ((playing: boolean) => void) | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;
      this.analyser.connect(this.ctx.destination);
      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.input = this.ctx.createGain();
      this.input.connect(this.analyser);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
      // Blockt die Autoplay-Policy trotzdem, setzt die naechste Geste fort.
      const ctx = this.ctx;
      document.addEventListener('pointerdown', () => void ctx.resume(), { once: true });
    }
    return this.ctx;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get pendingCount(): number {
    return this.queue.length + (this.playing ? 1 : 0);
  }

  // Momentane Sprech-Energie: RMS (Mundoeffnung) + spektraler Schwerpunkt
  // (Mundform: hell = i/e/s -> breit, dunkel = o/u/m -> rund).
  levels(): SpeechLevels {
    if (!this.analyser || !this.timeData || !this.freqData || !this.playing) {
      return { rms: 0, centroid: 0 };
    }
    this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeData.length);

    this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
    let amp = 0;
    let weighted = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      amp += this.freqData[i];
      weighted += this.freqData[i] * i;
    }
    const centroid = amp > 0 ? weighted / amp / this.freqData.length : 0;
    return { rms, centroid };
  }

  enqueue(samples: Float32Array, sampleRate: number) {
    const ctx = this.ensureCtx();
    const buf = ctx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    this.queue.push(buf);
    if (!this.playing) this.playNext();
  }

  private playNext() {
    const next = this.queue.shift();
    if (!next) {
      this.playing = false;
      this.current = null;
      this.onPlaybackChange?.(false);
      return;
    }
    if (!this.playing) {
      this.playing = true;
      this.onPlaybackChange?.(true);
    }
    this.ensureCtx();
    const src = this.ctx!.createBufferSource();
    src.buffer = next;
    src.connect(this.input ?? this.analyser ?? this.ctx!.destination);
    src.onended = () => this.playNext();
    this.current = src;
    src.start();
  }

  stop() {
    this.queue = [];
    if (this.current) {
      this.current.onended = null;
      try {
        this.current.stop();
      } catch {
        /* bereits gestoppt */
      }
      this.current = null;
    }
    if (this.playing) {
      this.playing = false;
      this.onPlaybackChange?.(false);
    }
  }
}
