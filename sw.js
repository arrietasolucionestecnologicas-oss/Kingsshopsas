/**
 * 👑 KINGSHOP SERVICE WORKER v58 - WORKBOX EDITION
 * - Estrategia: Stale-While-Revalidate & Network-First.
 * - Soporte: Carga offline robusta.
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
    console.log(`✅ Workbox cargado correctamente`);

    // 1. OMITIR ESPERA (Activar nueva versión rápido)
    self.addEventListener('install', (event) => {
        self.skipWaiting();
    });
    self.addEventListener('activate', (event) => {
        event.waitUntil(self.clients.claim());
    });

    // 2. PRECACHING (Archivos Nucleares)
    // Estos archivos deben estar siempre disponibles offline
    workbox.precaching.precacheAndRoute([
        { url: './index.html', revision: 'v58.0' },
        { url: './app.js', revision: 'v58.0' },
        { url: './manifest.json', revision: 'v1' },
        { url: './icon-192.png', revision: '1' },
        { url: './icon-512.png', revision: '1' }
    ]);

    // 3. ESTRATEGIA PARA LIBRERÍAS EXTERNAS (Bootstrap, SweetAlert, Dexie)
    // Stale-While-Revalidate: Usa lo que tiene en caché y actualiza en segundo plano
    workbox.routing.registerRoute(
        ({url}) => url.origin === 'https://cdn.jsdelivr.net' || 
                   url.origin === 'https://cdnjs.cloudflare.com' ||
                   url.origin === 'https://fonts.googleapis.com' ||
                   url.origin === 'https://unpkg.com',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'kingshop-libs',
        })
    );

    // 4. ESTRATEGIA PARA IMÁGENES (Google Drive / Fotos)
    // Cache First: Las imágenes se guardan para no gastar datos
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'image',
        new workbox.strategies.CacheFirst({
            cacheName: 'kingshop-images',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 100, // Guardar máx 100 fotos
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Días
                }),
            ],
        })
    );

    // 5. RUTAS DE NAVEGACIÓN
    workbox.routing.registerRoute(
        ({request}) => request.mode === 'navigate',
        new workbox.strategies.NetworkFirst({
            cacheName: 'kingshop-nav',
        })
    );

} else {
    console.log(`❌ Falló la carga de Workbox`);
}
