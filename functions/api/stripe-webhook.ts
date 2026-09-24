// Cloudflare Pages Function: POST /api/stripe-webhook
//
// Serverseitiger Nachweis erfolgreicher Zahlungen. Verifiziert die
// Stripe-Signatur und protokolliert eingegangene Unterstuetzung ins
// Cloudflare-Log ("Functions -> Real-time Logs" bzw. `wrangler pages
// deployment tail`).
//
// Ohne konfigurierten Webhook-Schluessel bleibt der Endpunkt bewusst still
// (HTTP 200, kein Fehler), damit ein noch nicht eingerichteter Webhook nichts
// blockiert und Stripe den Endpunkt nicht als defekt markiert.
import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

interface Context {
  request: Request;
  env: Env;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function onRequest(context: Context): Promise<Response> {
  if (context.request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const secret = context.env.STRIPE_SECRET_KEY ?? '';
  const whSecret = context.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!secret || !whSecret) {
    return json({ ok: true, skipped: true }, 200);
  }

  // Ohne Signatur-Header gar nicht erst rechnen.
  const signature = context.request.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'missing_signature' }, 400);
  }

  // Die Signatur wird ueber den EXAKTEN Rohtext gebildet — also request.text()
  // und niemals ein geparstes und neu serialisiertes Objekt.
  const payload = await context.request.text();

  let event: Stripe.Event;
  try {
    // constructEventAsync (nicht constructEvent): In der Workers-Runtime
    // signiert Stripe ueber die WebCrypto-API, und die ist ausschliesslich
    // asynchron — die synchrone Variante wirft hier zwingend.
    // Das Toleranzfenster (300 s) weist alte, erneut eingespielte Events ab.
    event = await new Stripe(secret).webhooks.constructEventAsync(
      payload,
      signature,
      whSecret,
      300,
    );
  } catch (err) {
    // Der Grund gehoert ins Log, nicht in die Antwort: Ein Angreifer soll
    // nicht erfahren, WARUM seine gefaelschte Signatur abgelehnt wurde.
    // eslint-disable-next-line no-console
    console.warn(
      `[localspeech] Webhook-Signatur abgelehnt: ${err instanceof Error ? err.message : 'unbekannt'}`,
    );
    return json({ error: 'invalid_signature' }, 400);
  }

  // Nur erwartete Ereignistypen auswerten — alles andere still quittieren,
  // damit Stripe den Endpunkt nicht als defekt markiert.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    // eslint-disable-next-line no-console
    console.log(
      `[localspeech] Unterstützung erhalten: ${(pi.amount / 100).toFixed(2)} ` +
        `${pi.currency.toUpperCase()} (${pi.id})`,
    );
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    // eslint-disable-next-line no-console
    console.warn(
      `[localspeech] Zahlung fehlgeschlagen (${pi.id}): ` +
        `${pi.last_payment_error?.code ?? 'ohne Code'}`,
    );
  }
  return json({ received: true }, 200);
}
