/**
 * 👑 KINGSHOP SERVICE WORKER v85 - UPDATE FORCE
 * - Versión crítica: Limpieza de caché para visualización de Cartera.
 */

const CACHE_NAME = 'kingshop-v85-cache'; // <--- CAMBIADO A v85
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js', 
  './icon-192.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// 1. INSTALACIÓN
self.addEventListener('install', event => {
  self.skipWaiting(); // Fuerza al SW a tomar el control de inmediato
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. ACTIVACIÓN: Borrar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
            console.log('Borrando caché obsoleta:', key);
            return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTOR: Network First para archivos críticos
self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com')) return;

  // HTML y JS principal: Siempre intentar red primero
  if (event.request.mode === 'navigate' || event.request.url.includes('app.js')) {
      event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
      );
  } else {
      // Imágenes y librerías: Cache First
      event.respondWith(
        caches.match(event.request)
          .then(response => {
            return response || fetch(event.request);
          })
      );
  }
});
