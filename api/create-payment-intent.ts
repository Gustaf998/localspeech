// Vercel Serverless Function: POST /api/create-payment-intent
//
// Duenner Adapter — die Pruefkette liegt in api/_handler.ts. Der geheime
// Stripe-Schluessel bleibt ausschliesslich hier auf dem Server (Env-Variable),
// nie im Browser.
//
// Hinweis: Der aktive Weg ist Cloudflare Pages (functions/api/…). Diese Datei
// existiert fuer ein alternatives Vercel-Deployment.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createIntent, readEnv, MAX_BODY_BYTES } from './_handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const declared = Number(req.headers['content-length'] ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'payload_too_large' });
    return;
  }

  // Vercel parst JSON-Bodies selbst; req.body ist hier bereits ein Objekt.
  const result = await createIntent(
    {
      body: req.body,
      origin: (req.headers.origin as string | undefined) ?? null,
      contentType: (req.headers['content-type'] as string | undefined) ?? null,
      // Hinter Vercels Proxy ist x-forwarded-for die einzige Quelle. Nur den
      // ERSTEN Eintrag nehmen: die weiteren kann der Client selbst faelschen.
      clientIp:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? null,
    },
    readEnv(process.env as Record<string, string | undefined>),
  );

  if (result.logNote) {
    // eslint-disable-next-line no-console
    console.warn(`[localspeech/pay] ${result.status}: ${result.logNote}`);
  }
  res.status(result.status).json(result.json);
}
