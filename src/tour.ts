// Gefuehrte App-Tour (Coach-Marks): Spotlight-Loch ueber echten UI-Elementen
// plus Tooltip-Karte. Laeuft waehrend des Erst-Downloads, damit die Wartezeit
// zum Kennenlernen der App wird statt zum Absprung-Moment.
//
// Kein SVG-Masking noetig: Der Spotlight-Div wirft einen riesigen box-shadow,
// der alles ausserhalb abdunkelt; der Backdrop faengt alle Klicks ab.

import { t } from './i18n';

export interface TourStep {
  target: string; // CSS-Selektor fuer das Spotlight-Ziel
  titleKey: string;
  bodyKey: string;
  placement?: 'top' | 'bottom' | 'auto';
  available?: () => boolean; // Schritt auslassen, wenn Ziel fehlt/unsichtbar
  padding?: number; // Spotlight-Rand um das Ziel, Default 8
}

export interface TourHandle {
  // silent = Tour abraeumen ohne onDone (z. B. beim Verlassen der App-View),
  // damit sie beim naechsten Besuch erneut angeboten wird.
  end(silent?: boolean): void;
  active(): boolean;
}

const MOBILE_QUERY = '(max-width: 640px)';

function targetEl(step: TourStep): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(step.target);
  // getClientRects statt offsetParent: fixed positionierte Ziele (Pille!)
  // haben keinen offsetParent, sind aber trotzdem sichtbar.
  if (!el || el.getClientRects().length === 0) return null;
  return el;
}

export function startTour(
  allSteps: TourStep[],
  opts: { onDone: (skipped: boolean) => void },
): TourHandle {
  const steps = allSteps.filter((s) => (s.available ? s.available() : true) && targetEl(s));
  let idx = 0;
  let running = steps.length > 0;

  const host = document.getElementById('app') ?? document.body;
  const backdrop = document.createElement('div');
  backdrop.className = 'tour-backdrop';
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.innerHTML = `
    <h3 class="tour-title"></h3>
    <p class="tour-body"></p>
    <div class="tour-foot">
      <button type="button" class="tour-skip"></button>
      <span class="tour-count"></span>
      <div class="tour-nav">
        <button type="button" class="btn btn-ghost tour-prev"></button>
        <button type="button" class="btn btn-primary tour-next"></button>
      </div>
    </div>`;

  const $c = (sel: string) => card.querySelector<HTMLElement>(sel)!;

  function cleanup() {
    running = false;
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    window.visualViewport?.removeEventListener('resize', position);
    backdrop.remove();
    spot.remove();
    card.remove();
  }

  function finish(skipped: boolean) {
    if (!running) return;
    cleanup();
    opts.onDone(skipped);
  }

  function position() {
    if (!running) return;
    const step = steps[idx];
    const el = targetEl(step);
    if (!el) {
      // Ziel ist zwischenzeitlich verschwunden — Schritt ueberspringen.
      next();
      return;
    }
    const pad = step.padding ?? 8;
    const r = el.getBoundingClientRect();
    spot.style.top = `${r.top - pad}px`;
    spot.style.left = `${r.left - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;

    if (window.matchMedia(MOBILE_QUERY).matches) {
      // Mobil: Karte ist per CSS ein fixes Bottom-Sheet.
      card.style.top = '';
      card.style.left = '';
      return;
    }
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const margin = 14;
    let top = r.bottom + pad + margin; // bevorzugt unterhalb
    const fitsBelow = top + ch <= window.innerHeight - margin;
    if (step.placement === 'top' || (!fitsBelow && step.placement !== 'bottom')) {
      top = r.top - pad - margin - ch;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - ch - margin));
    let left = r.left + r.width / 2 - cw / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - cw - margin));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  function render() {
    const step = steps[idx];
    $c('.tour-title').textContent = t(step.titleKey);
    $c('.tour-body').textContent = t(step.bodyKey);
    $c('.tour-count').textContent = t('tour.progress', { n: idx + 1, m: steps.length });
    $c('.tour-skip').textContent = t('tour.skip');
    $c('.tour-prev').textContent = t('tour.back');
    $c('.tour-next').textContent = idx === steps.length - 1 ? t('tour.done') : t('tour.next');
    ($c('.tour-prev') as HTMLButtonElement).hidden = idx === 0;
    ($c('.tour-skip') as HTMLButtonElement).hidden = idx === steps.length - 1;
    position();
  }

  function next() {
    if (idx >= steps.length - 1) {
      finish(false);
      return;
    }
    idx++;
    render();
  }

  if (!running) {
    // Keine sichtbaren Ziele (sollte nicht passieren) — direkt fertig melden.
    opts.onDone(false);
    return { end() {}, active: () => false };
  }

  $c('.tour-next').addEventListener('click', next);
  $c('.tour-prev').addEventListener('click', () => {
    if (idx > 0) {
      idx--;
      render();
    }
  });
  $c('.tour-skip').addEventListener('click', () => finish(true));
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);

  host.append(backdrop, spot, card);
  render();
  // Nach dem ersten Layout einmal nachpositionieren (Kartenmasse stehen erst
  // jetzt fest, z. B. wegen Webfonts/Zeilenumbruechen).
  requestAnimationFrame(position);

  return {
    end(silent = false) {
      if (!running) return;
      if (silent) cleanup();
      else finish(true);
    },
    active: () => running,
  };
}
