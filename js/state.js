/*
================================================================================
MODO 2 — MODIFICACIÓN ESTRUCTURAL 
ARCHIVO: js/state.js (Almacenamiento Global y Estado ES6)
================================================================================
*/

export const API_URL = "https://script.google.com/macros/s/AKfycbzWEqQQTow3irxkTU4Y3CVJshtfjo1s2m1dwSicRihQ42_fArC6L9MAuQoUPUfzzXYS/exec"; 
window.API_URL = API_URL;

// Variables de estado mutables en el DOM
window.D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[], cotizaciones:[], pasivos:[]};
window.CART = [];

// Instancias de Modales Bootstrap
window.myModalEdit = null;
window.myModalNuevo = null;
window.myModalWA = null;
window.myModalProv = null;
window.myModalPed = null;
window.myModalEditPed = null;
window.myModalEditMov = null;
window.myModalRefinanciar = null;
window.myModalEditItem = null;
window.myModalCotizaciones = null;
window.myModalLogin = null;
window.myModalAbonarPasivo = null;

// Control de UI e IDs temporales
window.prodEdit = null;
window.pedEditId = null; 
window.movEditObj = null; 
window.refEditId = null;
window.refSaldoActual = 0;
window.calculatedValues = { total: 0, inicial: 0, base: 0, descuento: 0 };
window.currentUserAlias = "Anonimo";
window.usuarioForzoInicial = false;

// Formato de Moneda Global
export const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
window.COP = COP;
