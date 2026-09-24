// LocalSpeech Service Worker — cached die App-Shell, damit die Seite nach dem
// ersten Besuch komplett offline funktioniert. Die KI-Modelle werden von den
// Bibliotheken selbst im Cache Storage abgelegt (hier nicht angefasst).

const CACHE = 'localspeech-shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('localspeech-shell-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // HTML/Navigation: immer zuerst das Netz (frische Version), Cache nur als
  // Offline-Fallback. Verhindert, dass Nutzer auf einem alten Stand haengen.
  const isNavigation = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(event.request);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets (gehashte Dateinamen): Cache zuerst, im Hintergrund aktualisieren.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
