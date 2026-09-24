// Freiwillige Unterstuetzung ("Support", bewusst KEIN wohltaetiger Spendenzweck)
// direkt auf der Seite — via Stripe Payment Element. Der Nutzer verlaesst die
// Domain nie; das Zahlformular ist ein eingebettetes iFrame.
//
// Stripe.js wird absichtlich erst beim tatsaechlichen Bezahl-Wunsch nachgeladen
// (Privacy + Performance): Vor dem Klick auf "Unterstuetzen" wird js.stripe.com
// gar nicht kontaktiert — das passt zum Offline-/Privacy-Versprechen der Seite.
//
// Diese Datei laeuft NUR auf der Startseite (index.html). Die App liegt in
// einem eigenen, cross-origin-isolierten Dokument, in dem Stripes iFrames
// blockiert wuerden — siehe public/_headers.
import type { Stripe, StripeElements, Appearance } from '@stripe/stripe-js';
import { t } from './i18n';
import { loadSettings, saveSettings } from './store';
import { SUPPORT_ENABLED, PUBLISHABLE_KEY, stripeConfigured, hideSupportUI } from './support-config';

// Vorgeschlagene Betraege in Cent. Serverseitig nochmals geprueft (1 €–1000 €).
const MIN = 100;
const MAX = 100_000;
const DEFAULT_AMOUNT = 500;

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let selected = DEFAULT_AMOUNT;
let wired = false;
let busy = false;

const $ = (id: string) => document.getElementById(id);

// Bewusst locale-unabhaengig und im selben Stil wie die Betrags-Pillen ("5 €",
// "7,50 €") — nicht ueber Intl, das je nach Browser-Locale "€5" liefern wuerde.
function fmt(cents: number): string {
  const euros = cents / 100;
  const s = Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace('.', ',');
  return `${s} €`;
}

// Stripe-Appearance an die Schwarz-Weiss-Sprache + Green-Highlight koppeln,
// damit das eingebettete Formular wie ein Teil der Seite wirkt.
function appearance(): Appearance {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
  return {
    theme: 'night',
    variables: {
      colorPrimary: v('--hl', '#4ade80'),
      colorBackground: v('--surface', '#121214'),
      colorText: v('--text', '#f4f4f5'),
      colorTextSecondary: v('--muted', '#9d9da3'),
      colorDanger: v('--danger', '#ff6b6b'),
      fontFamily: v('--font', 'Inter, sans-serif'),
      borderRadius: '10px',
      spacingUnit: '4px',
    },
  };
}

function setError(msg: string) {
  const el = $('support-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

// Zeigt den "kommt bald"-Hinweis statt der Auswahl. Genutzt, wenn kein
// Schluessel hinterlegt ist oder der Server die Funktion abgeschaltet hat.
function showUnavailable(messageKey = 'support.soon') {
  const soon = $('support-soon');
  if (soon) {
    soon.textContent = t(messageKey);
    soon.hidden = false;
  }
  const choose = $('support-choose');
  const pay = $('support-pay');
  if (choose) choose.hidden = true;
  if (pay) pay.hidden = true;
  setError('');
}

function reflectSelection() {
  document.querySelectorAll<HTMLButtonElement>('.support-amount').forEach((b) => {
    const active = Number(b.dataset.amount) === selected;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  const start = $('support-start');
  if (start) start.textContent = t('support.start', { amount: fmt(selected) });
}

function pickAmount(cents: number, fromCustom = false) {
  selected = Math.min(MAX, Math.max(MIN, Math.round(cents)));
  if (!fromCustom) {
    const custom = $('support-custom') as HTMLInputElement | null;
    if (custom) custom.value = '';
  }
  setError('');
  reflectSelection();
}

// Zurueck von der Zahl-Ansicht zur Betragsauswahl. Fehlte bisher komplett —
// wer einmal auf "Unterstuetzen" geklickt hatte, kam ohne Neuladen der Seite
// nicht mehr an den Betrag heran.
function backToChoose() {
  if (busy) return;
  // Das Element gehoert zu einem PaymentIntent ueber den ALTEN Betrag; beim
  // naechsten Start wird ohnehin ein frischer erzeugt. Also sauber abraeumen,
  // sonst blieben zwei iFrames im DOM stehen.
  elements = null;
  const mount = $('support-element');
  if (mount) mount.innerHTML = '';
  const pay = $('support-pay');
  const choose = $('support-choose');
  if (pay) pay.hidden = true;
  if (choose) choose.hidden = false;
  setError('');
  reflectSelection();
}

// Serverantworten auf verstaendliche Texte abbilden. Der Server nennt bewusst
// nur kurze Codes und keine Stripe-Interna (siehe api/_handler.ts).
function messageForError(code: string | undefined): string {
  switch (code) {
    case 'rate_limited':
      return t('support.errorRate');
    case 'invalid_amount':
      return t('support.errorAmount');
    case 'forbidden':
    case 'unsupported_media_type':
    case 'payload_too_large':
    case 'bad_request':
      return t('support.errorBlocked');
    default:
      return t('support.error');
  }
}

// Zahlung starten: Stripe.js nachladen, PaymentIntent serverseitig erzeugen,
// Payment Element mounten und die Zahl-Ansicht einblenden.
async function beginPayment() {
  if (busy) return;
  setError('');

  if (!SUPPORT_ENABLED || !stripeConfigured()) {
    showUnavailable();
    return;
  }

  busy = true;
  const startBtn = $('support-start') as HTMLButtonElement | null;
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = t('support.loading');
  }

  try {
    if (!stripe) {
      const { loadStripe } = await import('@stripe/stripe-js');
      stripe = await loadStripe(PUBLISHABLE_KEY!);
    }
    if (!stripe) throw new Error('stripe_load_failed');

    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Keine Cookies mitschicken — der Endpunkt braucht keine und soll auch
      // keine Sitzung sehen.
      credentials: 'omit',
      body: JSON.stringify({ amount: selected }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      clientSecret?: string;
      error?: string;
    };

    if (!res.ok || !data.clientSecret) {
      // Not-Aus oder fehlende Einrichtung: freundlicher Hinweis statt Fehler.
      if (data.error === 'not_configured' || data.error === 'support_disabled') {
        showUnavailable();
        return;
      }
      setError(messageForError(data.error));
      return;
    }

    elements = stripe.elements({ clientSecret: data.clientSecret, appearance: appearance() });
    // Bewusst OHNE fields-Override: Die Standardeinstellung ('auto') sammelt
    // ohnehin nur, was das gewaehlte Zahlungsmittel zwingend braucht. Ein
    // "never" fuer das Land verpflichtet uns dagegen, es bei confirmPayment()
    // selbst mitzuliefern — sonst wirft Stripe einen IntegrationError.
    const paymentElement = elements.create('payment', { layout: 'tabs' });
    paymentElement.mount('#support-element');

    $('support-choose')!.hidden = true;
    $('support-pay')!.hidden = false;
    const submit = $('support-submit');
    if (submit) submit.textContent = t('support.submit', { amount: fmt(selected) });
    const chosen = $('support-chosen');
    if (chosen) chosen.textContent = fmt(selected);
  } catch {
    setError(t('support.error'));
    $('support-choose')!.hidden = false;
  } finally {
    busy = false;
    if (startBtn) {
      startBtn.disabled = false;
      reflectSelection();
    }
  }
}

// Zahlung bestaetigen. redirect: 'if_required' haelt gaengige Zahlungsmittel
// (Karte, Wallets, SEPA) inline; nur Methoden, die zwingend weiterleiten,
// nutzen die return_url — die Rueckkehr behandelt handleRedirectReturn().
async function confirmPayment() {
  if (busy || !stripe || !elements) return;
  busy = true;
  setError('');
  const submit = $('support-submit') as HTMLButtonElement | null;
  const back = $('support-back') as HTMLButtonElement | null;
  if (submit) {
    submit.disabled = true;
    submit.textContent = t('support.processing');
  }
  if (back) back.disabled = true;

  // Der Knopf darf NIE gesperrt zurueckbleiben: jeder Ausgang — Fehler,
  // unerwarteter Status, geworfene Ausnahme — laeuft durch reset(). Ohne das
  // fror die Zahlansicht bei "Wird verarbeitet…" ein und war nur per Neuladen
  // wieder zu verlassen.
  const reset = () => {
    busy = false;
    if (submit) {
      submit.disabled = false;
      submit.textContent = t('support.submit', { amount: fmt(selected) });
    }
    if (back) back.disabled = false;
  };

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${location.origin}${location.pathname}?support=return#unterstuetzen`,
      },
      redirect: 'if_required',
    });

    if (error) {
      // Stripes Client-Fehlertexte sind fuer Endnutzer gedacht und lokalisiert —
      // die duerfen wir direkt zeigen (anders als Server-Fehlertexte).
      setError(error.message || t('support.error'));
      reset();
      return;
    }

    const status = paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing') {
      // Erfolgsansicht ersetzt das Formular — hier bewusst kein reset().
      busy = false;
      showSuccess();
      return;
    }

    // Alles andere (requires_action, requires_payment_method, canceled oder gar
    // kein PaymentIntent) ist kein Erfolg: zurueck in einen bedienbaren Zustand.
    setError(t('support.error'));
    reset();
  } catch {
    // z. B. Netzwerkabbruch oder ein IntegrationError aus Stripe.js.
    setError(t('support.error'));
    reset();
  }
}

function showSuccess() {
  try {
    const s = loadSettings();
    s.supporter = true;
    saveSettings(s);
  } catch {
    /* egal — nur zum Stummschalten der Erinnerung */
  }
  const pay = $('support-pay');
  const choose = $('support-choose');
  const ok = $('support-success');
  if (pay) pay.hidden = true;
  if (choose) choose.hidden = true;
  if (ok) ok.hidden = false;
}

// Rueckkehr von einem weiterleitenden Zahlungsmittel: Stripe haengt
// payment_intent_client_secret an die return_url. Status pruefen und ggf.
// den Dank anzeigen.
async function handleRedirectReturn() {
  const params = new URLSearchParams(location.search);
  const clientSecret = params.get('payment_intent_client_secret');
  if (!clientSecret || !stripeConfigured()) return;
  try {
    if (!stripe) {
      const { loadStripe } = await import('@stripe/stripe-js');
      stripe = await loadStripe(PUBLISHABLE_KEY!);
    }
    const result = await stripe?.retrievePaymentIntent(clientSecret);
    const status = result?.paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing') showSuccess();
    else if (status) setError(t('support.error'));
  } catch {
    /* stillschweigend ignorieren */
  } finally {
    // Query-Parameter aus der URL entfernen, Anker behalten.
    history.replaceState(null, '', `${location.pathname}#unterstuetzen`);
  }
}

// Dynamische Texte (mit Betrag) auffrischen. Bewusst OHNE data-i18n im Markup,
// sonst wuerde applyI18n() den rohen "{amount}"-Platzhalter hineinschreiben.
function refreshTexts() {
  reflectSelection();
  const submit = $('support-submit');
  const pay = $('support-pay');
  if (submit && pay && !pay.hidden) submit.textContent = t('support.submit', { amount: fmt(selected) });
}

// Wird bei jedem Landing-Render aufgerufen: Listener werden nur einmal
// verdrahtet, die betragsabhaengigen Texte aber jedes Mal aufgefrischt (z. B.
// nach einem Sprachwechsel).
export function initDonate() {
  if (!$('unterstuetzen')) return;

  // Not-Aus: Sektion und alle Einstiegspunkte ausblenden, nichts verdrahten.
  if (!SUPPORT_ENABLED) {
    hideSupportUI();
    return;
  }

  if (!wired) {
    wired = true;

    document.querySelectorAll<HTMLButtonElement>('.support-amount').forEach((b) => {
      b.addEventListener('click', () => pickAmount(Number(b.dataset.amount)));
    });

    const custom = $('support-custom') as HTMLInputElement | null;
    custom?.addEventListener('input', () => {
      const euros = parseFloat(custom.value.replace(',', '.'));
      if (Number.isFinite(euros) && euros > 0) {
        pickAmount(euros * 100, true);
        document.querySelectorAll('.support-amount').forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        const start = $('support-start');
        if (start) start.textContent = t('support.start', { amount: fmt(selected) });
      }
    });

    $('support-start')?.addEventListener('click', () => void beginPayment());
    $('support-submit')?.addEventListener('click', () => void confirmPayment());
    $('support-back')?.addEventListener('click', () => backToChoose());

    // Ohne Schluessel gar nicht erst die Auswahl anbieten.
    if (!stripeConfigured()) showUnavailable();

    void handleRedirectReturn();
  }
  refreshTexts();
}
