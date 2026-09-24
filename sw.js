/**
 * 👑 KINGSHOP SERVICE WORKER v97
 * FIX CRITICO 13 2026-09-24: reproducido en vivo — a veces Apps Script
 * entrega mal la respuesta de un POST y regresa el texto de estado de
 * doGet en vez del JSON real (SyntaxError al parsear). Llega RAPIDO, no es
 * una demora, y se resuelve solo casi siempre al reintentar de inmediato.
 * callAPI ahora reintenta hasta 2 veces sin que el usuario vea nada antes
 * de darlo por fallido.
 * MEJORA 2026-09-24: descripcion de producto al compartir por WhatsApp con
 * mejor formato de lectura (etiqueta en negrita + linea en blanco entre
 * cada especificacion, en vez de un bloque de texto denso y pegado).
 * GARANTIA 2026-09-24: si el refresco de fondo lleva mas de 30 min sin
 * exito, ahora aparece un banner rojo visible avisandolo (antes se quedaba
 * mostrando datos viejos en silencio, sin ningun aviso, como paso 8 dias en
 * el celular por una restriccion de bateria de Samsung). Ademas reintenta
 * sola cada 3 minutos en segundo plano.
 * AUDITORIA 2026-09-24: piso general de timeout subido de 15s a 30s (Apps
 * Script mide 40s+ a veces incluso en operaciones normales); PDF de
 * cotizacion e importacion masiva ahora en 45s (Drive + lotes); importacion
 * masiva protegida contra duplicados si un reintento la alcanza a repetir.
 * FIX CRÍTICO 12: obtenerDatosCompletos() (trae TODO el negocio) tenía el
 * mismo timeout corto de 15s que una escritura chica — medido en vivo,
 * a veces tarda mas de 40s sin que el servidor este fallando, solo lento.
 * Se abortaba solo y en una sesion sin cache previo (incognito, celular
 * nuevo) la app se quedaba sin nada que mostrar. Ahora tiene 45s, igual
 * que la subida de fotos.
 * FIX CRÍTICO 11: loadData(true) (refresco silencioso tras un abono/ingreso/
 * gasto ya confirmado) ya no pisa el estado correcto en memoria con la
 * caché vieja de localStorage cuando ese refresco topa con la falla
 * intermitente de Apps Script (devuelve una página de carga en vez del
 * JSON real). Antes eso hacía parecer que un pago o ingreso "no se había
 * guardado" aunque sí estaba a salvo en la hoja.
 * FIX CRÍTICO 9: utils.js añadido al caché
 * FIX BAJO 6   : install con Promise.allSettled (fallo parcial no bloquea)
 * FIX CRÍTICO 10: cache:'no-store' en el fetch de HTML/JS (ver abajo) — sin
 * esto, GitHub Pages manda Cache-Control: max-age=600 y el navegador podía
 * quedarse hasta 10 minutos sirviendo una versión vieja del código aunque
 * el Service Worker "intentara" traer la más reciente, obligando a
 * usuarios sin conocimiento técnico a borrar caché a mano para ver un
 * arreglo recién publicado. Recordar subir este número cada vez que se
 * publique un cambio, para que el propio Service Worker se reinstale.
 */
const CACHE_NAME = 'kingshop-v97-cache';
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
    // FIX CRÍTICO 10: cache:'no-store' obliga a ir siempre a la red real,
    // ignorando el caché HTTP del navegador (el de GitHub Pages, 10 min).
    // Sin esto, "traer lo más reciente" quedaba a medias: se saltaba el
    // caché del Service Worker pero no el del navegador, y una app recién
    // publicada podía tardar hasta 10 minutos en llegarle a cada usuario.
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});
