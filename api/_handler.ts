// Gemeinsame, framework-unabhaengige Logik fuer den Zahlungs-Endpunkt.
// Wird von der Cloudflare-Function (functions/api/create-payment-intent.ts),
// der Vercel-Function (api/create-payment-intent.ts) und dem Vite-Dev-Plugin
// (vite.config.ts) genutzt — dieselbe Pruefkette ueberall, damit lokal genau
// das laeuft, was auch in Produktion laeuft.
//
// Dateien/Ordner mit fuehrendem "_" behandelt Vercel NICHT als Endpunkt,
// sondern als reines Hilfsmodul.
//
// SICHERHEITSGRUNDSATZ: Der Client darf alles VORSCHLAGEN und nichts
// BESTIMMEN. Betrag, Waehrung, Zahlungsmethoden und die Frage, ob ueberhaupt
// kassiert wird, entscheidet ausschliesslich dieser Code anhand von
// Umgebungsvariablen.
import Stripe from 'stripe';

// Betrags-Grenzen in Cent — serverseitig erzwungen: 1 € bis 1000 €.
export const MIN_AMOUNT = 100;
export const MAX_AMOUNT = 100_000;

// Obergrenze fuer den Request-Body. Ein PaymentIntent-Wunsch besteht aus einer
// Zahl und optional einer E-Mail; alles darueber ist Missbrauch oder Unfug und
// wird gar nicht erst geparst.
export const MAX_BODY_BYTES = 2_048;

// Rate-Limit pro IP: 8 Anlaeufe in 10 Minuten. Grosszuegig genug fuer echte
// Nutzer (Tippfehler, Abbruch, neuer Versuch), eng genug, um automatisiertes
// Durchprobieren unattraktiv zu machen.
export const RATE_LIMIT_MAX = 8;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export interface HandlerResult {
  status: number;
  json: Record<string, unknown>;
  /** Nur fuers Server-Log, nie an den Client. */
  logNote?: string;
}

export interface RequestInput {
  /** Bereits geparster Body — oder der Rohtext, dann parst createIntent selbst. */
  body: unknown;
  origin: string | null;
  contentType: string | null;
  /** Fuer das Rate-Limit; bei Cloudflare aus CF-Connecting-IP. */
  clientIp: string | null;
}

export interface HandlerEnv {
  secret: string;
  /** Globaler Not-Aus. false => der Endpunkt kassiert nichts mehr. */
  supportEnabled: boolean;
  /**
   * Explizite Zahlungsmethoden-Liste. Leer/undefiniert => Stripe entscheidet
   * anhand der Dashboard-Einstellungen (automatic_payment_methods).
   */
  paymentMethods?: string[];
  /**
   * Erlaubte Herkunftsdomains. Leer => Pruefung aus (lokale Entwicklung).
   */
  allowedOrigins: string[];
}

let cached: Stripe | null = null;
let cachedKey = '';
function stripeClient(secret: string): Stripe {
  // Beim Schluesselwechsel (Test -> Live) neu instanziieren statt den alten
  // Client weiterzubenutzen.
  if (!cached || cachedKey !== secret) {
    cached = new Stripe(secret, { maxNetworkRetries: 2, timeout: 15_000 });
    cachedKey = secret;
  }
  return cached;
}

// --------------------------------------------------------------- Rate-Limit
// Bewusst im Arbeitsspeicher: In der Workers-Runtime lebt eine Isolate nur
// kurz und es gibt mehrere parallel — dieses Limit ist daher eine Bremse,
// KEINE Garantie. Der harte Schutz gehoert vor die Anwendung (Cloudflare
// "Rate limiting rules" auf /api/*) und ist in der README beschrieben.
const hits = new Map<string, number[]>();

export function rateLimited(ip: string | null, now = Date.now()): boolean {
  if (!ip) return false; // ohne IP nicht raten — lieber durchlassen als Echte sperren
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Karte klein halten: alte Eintraege bei Gelegenheit wegwerfen.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

// ------------------------------------------------------------- Validierung
function parseAmount(body: unknown): number | null {
  const raw = (body as { amount?: unknown } | null)?.amount;
  // Bewusst KEINE String-Umwandlung mehr: Der Client schickt eine Zahl. Alles
  // andere ist ein manipulierter Aufruf und wird abgelehnt, statt geraten.
  if (typeof raw !== 'number' || !Number.isInteger(raw) || !Number.isFinite(raw)) return null;
  if (raw < MIN_AMOUNT || raw > MAX_AMOUNT) return null;
  return raw;
}

// Prueft die Herkunft des Aufrufs. Verhindert, dass fremde Seiten den Endpunkt
// als kostenlosen PaymentIntent-Generator missbrauchen.
export function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true; // nicht konfiguriert => Pruefung aus
  if (!origin) return false; // konfiguriert, aber kein Origin => abweisen
  return allowed.some((a) => a.toLowerCase() === origin.toLowerCase());
}

// ------------------------------------------------------------------ Handler
export async function createIntent(
  input: RequestInput,
  env: HandlerEnv,
): Promise<HandlerResult> {
  // 1. Not-Aus zuerst — vor jeder anderen Arbeit.
  if (!env.supportEnabled) {
    return { status: 503, json: { error: 'support_disabled' } };
  }

  // 2. Herkunft.
  if (!originAllowed(input.origin, env.allowedOrigins)) {
    return {
      status: 403,
      json: { error: 'forbidden' },
      logNote: `origin abgelehnt: ${input.origin ?? '(keiner)'}`,
    };
  }

  // 3. Content-Type. Ein echter fetch() aus unserer App schickt immer JSON;
  //    ein per HTML-Formular erzwungener Cross-Site-POST kann das nicht.
  if (!input.contentType || !input.contentType.toLowerCase().includes('application/json')) {
    return { status: 415, json: { error: 'unsupported_media_type' } };
  }

  // 4. Rate-Limit.
  if (rateLimited(input.clientIp)) {
    return {
      status: 429,
      json: { error: 'rate_limited' },
      logNote: `Rate-Limit fuer ${input.clientIp}`,
    };
  }

  // 5. Betrag.
  const amount = parseAmount(input.body);
  if (amount === null) {
    return { status: 400, json: { error: 'invalid_amount' } };
  }

  // 6. Schluessel vorhanden?
  if (!env.secret) {
    // Noch nicht eingerichtet — der Client zeigt daraufhin einen freundlichen
    // Hinweis statt einer Fehlermeldung.
    return { status: 503, json: { error: 'not_configured' } };
  }

  // Zahlungsmethoden: explizite Liste, sonst Stripes Dashboard-Auswahl.
  // Automatic ist der Stripe-empfohlene Weg und bringt Apple/Google Pay von
  // selbst mit; die explizite Liste gibt dafuer Kontrolle im Code.
  const methodConfig =
    env.paymentMethods && env.paymentMethods.length > 0
      ? { payment_method_types: env.paymentMethods }
      : { automatic_payment_methods: { enabled: true as const } };

  try {
    const intent = await stripeClient(env.secret).paymentIntents.create({
      amount,
      currency: 'eur',
      // Bewusst kein receipt_email: Wir fragen keine Adresse ab und sammeln
      // damit auch kein personenbezogenes Datum ein. Wer einen Beleg braucht,
      // bekommt ihn ueber die Zahlungsart selbst (PayPal, Bank, Kartenabrechnung).
      ...methodConfig,
      description: 'LocalSpeech – freiwillige Unterstützung',
      metadata: { project: 'localspeech', kind: 'support' },
    });
    if (!intent.client_secret) {
      return { status: 502, json: { error: 'stripe_error' }, logNote: 'kein client_secret' };
    }
    return { status: 200, json: { clientSecret: intent.client_secret } };
  } catch (err) {
    // Stripe-Fehlertexte nennen Konto-Interna (aktivierte Methoden, Konto-IDs,
    // Schluesselzustand). Die gehoeren ins Log, nicht in den Browser.
    const message = err instanceof Error ? err.message : 'unbekannt';
    return { status: 502, json: { error: 'stripe_error' }, logNote: `Stripe: ${message}` };
  }
}

// -------------------------------------------------------- Env-Aufbereitung
// Eine Stelle, an der aus rohen Umgebungsvariablen die getypte Konfiguration
// wird — damit Cloudflare, Vercel und der Dev-Server dieselbe Semantik haben.
export function readEnv(raw: Record<string, string | undefined>): HandlerEnv {
  return {
    secret: raw.STRIPE_SECRET_KEY ?? '',
    // Not-Aus: NUR das ausdrueckliche "false" schaltet ab. Ein Tippfehler oder
    // eine fehlende Variable darf die Zahlung nicht versehentlich deaktivieren.
    supportEnabled: (raw.SUPPORT_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    paymentMethods: (raw.STRIPE_PAYMENT_METHODS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    allowedOrigins: (raw.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  };
}
