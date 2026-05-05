/* ARCHIVO: js/api.js - Capa de Red y Sincronización */
import { API_URL } from './state.js';

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
            const response = await fetch(API_URL, {
                method: 'POST',
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
  }

  if (!navigator.onLine && action !== 'obtenerDatosCompletos') {
      window.guardarEnCola(action, data);
      return { exito: true, offline: true }; 
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
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
    if(window.showToast) window.showToast("Error de conexión", 'danger');
    return { exito: false, error: e.toString() };
  }
}
window.callAPI = callAPI;
