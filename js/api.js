/* ARCHIVO: js/api.js - Capa de Red y Sincronización */
import { API_URL } from './state.js';

// ── FIX WEBVIEW ANDROID (CORS/preflight) ───────────────────────────────────
// 'Content-Type: text/plain' (nunca 'application/json') convierte el POST en
// una "simple request" que el navegador NO precede con un preflight OPTIONS.
// Apps Script Web Apps no responden correctamente a OPTIONS, y en el WebView
// de Android ese preflight sin resolver es lo que deja la app colgada en
// "Conectando al Servidor Central..." en vez de fallar con un error visible.
// doPost() en el backend igual parsea el body como JSON (e.postData.contents)
// sin mirar este header, así que esto no cambia nada del lado del servidor.
const API_HEADERS_ = { 'Content-Type': 'text/plain;charset=utf-8' };

// Timeout defensivo: si la petición queda colgada a nivel de red/WebView (el
// caso que reporta el usuario), sin esto la promesa de fetch() nunca se
// resuelve ni rechaza y la pantalla de carga queda pegada para siempre. Con
// AbortController, se aborta y el flujo cae al catch normal.
// AUDITORÍA 2026-09-24: medido en vivo, Apps Script puede tardar 40s+ en
// responder incluso en operaciones normales, sin que el servidor esté
// fallando — es variabilidad propia de su infraestructura (cold starts,
// colas internas), no un cuelgue real de red. 15s era demasiado agresivo
// para CUALQUIER acción, no solo para fotos/datos — se sube el piso general
// a 30s, y las operaciones pesadas (Drive, PDFs, importación masiva, traer
// todo el negocio) usan 45s.
const FETCH_TIMEOUT_MS_ = 30000;

// FIX DUPLICADOS: crear/editar un producto CON FOTO implica que el servidor
// suba el archivo a Drive antes de responder — eso puede tardar más de 30s
// con una conexión lenta. Antes, ese caso normal (no un cuelgue real) se
// abortaba igual, el cliente lo daba por fallido y lo reintentaba desde la
// cola offline — mientras el servidor SÍ había terminado de guardarlo,
// generando un producto duplicado. Se le da más margen a estas llamadas y
// a cualquier otra que también toque Drive o procese en lote (ver lista en
// ACCIONES_LENTAS_ más abajo).
const FETCH_TIMEOUT_MS_FOTO_ = 45000;

// FIX TIMEOUT PREMATURO: estas acciones son inherentemente más lentas que
// una escritura chica — obtenerDatosCompletos() arma y agrega TODO el
// negocio (inventario, ventas, cartera, historial...) y sigue creciendo;
// generarCotizacionPDF crea carpetas en Drive y renderiza un PDF;
// procesarImportacionDirecta puede insertar decenas de productos de una
// pegada de WhatsApp. Con el timeout corto, cualquiera de estas se abortaba
// sola aunque el servidor SÍ estuviera terminando bien — mostrando errores
// falsos ("no aparece", "no carga") o, peor, reintentando desde la cola
// offline una acción que ya se había completado.
const FETCH_TIMEOUT_MS_LENTA_ = 45000;
const ACCIONES_LENTAS_ = {
    obtenerDatosCompletos: true,
    generarCotizacionPDF: true,
    procesarImportacionDirecta: true,
    // AUDITORÍA 2026-09-24: medido en vivo, traer una foto (lee el archivo
    // de Drive y lo codifica a base64 del lado del servidor) tardó casi
    // 30s — justo en el filo del timeout general y se abortaba antes de
    // recibir la respuesta buena.
    obtenerFotoBase64: true
};

// FIX 2026-09-24: acciones de SOLO LECTURA — si fallan, no tiene sentido
// guardarlas en la cola offline para "reintentar más tarde" como si fueran
// una venta o un abono que no se puede perder. Una foto que no cargó, o un
// listado que no llegó, simplemente se vuelve a pedir solo cuando se
// necesite otra vez. Antes, cada foto que fallaba (muy común: son 40+ por
// catálogo) se quedaba pegada en la cola para siempre, mostrando "Quedan
// 37 pendientes" cada vez que se abría la app aunque en realidad no hubiera
// nada urgente sin guardar — solo ruido.
const ACCIONES_SOLO_LECTURA_ = {
    obtenerDatosCompletos: true,
    obtenerFotoBase64: true,
    obtenerAbonosVenta: true,
    obtenerClientesCRM: true,
    obtenerHistorialCRM: true,
    getDashboardData: true,
    exportarParaWeb: true
};

function fetchConTimeout_(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS_);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
        .finally(() => clearTimeout(timeoutId));
}
// ─────────────────────────────────────────────────────────────────────────

export function guardarEnCola(accion, datos) {
    let cola = JSON.parse(localStorage.getItem('kingshop_queue') || "[]");
    cola.push({ action: accion, data: datos, timestamp: Date.now() });
    localStorage.setItem('kingshop_queue', JSON.stringify(cola));
    if(window.showToast) window.showToast("Guardado sin internet. Se subirá luego.", "warning");
}
window.guardarEnCola = guardarEnCola;

// FIX COLA ATASCADA: sincronizarCola() se dispara desde varios lugares
// (evento 'online', apertura de la app, reintentos) — sin un candado, dos
// llamadas podían solaparse, cada una leyendo la MISMA cola de localStorage
// antes de que la otra terminara de escribirla de vuelta. La que terminaba
// último pisaba el resultado de la primera (una condición de carrera
// clásica), así que ítems que sí se habían sincronizado con éxito volvían a
// aparecer como pendientes — la cola nunca bajaba de verdad.
let sincronizandoCola_ = false;

export async function sincronizarCola() {
    if (sincronizandoCola_) return; // ya hay una sincronización en curso
    let cola = JSON.parse(localStorage.getItem('kingshop_queue') || "[]");
    if (cola.length === 0) return;

    sincronizandoCola_ = true;
    if(window.showToast) window.showToast(`Sincronizando ${cola.length} acciones pendientes...`, "info");

    let nuevaCola = [];
    try {
        for (let item of cola) {
            try {
                const timeoutItem = (item.data && item.data.imagenBase64) ? FETCH_TIMEOUT_MS_FOTO_
                                  : ACCIONES_LENTAS_[item.action] ? FETCH_TIMEOUT_MS_LENTA_
                                  : FETCH_TIMEOUT_MS_;
                const response = await fetchConTimeout_(API_URL, {
                    method: 'POST',
                    headers: API_HEADERS_,
                    body: JSON.stringify({ action: item.action, data: item.data })
                }, timeoutItem);
                const res = await response.json();
                if (!res.exito && !res.duplicado) throw new Error(res.error);
            } catch (e) {
                console.error("Fallo al sincronizar item:", item, e);
                nuevaCola.push(item);
            }
        }

        localStorage.setItem('kingshop_queue', JSON.stringify(nuevaCola));
        if (nuevaCola.length === 0) {
            if(window.showToast) window.showToast("¡Sincronización completada!", "success");
            if(window.loadData) window.loadData(true);
        } else {
            if(window.showToast) window.showToast(`Quedan ${nuevaCola.length} pendientes.`, "warning");
        }
    } finally {
        sincronizandoCola_ = false;
    }
}
window.sincronizarCola = sincronizarCola;

export async function callAPI(action, data = null) {
  if (data && typeof data === 'object') {
      data.aliasOperador = window.currentUserAlias;
      // Idempotencia: registrarAbono() en el backend descarta duplicados por
      // opId (doble-clic, reintentos de red). Sin esto nunca se generaba el
      // opId del lado del cliente y esa protección del backend quedaba muerta.
      if (!data.opId) {
          data.opId = (crypto.randomUUID ? crypto.randomUUID() : ('op-' + Date.now() + '-' + Math.random().toString(36).slice(2)));
      }
  }

  if (!navigator.onLine && !ACCIONES_SOLO_LECTURA_[action]) {
      window.guardarEnCola(action, data);
      return { exito: true, offline: true };
  }

  const timeoutMs = (data && data.imagenBase64) ? FETCH_TIMEOUT_MS_FOTO_
                   : ACCIONES_LENTAS_[action] ? FETCH_TIMEOUT_MS_LENTA_
                   : FETCH_TIMEOUT_MS_;

  // FIX 2026-09-24: Apps Script entrega la respuesta real de un POST vía una
  // redirección — y de forma intermitente y ya documentada, esa redirección
  // puede resolver mal y devolver el texto plano de doGet ("KING'S SHOP API
  // v2.5 ONLINE...") en vez del JSON real. response.json() truena con un
  // SyntaxError ("Unexpected token 'K'..."), PERO esto llega RÁPIDO (no es
  // una demora, es contenido equivocado) y casi siempre se resuelve solo en
  // el siguiente intento — reintentar de inmediato, sin que el usuario vea
  // nada, es mucho mejor que dejar caer la llamada.
  const REINTENTOS_PARSE_ = 2;
  let ultimoError;
  for (let intento = 0; intento <= REINTENTOS_PARSE_; intento++) {
    try {
      const response = await fetchConTimeout_(API_URL, {
        method: 'POST',
        headers: API_HEADERS_,
        body: JSON.stringify({ action: action, data: data })
      }, timeoutMs);
      return await response.json();
    } catch (e) {
      ultimoError = e;
      // Un AbortError significa que YA se esperó el timeout completo (30-45s)
      // — reintentar de inmediato solo alargaría la espera sin ganar nada;
      // ese caso lo maneja la cola offline más abajo. El reintento inmediato
      // es solo para el caso rápido de contenido equivocado (SyntaxError).
      if (e.name === 'AbortError' || intento === REINTENTOS_PARSE_) break;
      await new Promise(r => setTimeout(r, 700));
    }
  }

  {
    const e = ultimoError;
    console.error("Error API:", e);
    if (!ACCIONES_SOLO_LECTURA_[action]) {
        window.guardarEnCola(action, data);
        return { exito: true, offline: true };
    }
    // Respuesta estructurada garantizada aunque el fetch cuelgue/aborte: el
    // llamador (loadData en app.js) siempre recibe un objeto con 'exito' y
    // puede cerrar el loader y avisar al usuario, en vez de quedarse esperando.
    var msg = (e && e.name === 'AbortError')
        ? "Tiempo de espera agotado conectando al servidor. Verifica tu internet."
        : "Error de conexión con el servidor.";
    if(window.showToast) window.showToast(msg, 'danger');
    return { exito: false, error: e.toString(), offline: !navigator.onLine };
  }
}
window.callAPI = callAPI;
