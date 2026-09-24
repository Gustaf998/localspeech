import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createIntent, readEnv, MAX_BODY_BYTES } from './api/_handler';

// __dirname gibt es in dieser ESM-Config nicht ("type": "module").
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// COOP/COEP-Header aktivieren Cross-Origin-Isolation => SharedArrayBuffer =>
// mehrere WASM-Threads fuer Whisper/Kokoro (deutlich schneller auf CPU).
// "credentialless" erlaubt weiterhin CORS-Downloads vom Hugging-Face-CDN.
//
// NUR fuer die App-Seite (app.html) — NICHT fuer die Startseite. Unter COEP
// muessen eingebettete Cross-Origin-iFrames selbst COEP setzen; js.stripe.com
// tut das nicht, weshalb Chrome saemtliche iFrames des Payment Elements mit
// ERR_BLOCKED_BY_RESPONSE ablehnt und das Zahlformular leer bleibt. Da Header
// pro Dokument gelten, liegen App und Unterstuetzungs-Sektion deshalb in
// getrennten Dokumenten. Gegenstueck fuer Produktion: public/_headers.
const isolationHeaders: Record<string, string> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// Nur die Startseite bleibt OHNE Isolation — alles andere bekommt die Header.
//
// Die Ausnahmeliste ist bewusst so herum, und das ist keine Bequemlichkeit:
// Ein Worker, der aus einem isolierten Dokument gestartet wird, muss SELBST
// mit COEP ausgeliefert werden, auch als same-origin-Ressource. Bekommt nur
// /app.html den Header, scheitern stt.worker/tts.worker an
// ERR_BLOCKED_BY_RESPONSE und kein Modell laedt mehr. Dasselbe gilt fuer
// WASM-Binaries und nachgeladene Chunks.
//
// Auf Nicht-Dokumenten (Skripte, CSS, JSON) ist ein COEP-Header wirkungslos —
// er stoert die Startseite also nicht, obwohl sie sich Assets mit der App teilt.
const NON_ISOLATED = new Set(['/', '/index.html']);

function isolationForAppPage(): Plugin {
  const attach = (server: { middlewares: { use: (fn: unknown) => void } }) => {
    server.middlewares.use((req: any, res: any, next: () => void) => {
      const path = (req.url || '').split('?')[0];
      if (!NON_ISOLATED.has(path)) {
        for (const [k, v] of Object.entries(isolationHeaders)) res.setHeader(k, v);
      }
      next();
    });
  };
  return {
    name: 'isolation-app-page',
    configureServer: attach as unknown as Plugin['configureServer'],
    configurePreviewServer: attach as unknown as Plugin['configurePreviewServer'],
  };
}

// Bildet lokal (unter `vite dev`/`vite preview`) den Zahlungs-Endpunkt nach,
// damit die Zahlung ohne Cloudflare-/Vercel-Runtime im echten Browser testbar
// ist. Nutzt DIESELBE Pruefkette wie Produktion (api/_handler.ts) — lokal soll
// nichts durchgehen, was in Produktion abgewiesen wuerde.
function stripeDevApi(env: Record<string, string>): Plugin {
  const handlerEnv = readEnv(env);
  const attach = (server: { middlewares: { use: (path: string, fn: unknown) => void } }) => {
    server.middlewares.use(
      '/api/create-payment-intent',
      async (req: any, _res: any, next: () => void) => {
        const res = _res;
        const send = (status: number, json: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(json));
        };
        // Nicht an Vite durchreichen: dessen Modul-Transformation wuerde
        // api/create-payment-intent.ts als Quelltext ausliefern. Der Endpunkt
        // beantwortet ausschliesslich POST — alles andere endet hier.
        if (req.method !== 'POST') {
          void next; // Signatur beibehalten, aber bewusst ungenutzt
          return send(405, { error: 'method_not_allowed' });
        }
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const c of req) {
            const buf = typeof c === 'string' ? Buffer.from(c) : c;
            size += buf.length;
            if (size > MAX_BODY_BYTES) return send(413, { error: 'payload_too_large' });
            chunks.push(buf);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          const body = raw ? JSON.parse(raw) : null;
          const result = await createIntent(
            {
              body,
              origin: (req.headers.origin as string | undefined) ?? null,
              contentType: (req.headers['content-type'] as string | undefined) ?? null,
              clientIp: req.socket?.remoteAddress ?? null,
            },
            handlerEnv,
          );
          if (result.logNote) console.warn(`[localspeech/pay] ${result.status}: ${result.logNote}`);
          send(result.status, result.json);
        } catch {
          send(400, { error: 'bad_request' });
        }
      },
    );
  };
  return {
    name: 'stripe-dev-api',
    configureServer: attach as unknown as Plugin['configureServer'],
    configurePreviewServer: attach as unknown as Plugin['configurePreviewServer'],
  };
}

export default defineConfig(({ mode }) => {
  // Alle Env-Variablen laden (auch ohne VITE_-Prefix), damit das Dev-Plugin an
  // den geheimen Schluessel kommt. Dieser landet NICHT im Client-Bundle.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [stripeDevApi(env), isolationForAppPage()],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 5000,
      // Zwei Einstiegspunkte: Startseite (Landing + Rechtstexte + Stripe) und
      // App. Ohne diese Angabe wuerde Vite nur index.html bauen und app.html
      // stillschweigend ignorieren.
      rollupOptions: {
        input: {
          main: here('./index.html'),
          app: here('./app.html'),
        },
      },
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['@huggingface/transformers', 'kokoro-js', '@wllama/wllama'],
    },
    // Fester Port mit strictPort: Die Modell-Downloads liegen im Browser pro
    // Origin (Host + Port). Weicht Vite auf einen anderen Port aus, "verliert"
    // der Browser die bereits geladenen Modelle — lieber hart fehlschlagen.
    // Die Isolations-Header setzt isolationForAppPage() gezielt nur auf
    // /app.html — hier bewusst KEIN pauschales headers-Feld mehr, sonst waere
    // auch die Startseite isoliert und Stripe wieder blockiert.
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
