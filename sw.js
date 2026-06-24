/**
 * 👑 KINGSHOP SERVICE WORKER v89
 * FIX CRÍTICO 9: utils.js añadido al caché
 * FIX BAJO 6   : install con Promise.allSettled (fallo parcial no bloquea)
 */
const CACHE_NAME = 'kingshop-v90-cache';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './js/app.js',
  './js/state.js',
  './js/api.js',
  './js/utils.js',          // ← FIX CRÍTICO 9
  './js/ui/pos.js',
  './js/ui/finance.js',
  './js/ui/inventory.js',
  './icon-192.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// 1. INSTALACIÓN — fallo parcial no bloquea (FIX BAJO 6)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e.message))
        )
      );
    })
  );
});

// 2. ACTIVACIÓN — borrar cachés obsoletas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Borrando caché obsoleta:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTOR — Network First para JS/HTML, Cache First para assets
self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com')) return;
  if (event.request.mode === 'navigate' || event.request.url.includes('.js')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});
