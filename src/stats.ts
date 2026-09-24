// Animationen der Statistik-Sektionen auf der Landing-Page: Zahlen zaehlen
// beim Hereinscrollen hoch, Balken wachsen zur Zielbreite. Die Zieltexte
// kommen aus i18n (data-i18n) — animiert wird die erste Zahl im bereits
// uebersetzten Text, danach steht wieder exakt der i18n-Text da.

let wired = false;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Zaehlt die erste Zahl im Element von 0 auf ihren Endwert hoch und laesst
// Praefix/Suffix ("< ", " %", "×", "Jahre" …) unveraendert stehen.
function countUp(el: HTMLElement) {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const final = el.textContent ?? '';
  const m = final.match(/\d+(?:[.,]\d+)?/);
  if (!m || m.index === undefined) return;
  const idx = m.index;
  const raw = m[0];
  const sep = raw.includes(',') ? ',' : '.';
  const target = parseFloat(raw.replace(',', '.'));
  const decimals = raw.includes(sep) ? raw.length - raw.indexOf(sep) - 1 : 0;
  if (reducedMotion() || target === 0) return;
  const start = performance.now();
  const dur = 1200;
  let lastWritten = final;
  const tick = (now: number) => {
    // Abbrechen, falls i18n den Text inzwischen ersetzt hat (Sprachwechsel)
    if (el.textContent !== lastWritten) return;
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    if (p >= 1) {
      el.textContent = final;
      return;
    }
    const val = (target * eased).toFixed(decimals).replace('.', sep);
    lastWritten = final.slice(0, idx) + val + final.slice(idx + raw.length);
    el.textContent = lastWritten;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Wird bei jedem Routenwechsel aufgerufen; verdrahtet die Observer nur einmal.
export function initStats(_view: string) {
  if (wired) return;
  wired = true;
  if (!('IntersectionObserver' in window)) {
    // Fallback: Balken sofort auf Zielbreite
    document.querySelectorAll('.chart-card').forEach((c) => c.classList.add('chart-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        io.unobserve(el);
        if (el.classList.contains('chart-card')) {
          el.classList.add('chart-in');
          el.querySelectorAll<HTMLElement>('.hbar-value').forEach(countUp);
        } else {
          countUp(el);
        }
      }
    },
    { threshold: 0.35 },
  );

  document
    .querySelectorAll<HTMLElement>('.chart-card, .stat-value, .bignum-value')
    .forEach((el) => io.observe(el));
}
