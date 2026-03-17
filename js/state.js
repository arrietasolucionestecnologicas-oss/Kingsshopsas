/* ARCHIVO: js/state.js - Estado Global KING'S SHOP */
export const API_URL = "https://script.google.com/macros/s/AKfycbzWEqQQTow3irxkTU4Y3CVJshtfjo1s2m1dwSicRihQ42_fArC6L9MAuQoUPUfzzXYS/exec"; 
window.API_URL = API_URL;

window.D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[], cotizaciones:[], pasivos:[]};
window.CART = [];

window.myModalEdit = window.myModalNuevo = window.myModalWA = window.myModalProv = null;
window.myModalPed = window.myModalEditPed = window.myModalEditMov = window.myModalRefinanciar = null;
window.myModalEditItem = window.myModalCotizaciones = window.myModalLogin = window.myModalAbonarPasivo = null;

window.prodEdit = window.pedEditId = window.movEditObj = window.refEditId = null;
window.refSaldoActual = 0;
window.calculatedValues = { total: 0, inicial: 0, base: 0, descuento: 0 };
window.currentUserAlias = "Anonimo";
window.usuarioForzoInicial = false;

export const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
window.COP = COP;
