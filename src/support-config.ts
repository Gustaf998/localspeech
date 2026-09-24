// Globaler Not-Aus fuer die Unterstuetzungs-Funktion.
//
// EINE Wahrheit fuer alle Stellen, die etwas mit Spenden zu tun haben:
// die Sektion auf der Startseite, die Navigations- und Footer-Links, den
// FAQ-Hinweis und die Erinnerung in der App.
//
// WICHTIG — das hier ist die KOSMETISCHE Haelfte des Schalters. Sie versteckt
// nur die Oberflaeche und laeuft im Browser, ist also manipulierbar. Die
// verbindliche Haelfte ist SUPPORT_ENABLED auf dem Server (api/_handler.ts):
// steht die auf "false", weist der Endpunkt jede Zahlungsanfrage mit 503 ab,
// egal was der Browser tut. Fuer eine echte Abschaltung BEIDE setzen —
// idealerweise die Server-Variable zuerst, denn sie wirkt sofort, waehrend
// VITE_SUPPORT_ENABLED erst nach einem Neu-Build greift.

const RAW = import.meta.env.VITE_SUPPORT_ENABLED as string | undefined;

// Nur das ausdrueckliche "false" schaltet ab. Eine fehlende Variable (z. B. in
// einem frischen Checkout ohne .env.local) darf die Funktion nicht
// versehentlich deaktivieren — sonst waere sie unbemerkt tot.
export const SUPPORT_ENABLED = String(RAW ?? 'true').trim().toLowerCase() !== 'false';

// Ein plausibler publishable key muss zusaetzlich vorliegen. Ohne ihn kann
// Stripe.js gar nicht erst laden — dann zeigen wir den "kommt bald"-Hinweis
// statt eines kaputten Formulars.
const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const PUBLISHABLE_KEY = PK;

export function stripeConfigured(): boolean {
  return typeof PK === 'string' && /^pk_(test|live)_/.test(PK) && PK.length > 24;
}

// Blendet alles aus, was zum Unterstuetzen einlaedt. Wird sowohl von der
// Startseite (main.ts) als auch von der App (app.ts) aufgerufen, damit kein
// Einstiegspunkt uebersehen wird.
export function hideSupportUI(root: ParentNode = document) {
  if (SUPPORT_ENABLED) return;
  root.querySelectorAll<HTMLElement>('#unterstuetzen, #donate-modal').forEach((el) => {
    el.hidden = true;
    el.style.display = 'none';
  });
  // Navigations-, Footer- und Fliesstext-Links wuerden sonst ins Leere zeigen.
  root.querySelectorAll<HTMLElement>('a[href="#unterstuetzen"]').forEach((el) => {
    // Im Fliesstext (FAQ) nur die Verlinkung aufheben, den Satz aber stehen
    // lassen — ein Loch mitten im Absatz waere schlimmer als ein toter Link.
    if (el.closest('p')) {
      const span = document.createElement('span');
      span.textContent = el.textContent ?? '';
      el.replaceWith(span);
    } else {
      el.hidden = true;
      el.style.display = 'none';
    }
  });
}
