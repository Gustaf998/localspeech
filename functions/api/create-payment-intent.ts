// Cloudflare Pages Function: POST /api/create-payment-intent
//
// Duenner Adapter — die gesamte Pruefkette (Not-Aus, Herkunft, Content-Type,
// Rate-Limit, Betrag) liegt in api/_handler.ts, damit lokal, auf Vercel und
// hier exakt dasselbe gilt.
//
// Wichtig fuer Cloudflare: Secrets kommen NICHT aus process.env (das gibt es
// in der Workers-Runtime nicht), sondern aus context.env. Im Dashboard unter
// Settings -> Environment variables als "Secret" hinterlegen (verschluesselt),
// nicht als "Text".
import { createIntent, readEnv, MAX_BODY_BYTES } from '../../api/_handler';

interface Env {
  STRIPE_SECRET_KEY?: string;
  SUPPORT_ENABLED?: string;
  STRIPE_PAYMENT_METHODS?: string;
  ALLOWED_ORIGINS?: string;
}

// Minimal-Typ statt @cloudflare/workers-types: dessen globale Typen kollidieren
// mit der DOM-lib, die der Rest des Projekts (src/) braucht.
interface Context {
  request: Request;
  env: Env;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Antworten auf Zahlungsanfragen duerfen nirgends zwischengespeichert
      // werden — weder im Browser noch in Cloudflares Edge-Cache.
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}

// Bewusst ein einziger onRequest-Handler mit eigener Methodenpruefung: Wuerden
// hier onRequest UND onRequestPost nebeneinander stehen, haenge das Verhalten
// an Cloudflares Aufloesungsreihenfolge — im schlechten Fall bekaeme jede
// Zahlung eine 405. So ist es eindeutig.
export async function onRequest(context: Context): Promise<Response> {
  const { request } = context;
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Body zuerst begrenzen, dann parsen. Ein 50-MB-POST soll nicht erst
  // vollstaendig durch den JSON-Parser laufen.
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }

  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const result = await createIntent(
    {
      body,
      origin: request.headers.get('origin'),
      contentType: request.headers.get('content-type'),
      // CF-Connecting-IP setzt Cloudflare selbst und ist vom Client nicht
      // faelschbar — anders als X-Forwarded-For.
      clientIp: request.headers.get('cf-connecting-ip'),
    },
    readEnv(context.env as Record<string, string | undefined>),
  );

  if (result.logNote) {
    // eslint-disable-next-line no-console
    console.warn(`[localspeech/pay] ${result.status}: ${result.logNote}`);
  }
  return json(result.json, result.status);
}
