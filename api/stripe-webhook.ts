// Vercel Serverless Function: POST /api/stripe-webhook
//
// ACHTUNG — NICHT der aktive Pfad. LocalSpeech wird auf Cloudflare Pages
// deployt; dort laeuft functions/api/stripe-webhook.ts. Diese Datei ist nur
// fuer ein alternatives Vercel-Deployment da und ist UNGETESTET:
// `export const config = { api: { bodyParser: false } }` ist Next.js-Syntax.
// Ob Vercel sie fuer eine reine Node-Function beachtet, ist offen — greift sie
// nicht, ist der Body bereits geparst, der Rohtext futsch und die
// Signaturpruefung schlaegt mit 400 fehl. Vor einem Vercel-Einsatz also erst
// mit einem echten Testevent verifizieren.
//
// Optionaler, aber empfohlener serverseitiger Nachweis erfolgreicher Zahlungen.
// Verifiziert die Stripe-Signatur und protokolliert eingegangene Unterstuetzung.
// Ohne konfigurierten Webhook-Schluessel bleibt der Endpunkt bewusst still
// (kein Fehler), damit ein offener Testmodus nichts blockiert.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Fuer die Signaturpruefung braucht Stripe den exakten Rohtext des Bodys —
// deshalb den automatischen Parser abschalten.
export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!secret || !whSecret) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }
  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await rawBody(req),
      req.headers['stripe-signature'] as string,
      whSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bad signature';
    res.status(400).json({ error: `webhook_signature: ${message}` });
    return;
  }
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    // eslint-disable-next-line no-console
    console.log(
      `[localspeech] Unterstützung erhalten: ${(pi.amount / 100).toFixed(2)} ` +
        `${pi.currency.toUpperCase()} (${pi.id})`,
    );
  }
  res.status(200).json({ received: true });
}
