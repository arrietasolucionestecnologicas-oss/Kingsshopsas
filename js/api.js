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

function fetchConTimeout_(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS_);
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

export async function sincronizarCola() {
    let cola = JSON.parse(localStorage.getItem('kingshop_queue') || "[]");
    if (cola.length === 0) return;

    if(window.showToast) window.showToast(`Sincronizando ${cola.length} acciones pendientes...`, "info");

    let nuevaCola = [];
    for (let item of cola) {
        try {
            const response = await fetchConTimeout_(API_URL, {
                method: 'POST',
                headers: API_HEADERS_,
                body: JSON.stringify({ action: item.action, data: item.data })
            });
            const res = await response.json();
            if (!res.exito) throw new Error(res.error);
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
    const response = await fetchConTimeout_(API_URL, {
      method: 'POST',
      headers: API_HEADERS_,
      body: JSON.stringify({ action: action, data: data })
    });
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
