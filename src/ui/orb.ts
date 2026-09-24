// Die Sphäre als Fragment-Shader — Design "Liquid Ink": eine weiß glühende
// Glaskugel, in der dunkle Tinten-Strömungen flüssig umherziehen (zweifach
// domain-gewarptes fBm-Noise auf der taumelnden Kugeloberfläche). Entlang der
// Strömungsgrenzen glimmen dünne Glanz-Filamente, der Rand bekommt helles
// Fresnel-Licht. Der Mikrofon-Pegel macht die Strömung sichtbar wilder.
// Schlägt die Initialisierung fehl, bleibt der CSS-Look als Fallback aktiv.

export type OrbState = 'loading' | 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface OrbParams {
  speed: number; // Band-Rotationstempo
  bright: number; // Gesamthelligkeit
  dark: number; // Deckkraft der Bänder
}

const STATES: Record<OrbState, OrbParams> = {
  loading: { speed: 0.25, bright: 0.55, dark: 0.9 },
  idle: { speed: 0.5, bright: 1.0, dark: 1.0 },
  listening: { speed: 1.0, bright: 1.08, dark: 1.0 },
  transcribing: { speed: 1.8, bright: 0.9, dark: 1.0 },
  thinking: { speed: 2.4, bright: 0.95, dark: 1.0 },
  speaking: { speed: 1.3, bright: 1.12, dark: 1.0 },
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_bright;
uniform float u_dark;
uniform float u_level;
uniform float u_immersion; // 0 = im Dock, 1 = Sprech-only-Modus (Kugel im Zentrum)
uniform vec3 u_tint; // leichte Farbtoenung des Glases (1,1,1 = neutral weiss)

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }

float hash(vec3 p) {
  p = fract(p * 0.31831 + vec3(0.1, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec3(11.3, 7.1, 3.9);
    a *= 0.5;
  }
  return v;
}

void main() {
  float r = length(v_uv);
  float edge = 1.0 - smoothstep(0.97, 1.0, r);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // Normale der Kugeloberflaeche aus der Scheibe rekonstruieren
  vec3 n = vec3(v_uv, sqrt(max(0.0, 1.0 - r * r)));
  float t = u_time * 0.35;
  float im = u_immersion; // 0..1

  // Kugel taumelt langsam, damit die Stroemung dreidimensional wirkt —
  // im Sprech-Modus lebendiger, mit sanftem zusaetzlichen Rollen
  vec3 q = rotY(t * (0.45 + im * 0.2)) * rotX(0.5 + 0.35 * sin(t * 0.3) + im * 0.25 * sin(t * 0.7)) * n;

  // Doppelter Domain-Warp: eine grosse Stroemung verbiegt eine feinere —
  // das ergibt die fliessenden Tinten-Schlieren. Immersion treibt die
  // Stroemung staerker an, sodass die Tinte deutlich wilder wirbelt.
  float w = fbm(q * (1.5 + im * 0.4) + vec3(0.0, -t * (0.6 + im * 0.3), t * 0.25));
  float ink = fbm(q * (1.9 + u_level * 1.2 + im * 0.5) + w * (3.0 + u_level * 1.6 + im * 1.3) + vec3(t * 0.4, 0.0, -t * 0.3));

  // dunkle Stroemungspools im weissen Glas ...
  float pools = smoothstep(0.55, 0.27, ink);
  // ... und duenne Glanz-Filamente entlang der Stroemungsgrenzen
  float fil = pow(max(0.0, 1.0 - abs(ink - 0.44) * 10.0), 3.0);

  float dark = pools * 0.78;
  // Stroemung laeuft vor dem Rand aus — die Silhouette bleibt rundum hell
  dark *= smoothstep(1.0, 0.78, r);
  dark = clamp(dark, 0.0, 1.0) * u_dark;

  // Sanfte Beleuchtung von oben links + heller Fresnel-Rand
  float lam = 0.5 + 0.5 * dot(n, normalize(vec3(-0.35, 0.55, 0.75)));
  float rim = pow(1.0 - n.z, 2.4);

  vec3 base = vec3(0.94 + 0.22 * lam);
  vec3 deep = vec3(0.10, 0.10, 0.12) + rim * 0.5;
  vec3 col = mix(base, deep, dark);
  col += fil * (0.28 + u_level * 0.5 + im * 0.45) * (1.0 - dark * 0.6);
  col += rim * (0.65 + im * 0.55);
  // Sprech-Modus: die ganze Kugel atmet leuchtend und bekommt einen kuehlen,
  // fast irisierenden Rand-Schimmer — bleibt aber im weissen Glas-Look.
  float breath = 0.5 + 0.5 * sin(u_time * 1.6);
  col *= u_bright * (1.0 + im * 0.14 * breath);
  col += im * rim * breath * vec3(0.10, 0.16, 0.22);
  // Sanfte Farbtoenung: das Glas wird leicht in Richtung der Akzentfarbe
  // gewaschen, bleibt aber hell (u_tint = 1,1,1 laesst alles unveraendert).
  col *= mix(vec3(1.0), u_tint, 0.42);
  gl_FragColor = vec4(col * edge, edge);
}
`;

export class OrbGL {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program!: WebGLProgram;
  private raf = 0;
  private running = false;
  private last = 0;
  private t = 0;
  private state: OrbState = 'loading';
  private level = 0;
  // Geglättete Parameter für weiche Zustandswechsel
  private speed = STATES.loading.speed;
  private bright = STATES.loading.bright;
  private dark = STATES.loading.dark;
  private levelSm = 0; // geglätteter Mikro-Pegel für den Shader
  private immersion = 0; // Ziel: 0 im Dock, 1 im Sprech-only-Modus
  private immersionSm = 0; // geglätteter Immersionswert für weiche Übergänge
  private tint: [number, number, number] = [1, 1, 1]; // Farbtoenung des Glases
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private contextLost = false;
  private resizeObs: ResizeObserver | null = null;
  private onVisibility = () => {
    if (document.visibilityState === 'visible' && this.running && !this.raf && !this.reduced) {
      this.last = performance.now();
      this.loop();
    }
  };

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sphere-canvas';
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error('WebGL nicht verfuegbar');
    this.gl = gl;
    this.initGL();
    host.appendChild(this.canvas);
    host.classList.add('gl'); // blendet die CSS-Fallback-Baender aus

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.initGL();
      this.resize();
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // Loop stoppen, WebGL-Kontext freigeben und Canvas entfernen. Nötig für die
  // Galerie-Kugeln, die bei jedem Neuaufbau des Rasters neu erzeugt werden —
  // sonst summieren sich verwaiste WebGL-Kontexte bis zum Browser-Limit.
  destroy() {
    this.stop();
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    const host = this.canvas.parentElement;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
    host?.classList.remove('gl');
  }

  private initGL() {
    const { gl } = this;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`Shader-Fehler: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Link-Fehler: ${gl.getProgramInfoLog(prog)}`);
    }
    this.program = prog;
    gl.useProgram(prog);
    for (const name of ['u_time', 'u_bright', 'u_dark', 'u_level', 'u_immersion', 'u_tint']) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
    // Bildschirmfuellendes Quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
  }

  private resize() {
    const size = this.canvas.parentElement?.clientWidth ?? 0;
    if (size === 0 || this.contextLost) return;
    this.canvas.width = this.canvas.height = Math.round(size * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.reduced) this.draw();
  }

  setState(state: OrbState) {
    this.state = state;
  }

  setLevel(v: number) {
    this.level = Math.min(1, Math.max(0, v));
  }

  // Leichte Farbtoenung des Glases (z. B. Akzentfarbe des eigenen Charakters).
  // null / kein Hex = neutrales Weiss.
  setTint(hex: string | null) {
    if (!hex) {
      this.tint = [1, 1, 1];
    } else {
      const h = hex.replace('#', '');
      const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      this.tint = [
        parseInt(v.slice(0, 2), 16) / 255,
        parseInt(v.slice(2, 4), 16) / 255,
        parseInt(v.slice(4, 6), 16) / 255,
      ];
    }
    if (this.reduced && this.running) this.draw();
  }

  // Sprech-only-Modus: 1 = Kugel im Zentrum mit intensiverer Strömung.
  setImmersion(v: number) {
    this.immersion = Math.min(1, Math.max(0, v));
    // Bei reduzierter Bewegung läuft keine Schleife — sofort neu zeichnen.
    if (this.reduced && this.running) {
      this.immersionSm = this.immersion;
      this.draw();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (this.reduced) {
      this.t = 4.2;
      this.draw();
      return;
    }
    this.last = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    this.raf = requestAnimationFrame((now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const p = STATES[this.state];
      const k = 1 - Math.exp(-dt * 5);
      this.speed += (p.speed * (1 + this.level * 1.6) - this.speed) * k;
      this.bright += (p.bright * (1 + this.level * 0.25) - this.bright) * k;
      this.dark += (p.dark - this.dark) * k;
      this.levelSm += (this.level - this.levelSm) * k;
      this.immersionSm += (this.immersion - this.immersionSm) * k;
      // Im Sprech-Modus rotiert die Strömung etwas lebendiger
      this.t += dt * this.speed * (1 + this.immersionSm * 0.35);
      this.draw();
      if (this.running && document.visibilityState === 'visible') this.loop();
      else this.raf = 0;
    });
  };

  private draw() {
    const { gl } = this;
    if (this.contextLost) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.u_time, this.t);
    gl.uniform1f(this.uniforms.u_bright, this.bright);
    gl.uniform1f(this.uniforms.u_dark, this.dark);
    gl.uniform1f(this.uniforms.u_level, this.levelSm);
    gl.uniform1f(this.uniforms.u_immersion, this.immersionSm);
    gl.uniform3f(this.uniforms.u_tint, this.tint[0], this.tint[1], this.tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
