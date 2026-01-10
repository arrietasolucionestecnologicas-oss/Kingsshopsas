/**
 * 👑 KINGSHOP SERVICE WORKER v57
 * - Permite que la app cargue sin conexión a internet.
 * - Cachea los archivos estáticos críticos.
 */

const CACHE_NAME = 'kingshop-v57-cache';
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

// 1. INSTALACIÓN: Descargar recursos a la memoria del cel
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. ACTIVACIÓN: Limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// 3. INTERCEPTOR: Servir desde caché si no hay red
self.addEventListener('fetch', event => {
  // Ignorar peticiones a la API de Google (esas se manejan en app.js)
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devuélvelo. Si no, búscalo en internet.
        return response || fetch(event.request);
      })
  );
});
