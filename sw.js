/**
 * 👑 KINGSHOP SERVICE WORKER v60 - UPDATE FORCE
 * - Versión crítica para activar Calculadora Libre.
 * - Fuerza la recarga de index.html y app.js
 */

const CACHE_NAME = 'kingshop-v60-cache'; // <--- CAMBIO CRÍTICO AQUÍ
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js', // Se actualizará automáticamente al cambiar la versión arriba
  './icon-192.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// 1. INSTALACIÓN: Descargar recursos nuevos
self.addEventListener('install', event => {
  // Forzar al SW a tomar el control inmediatamente sin esperar
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache v60');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. ACTIVACIÓN: Borrar cachés viejas (v57, v58, v59...)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
            console.log('Borrando caché vieja:', key);
            return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim()) // Tomar control de clientes abiertos
  );
});

// 3. INTERCEPTOR: Estrategia "Network First" para HTML (Más seguro para actualizaciones)
self.addEventListener('fetch', event => {
  // Ignorar APIs externas
  if (event.request.url.includes('script.google.com')) return;

  // Para el index.html y app.js, intentamos RED primero, si falla usamos CACHÉ
  // Esto asegura que si tienes internet, SIEMPRE veas lo nuevo.
  if (event.request.mode === 'navigate' || event.request.url.includes('app.js')) {
      event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
      );
  } else {
      // Para imágenes y estilos pesados, usamos CACHÉ primero (velocidad)
      event.respondWith(
        caches.match(event.request)
          .then(response => {
            return response || fetch(event.request);
          })
      );
  }
});
