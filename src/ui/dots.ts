// Interaktives Punktraster hinter dem Chat: Unter dem Mauszeiger wölbt sich
// das Raster wie ein Hügel — die Punkte heben sich an, werden größer und
// heller — und flacht wieder ab, sobald der Zeiger weiterzieht. Canvas-2D,
// hält sich selbst an: Ohne Bewegung pausiert die Animationsschleife und es
// bleibt ein statisches Grundraster stehen.

const SPACING = 30; // Rasterabstand in CSS-Pixeln
const RADIUS = 120; // Einflussradius des Hügels
const LIFT = 8; // maximale Anhebung in px

export class DotGrid {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private raf = 0;
  private enabled = false;
  private last = 0;
  // Ziel- und geglättete Zeigerposition (weit außerhalb = kein Hügel)
  private mx = -9999;
  private my = -9999;
  private cx = -9999;
  private cy = -9999;
  private inside = false;
  private energy = 0; // 0..1 — wie stark der Hügel gerade ausgeprägt ist
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D nicht verfuegbar');
    this.ctx = ctx;
    new ResizeObserver(() => this.resize()).observe(canvas);

    // Der Zeiger wird auf dem Eltern-Element verfolgt (das Canvas selbst ist
    // pointer-events: none, Events kommen von Chat & Dock durchgereicht).
    const host = canvas.parentElement ?? canvas;
    host.addEventListener('pointermove', (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mx = e.clientX - r.left;
      this.my = e.clientY - r.top;
      this.inside = true;
      this.wake();
    });
    host.addEventListener('pointerleave', () => {
      this.inside = false;
      this.wake();
    });
    this.resize();
  }

  private resize() {
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    if (this.w === 0 || this.h === 0) return;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  start() {
    this.enabled = true;
    this.draw();
  }

  stop() {
    this.enabled = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private wake() {
    if (!this.enabled || this.reduced || this.raf) return;
    this.last = performance.now();
    this.loop();
  }

  private loop = () => {
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      // Beim ersten Kontakt direkt zum Zeiger springen statt quer zu gleiten
      if (this.cx < -5000) {
        this.cx = this.mx;
        this.cy = this.my;
      }
      const k = 1 - Math.exp(-dt * 10);
      this.cx += (this.mx - this.cx) * k;
      this.cy += (this.my - this.cy) * k;
      this.energy += ((this.inside ? 1 : 0) - this.energy) * (1 - Math.exp(-dt * 3.5));
      this.draw();

      const settled = !this.inside && this.energy < 0.01;
      if (this.enabled && !settled && document.visibilityState === 'visible') {
        this.loop();
      } else if (settled) {
        this.energy = 0;
        this.cx = this.cy = -9999;
        this.draw(); // flaches Grundraster stehen lassen
      }
    });
  };

  private draw() {
    const { ctx, w, h } = this;
    if (w === 0 || h === 0) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    const e = this.energy;
    const sigma2 = RADIUS * RADIUS * 0.35;
    const cut2 = RADIUS * RADIUS * 4.8; // ab hier ist der Hügel praktisch 0
    for (let gy = SPACING / 2; gy < h; gy += SPACING) {
      for (let gx = SPACING / 2; gx < w; gx += SPACING) {
        let lift = 0;
        if (e > 0.001) {
          const dx = gx - this.cx;
          const dy = gy - this.cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < cut2) lift = Math.exp(-d2 / sigma2) * e;
        }
        ctx.globalAlpha = 0.07 + lift * 0.2;
        ctx.beginPath();
        ctx.arc(gx, gy - lift * LIFT, 1 + lift * 0.8, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
