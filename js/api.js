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
// AbortController, a los 15s se aborta y el flujo cae al catch normal.
const FETCH_TIMEOUT_MS_ = 15000;

// FIX DUPLICADOS: crear/editar un producto CON FOTO implica que el servidor
// suba el archivo a Drive antes de responder — eso puede tardar más de 15s
// con una conexión lenta. Antes, ese caso normal (no un cuelgue real) se
// abortaba igual, el cliente lo daba por fallido y lo reintentaba desde la
// cola offline — mientras el servidor SÍ había terminado de guardarlo,
// generando un producto duplicado. Se le da más margen solo a estas
// llamadas específicas; todo lo demás sigue con el timeout corto de 15s.
const FETCH_TIMEOUT_MS_FOTO_ = 45000;

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
                const timeoutItem = (item.data && item.data.imagenBase64) ? FETCH_TIMEOUT_MS_FOTO_ : FETCH_TIMEOUT_MS_;
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

  if (!navigator.onLine && action !== 'obtenerDatosCompletos') {
      window.guardarEnCola(action, data);
      return { exito: true, offline: true };
  }

  try {
    const timeoutMs = (data && data.imagenBase64) ? FETCH_TIMEOUT_MS_FOTO_ : FETCH_TIMEOUT_MS_;
    const response = await fetchConTimeout_(API_URL, {
      method: 'POST',
      headers: API_HEADERS_,
      body: JSON.stringify({ action: action, data: data })
    }, timeoutMs);
    const result = await response.json();
    return result;
  } catch (e) {
    console.error("Error API:", e);
    if (action !== 'obtenerDatosCompletos') {
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
