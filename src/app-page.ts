// Einstiegspunkt von app.html — der App-Seite.
//
// Warum eine eigene Seite und kein #/app mehr: Die App braucht
// Cross-Origin-Isolation (COOP/COEP) fuer SharedArrayBuffer, also
// Multithread-WASM in wllama/Whisper/Kokoro. Genau dieser Header blockiert
// aber die iFrames des Stripe Payment Elements auf der Startseite. Header
// gelten pro Dokument, nicht pro Ansicht — deshalb sind Startseite und App
// getrennte Dokumente. Siehe public/_headers und vite.config.ts.
//
// Anders als main.ts wird ./app hier statisch importiert: Auf dieser Seite
// IST die App der Inhalt, ein Nachladen brächte nichts.
import './style.css';
import { loadSettings, saveSettings } from './store';
import { fallbackTarget, targetLangById, uiLangFor } from './languages';
import { setUILang, applyI18n } from './i18n';
import { mountApp, leaveApp } from './app';

// Sprachzustand herstellen. Bewusst ohne die Auswahlfelder aus main.ts — die
// sitzen in der Landing-Navigation und existieren hier gar nicht. Umgestellt
// wird die Sprache in der App ueber Setup/Einstellungen.
function initLang() {
  const settings = loadSettings();
  if (!settings.nativeLang) {
    settings.nativeLang = 'en';
    if (settings.targetLang === settings.nativeLang) {
      settings.targetLang = fallbackTarget(settings.nativeLang);
      settings.voice = targetLangById(settings.targetLang).defaultVoice;
    }
    saveSettings(settings);
  }
  setUILang(uiLangFor(settings.nativeLang, settings.targetLang, settings.uiInTarget));
  applyI18n();
}

// Cursor-Spot fuer die Tier-Karten im Setup-Overlay (identisch zu main.ts;
// delegiert auf document, damit auch spaeter erzeugte Karten mitmachen).
function initCardSpot() {
  document.addEventListener('pointermove', (e) => {
    const card = (e.target as HTMLElement | null)?.closest?.(
      '.card, .tier-card, .faq details',
    ) as HTMLElement | null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    card.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  });
}

function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

// Beim Verlassen der Seite aufraeumen. Frueher uebernahm das der Router beim
// Wechsel weg von #/app; jetzt ist es eine echte Navigation. Wichtig vor allem
// fuer das Mikrofon: ohne recorder.cancel() bliebe die Aufnahme-Pipeline offen
// und die Kamera-/Mikro-Anzeige des Browsers stehen. "pagehide" statt
// "beforeunload", weil nur das mit dem Back-Forward-Cache mobil zuverlaessig
// feuert.
window.addEventListener('pagehide', () => leaveApp());

initLang();
initCardSpot();
mountApp();
registerServiceWorker();
