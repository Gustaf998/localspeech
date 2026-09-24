// Einstiegspunkt der Startseite (index.html): Landing + Rechtstexte.
//
// Die eigentliche App liegt in einem EIGENEN Dokument (app.html, Einstieg
// src/app-page.ts) — frueher war sie die Ansicht "#/app" hier drin. Grund ist
// der Cross-Origin-Isolation-Header (COOP/COEP): Die App braucht ihn fuer
// SharedArrayBuffer (Multithread-WASM), er blockiert aber die iFrames des
// Stripe Payment Elements in der Unterstuetzungs-Sektion. Header gelten pro
// Dokument, nicht pro Ansicht — nur getrennte Seiten liefern beides.
// Nebeneffekt: Der App-Code (~2 MB gzip) landet gar nicht erst im Bundle
// dieser Seite, die Startseite bleibt also blitzschnell.

import './style.css';
import { loadSettings, saveSettings } from './store';
import { NATIVE_LANGS, fallbackTarget, targetLangById, uiLangFor } from './languages';
import { t, setUILang, applyI18n } from './i18n';
import { initStats } from './stats';
import { initDonate } from './donate';

function langSelects(): HTMLSelectElement[] {
  return ['ui-lang-select']
    .map((id) => document.getElementById(id) as HTMLSelectElement | null)
    .filter((s): s is HTMLSelectElement => !!s);
}

// Mobil zeigt die Nav-Insel statt des ausgeschriebenen Sprachnamens nur die
// Flagge (siehe .lang-flag im CSS) — hier auf die aktive Muttersprache setzen.
function updateLangFlag() {
  const flagEl = document.getElementById('ui-lang-flag');
  if (!flagEl) return;
  const nativeLang = loadSettings().nativeLang;
  const lang = NATIVE_LANGS.find((l) => l.id === nativeLang);
  if (lang) flagEl.textContent = lang.flag;
}

// Standardmaessig ist die Oberflaeche auf Englisch — die Muttersprache lässt
// sich jederzeit umstellen, im Immersions-Modus zeigt sie die Lernsprache.
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

  for (const sel of langSelects()) {
    sel.innerHTML = '';
    for (const l of NATIVE_LANGS) {
      const o = document.createElement('option');
      o.value = l.id;
      o.textContent = `${l.flag} ${l.name}`;
      sel.appendChild(o);
    }
    sel.value = settings.nativeLang;
    sel.addEventListener('change', () => {
      const s = loadSettings();
      s.nativeLang = sel.value;
      if (s.targetLang === s.nativeLang) {
        s.targetLang = fallbackTarget(s.nativeLang);
        s.voice = targetLangById(s.targetLang).defaultVoice;
      }
      saveSettings(s);
      setUILang(uiLangFor(s.nativeLang, s.targetLang, s.uiInTarget));
      applyI18n();
      initLanding();
      updateLangFlag();
      for (const other of langSelects()) other.value = sel.value;
    });
  }
  updateLangFlag();
}

// Beim Zurueckkehren aus der App kann sich die Sprache geaendert haben
// (Einstellungen / Setup) — Landing-Texte und Umschalter nachziehen.
function syncLangFromSettings() {
  const settings = loadSettings();
  if (!settings.nativeLang) return;
  setUILang(uiLangFor(settings.nativeLang, settings.targetLang, settings.uiInTarget));
  applyI18n();
  initLanding();
  updateLangFlag();
  for (const sel of langSelects()) sel.value = settings.nativeLang;
}

type View = 'landing' | 'impressum' | 'datenschutz' | 'nutzung' | 'lizenzen';
let currentView: View | null = null;

function viewForHash(): View {
  const h = location.hash;
  if (h.startsWith('#/impressum')) return 'impressum';
  if (h.startsWith('#/datenschutz')) return 'datenschutz';
  if (h.startsWith('#/nutzung')) return 'nutzung';
  if (h.startsWith('#/lizenzen')) return 'lizenzen';
  return 'landing';
}

// Alte Lesezeichen und geteilte Links auf #/app auf die neue Seite umleiten.
// replace() statt assign(), damit der Zurueck-Knopf nicht in einer Schleife
// zwischen beiden Adressen haengen bleibt.
function redirectLegacyAppHash(): boolean {
  if (!location.hash.startsWith('#/app')) return false;
  location.replace('/app.html');
  return true;
}

function route() {
  const view = viewForHash();
  document.getElementById('landing')!.hidden = view !== 'landing';
  document.getElementById('page-impressum')!.hidden = view !== 'impressum';
  document.getElementById('page-datenschutz')!.hidden = view !== 'datenschutz';
  document.getElementById('page-nutzung')!.hidden = view !== 'nutzung';
  document.getElementById('page-lizenzen')!.hidden = view !== 'lizenzen';
  // Erst beim tatsaechlichen Aufruf fuellen (rund 60 Zeilen Tabelle) und nur
  // einmal — renderLicenses() ist idempotent.
  if (view === 'lizenzen') void import('./licenses-page').then((m) => m.renderLicenses());
  syncLangFromSettings();
  // Nur beim echten Seitenwechsel nach oben springen — Anker-Sprünge
  // innerhalb einer Seite (#features, #quellen …) sollen normal scrollen.
  if (view !== currentView && currentView !== null) {
    const anchor =
      !location.hash.startsWith('#/') && location.hash.length > 1
        ? document.getElementById(location.hash.slice(1))
        : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  }
  if (view !== currentView) initStats(view);
  currentView = view;
}

function initLanding() {
  if (!(navigator as any).gpu) {
    const note = document.getElementById('hero-support-note');
    if (note) note.textContent = t('hero.noteNoWebgpu');
  } else {
    const note = document.getElementById('hero-support-note');
    if (note) note.textContent = t('hero.note');
  }
  // Unterstuetzungs-Sektion (Stripe) verdrahten bzw. betragsabhaengige Texte
  // auffrischen — idempotent, Listener werden nur einmal gesetzt.
  initDonate();
}

// Cursor-Spot: Karten merken sich die Zeigerposition als CSS-Variablen,
// das CSS zeichnet dort einen weichen Lichtfleck (siehe .card::after).
// Delegiert auf document, damit auch spaeter erzeugte Karten (Setup) mitmachen.
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

// Scroll-Reveal: Landing-Elemente gleiten beim Hereinscrollen sanft ins Bild.
// Nach der Animation werden die Klassen entfernt, damit Hover-Effekte
// (z. B. das Anheben der Karten) wieder normal greifen.
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll<HTMLElement>(
    '.hero-badge, .hero h1, .hero-sub, .hero-actions, .hero-note, .hero-stats .stat, ' +
      '#landing .section h2, #landing .section-sub, #landing .card, ' +
      '#landing .pp, #landing .faq details, .cta-section .btn',
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        io.unobserve(el);
        el.classList.add('in');
        el.addEventListener('animationend', () => el.classList.remove('reveal', 'in'), { once: true });
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -30px 0px' },
  );
  targets.forEach((el) => {
    // Nachbarn im selben Raster erscheinen leicht versetzt nacheinander
    const idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty('--reveal-delay', `${Math.min(idx * 70, 350)}ms`);
    el.classList.add('reveal');
    io.observe(el);
  });
}

// Nav-Insel bekommt beim Scrollen etwas mehr Deckkraft und Schatten.
function initNavScroll() {
  const wrap = document.querySelector('.nav-wrap');
  if (!wrap) return;
  const onScroll = () => wrap.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

window.addEventListener('hashchange', () => {
  if (redirectLegacyAppHash()) return;
  route();
});

// Vor allem anderen: Wer mit #/app hereinkommt, soll gar nicht erst die
// Startseite aufbauen sehen, sondern direkt auf app.html landen.
if (!redirectLegacyAppHash()) {
  initLang();
  initLanding();
  initCardSpot();
  initReveal();
  initNavScroll();
  route();
  registerServiceWorker();
}
