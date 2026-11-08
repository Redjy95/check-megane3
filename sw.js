// Check Mégane 3 — Service Worker (PWA Offline Support)
// Mudar a versão sempre que os ficheiros da app mudarem.
const CACHE = 'megane3-v9';
const ASSETS = ['./', './index.html', './app.js', './obd.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Rede primeiro (para receber atualizações), cache como alternativa offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  // Ficheiros da app: pedir sempre ao servidor se há versão nova (ignora a cache
  // de 10 min do GitHub Pages), para o HTML e o JS nunca ficarem desencontrados.
  const req = sameOrigin
    ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : e.request;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (sameOrigin && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached =>
        cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      ))
  );
});
