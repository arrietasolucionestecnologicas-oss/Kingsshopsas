/* ARCHIVO: js/app.js - Orquestador Central KING'S SHOP */
import { API_URL, COP } from './state.js';
import { callAPI, sincronizarCola } from './api.js';

// Importación de utilidades globales (Única Fuente de Verdad)
import './utils.js';

// Importación de módulos UI
import './ui/inventory.js';
import './ui/pos.js';
import './ui/finance.js';

window.verificarIdentidad = function() {
    var alias = localStorage.getItem('kingshop_alias');
    if (!alias) {
        if(window.myModalLogin) window.myModalLogin.show();
    } else {
        window.currentUserAlias = alias;
    }
}

window.guardarIdentidad = function() {
    var alias = document.getElementById('login-alias').value.trim();
    if (alias.length < 3) return alert("Por favor ingresa un nombre válido (Mínimo 3 letras).");
    localStorage.setItem('kingshop_alias', alias);
    window.currentUserAlias = alias;
    if(window.myModalLogin) window.myModalLogin.hide();
    if(window.showToast) window.showToast("Bienvenido, " + alias, "success");
    var dDisp = document.getElementById('user-display');
    if(dDisp) dDisp.innerText = window.currentUserAlias;
}

window.updateOnlineStatus = function() {
    const status = document.getElementById('offline-indicator');
    var pendientes = JSON.parse(localStorage.getItem('kingshop_queue') || "[]").length;
    if(navigator.onLine) {
        window.sincronizarCola().then(function() {
            var quedan = JSON.parse(localStorage.getItem('kingshop_queue') || "[]").length;
            if(status) {
                if(quedan > 0) {
                    status.innerText = "🔄 Sincronizando " + quedan + " operación(es) pendiente(s)...";
                    status.style.display = 'block';
                } else {
                    status.style.display = 'none';
                }
            }
        });
    } else {
        if(status) {
            status.innerText = pendientes > 0
                ? "⚠️ Modo Sin Conexión - " + pendientes + " operación(es) guardada(s), se subirán solas"
                : "⚠️ Modo Sin Conexión - Operando Localmente";
            status.style.display = 'block';
        }
    }
}
window.addEventListener('online', window.updateOnlineStatus);
window.addEventListener('offline', window.updateOnlineStatus);

window.saveLocalData = function(data) {
    localStorage.setItem('kingshop_data', JSON.stringify(data));
    localStorage.setItem('kingshop_last_sync', new Date().toISOString());
}

window.loadLocalData = function() {
    const raw = localStorage.getItem('kingshop_data');
    return raw ? JSON.parse(raw) : null;
}

window.showToast = function(msg, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
    toast.role = 'alert';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// RESTAURACIÓN DE FUNCIONES VITALES BORRADAS

window.nav = function(view, btn) {
    document.querySelectorAll('.view-sec').forEach(e => e.style.display = 'none');
    document.getElementById('view-' + view).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
    if(btn) btn.classList.add('active');
    localStorage.setItem('lastView', view);
    
    if(view === 'pos' && window.renderPos) window.renderPos();
    if(view === 'inv' && window.renderInv) window.renderInv();
    if(view === 'web' && window.renderWeb) window.renderWeb();
    if(view === 'cartera' && window.renderCartera) window.renderCartera();
    if(view === 'fin' && window.renderFin) window.renderFin();
    if(view === 'ped' && window.renderPed) window.renderPed();
}

window.loadData = function(silent = false) {
    if(!silent) document.getElementById('loader').style.display = 'flex';
    
    window.callAPI('obtenerDatosCompletos', {}).then(res => {
        if(res.inventario) {
            // 🛠️ MAPEOS CRÍTICOS: El backend envía nombres completos, el frontend usa alias.
            res.inv = res.inventario; 
            res.ped = res.pedidos;
            
            window.D = res;
            window.saveLocalData(res);
            window.renderData();
            if(!silent) document.getElementById('loader').style.display = 'none';
        } else {
            if(!silent) alert("Error cargando datos: " + res.error);
            let local = window.loadLocalData();
            if(local) { 
                local.inv = local.inventario || local.inv;
                local.ped = local.pedidos || local.ped;
                window.D = local; 
                window.renderData(); 
            }
            if(!silent) document.getElementById('loader').style.display = 'none';
        }
    }).catch(err => {
        console.error(err);
        let local = window.loadLocalData();
        if(local) { 
            local.inv = local.inventario || local.inv;
            local.ped = local.pedidos || local.ped;
            window.D = local; 
            window.renderData(); 
        }
        if(!silent) document.getElementById('loader').style.display = 'none';
    });
}

window.renderData = function() {
    if(window.renderInv) window.renderInv();
    if(window.renderWeb) window.renderWeb();
    if(window.renderCartera) window.renderCartera();
    if(window.renderFin) window.renderFin();
    if(window.renderPed) window.renderPed();
    if(window.renderPos) window.renderPos();
    if(window.updateGastosSelect) window.updateGastosSelect();
    if(window.renderPasivos) window.renderPasivos();
    
    if (window.D.metricas) {
        var bVentas = document.getElementById('bal-ventas');
        var bGanancia = document.getElementById('bal-ganancia');
        var bCaja = document.getElementById('bal-caja');
        
        if(bVentas) bVentas.innerText = window.COP.format(window.D.metricas.ventaMes || 0);
        if(bGanancia) bGanancia.innerText = window.COP.format(window.D.metricas.gananciaMes || 0);
        if(bCaja) bCaja.innerText = window.COP.format(window.D.metricas.saldo || 0);
    }
    
    var u = document.getElementById('user-display');
    if(u && window.currentUserAlias) u.innerText = window.currentUserAlias;

    // --- FIX: EXTRACCIÓN DINÁMICA DE PROVEEDORES ---
    var provSet = new Set();
    if (window.D.proveedores) {
        window.D.proveedores.forEach(p => {
            if(p.nombre) provSet.add(String(p.nombre).toUpperCase().trim());
        });
    }
    if (window.D.inv) {
        window.D.inv.forEach(p => {
            if(p.prov) provSet.add(String(p.prov).toUpperCase().trim());
        });
    }
    var allProvs = Array.from(provSet).sort();

    var provSelect = document.getElementById('filter-prov');
    if(provSelect) {
        provSelect.innerHTML = '<option value="">Todos los Proveedores</option>';
        allProvs.forEach(p => {
            provSelect.innerHTML += `<option value="${p}">${p}</option>`;
        });
    }

    var dlProvs = document.getElementById('list-provs-all');
    if(dlProvs) {
        dlProvs.innerHTML = '';
        allProvs.forEach(p => {
            var o = document.createElement('option');
            o.value = p;
            dlProvs.appendChild(o);
        });
    }

    // --- FIX: EXTRACCIÓN DINÁMICA DE CATEGORÍAS ---
    var catSet = new Set();
    if (window.D.categorias) {
        window.D.categorias.forEach(c => catSet.add(c));
    }
    if (window.D.inv) {
        window.D.inv.forEach(p => {
            if(p.cat) catSet.add(String(p.cat).trim());
        });
    }
    var allCats = Array.from(catSet);

    if(!allCats.includes("Gadget y Novedades")) {
        allCats.push("Gadget y Novedades");
    }
    allCats.sort();

    var dl = document.getElementById('list-cats'); 
    if(dl) { 
        dl.innerHTML=''; 
        allCats.forEach(c => { var o=document.createElement('option'); o.value=c; dl.appendChild(o); }); 
    }
    
    var dlp = document.querySelectorAll('#list-prods-all'); 
    dlp.forEach(list => {
        list.innerHTML = '';
        if (window.D.inv) {
            window.D.inv.forEach(p => { var o=document.createElement('option'); o.value=p.nombre; list.appendChild(o); });
        }
    });

    var editCat = document.getElementById('inp-edit-categoria');
    if(editCat && editCat.tagName === 'SELECT'){
        editCat.innerHTML = '';
        allCats.forEach(c => { var o = document.createElement('option'); o.value = c; o.text = c; editCat.appendChild(o); });
    } else if (editCat) {
        // En caso de que siga siendo un input con list="list-cats" en vez de un select real, no lo sobreescribimos
    }
}

window.onload = function() {
    if(document.getElementById('modalEdicion')) window.myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
    if(document.getElementById('modalNuevo')) window.myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
    if(document.getElementById('modalWA')) window.myModalWA = new bootstrap.Modal(document.getElementById('modalWA'));
    if(document.getElementById('modalProv')) window.myModalProv = new bootstrap.Modal(document.getElementById('modalProv'));
    if(document.getElementById('modalPed')) window.myModalPed = new bootstrap.Modal(document.getElementById('modalPed'));
    if(document.getElementById('modalEditPed')) window.myModalEditPed = new bootstrap.Modal(document.getElementById('modalEditPed'));
    if(document.getElementById('modalEditMov')) window.myModalEditMov = new bootstrap.Modal(document.getElementById('modalEditMov')); 
    if(document.getElementById('modalRefinanciar')) window.myModalRefinanciar = new bootstrap.Modal(document.getElementById('modalRefinanciar'));
    if(document.getElementById('modalEditItem')) window.myModalEditItem = new bootstrap.Modal(document.getElementById('modalEditItem'));
    if(document.getElementById('modalCotizaciones')) window.myModalCotizaciones = new bootstrap.Modal(document.getElementById('modalCotizaciones'));
    if(document.getElementById('modalLoginApp')) window.myModalLogin = new bootstrap.Modal(document.getElementById('modalLoginApp'));
    if(document.getElementById('modalAbonarPasivo')) window.myModalAbonarPasivo = new bootstrap.Modal(document.getElementById('modalAbonarPasivo'));
    if(document.getElementById('modalRadiografia')) window.myModalRadiografia = new bootstrap.Modal(document.getElementById('modalRadiografia'));
    if(document.getElementById('modalItemManual')) window.myModalItemManual = new bootstrap.Modal(document.getElementById('modalItemManual'));
    
    var tplElement = document.getElementById('tpl-cart');
    if(tplElement) {
        var tpl = tplElement.innerHTML;
        var dCart = document.getElementById('desktop-cart-container');
        var mCart = document.getElementById('mobile-cart');
        if(dCart) dCart.innerHTML = tpl;
        if(mCart) mCart.innerHTML = tpl;
    }

    document.querySelectorAll('#c-inicial').forEach(el => {
        el.removeAttribute('disabled');
        el.style.background = '#fff'; 
        if(window.calcCart) el.oninput = window.calcCart;        
    });
    
    var elCat = document.getElementById('inc-cat');
    if(elCat) {
        elCat.addEventListener('change', function(e) {
            var box = document.getElementById('box-prestamo');
            if (box) {
                if (e.target.value === 'Prestamo') box.style.display = 'block';
                else box.style.display = 'none';
            }
        });
    }

    // Buscador reactivo de Cobranza/Cartera: filtra visualmente las tarjetas
    // de deudores ya renderizadas (display:none), sin re-consultar datos.
    window.filtrarCobranza = function() {
        var input = document.getElementById('search-cobranza');
        var q = input ? input.value.trim().toLowerCase() : '';
        document.querySelectorAll('#cartera-list [data-search]').forEach(function(card) {
            var match = !q || card.getAttribute('data-search').indexOf(q) !== -1;
            card.style.display = match ? '' : 'none';
        });
    };
    var elSearchCobranza = document.getElementById('search-cobranza');
    if (elSearchCobranza) {
        elSearchCobranza.addEventListener('input', window.filtrarCobranza);
    }

    // Botón/gesto de retroceso de Android: sin esto, Capacitor usa su
    // comportamiento por defecto (history.back() o, como esta SPA nunca hace
    // pushState, cerrar la app de una vez) sin importar en qué pantalla o
    // modal esté el operador. Prioridad: (1) cerrar modal abierto, (2) cerrar
    // carrito móvil, (3) volver a la vista principal (pos), (4) minimizar
    // la app (no matarla) si ya está en home sin nada abierto.
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        var AppPlugin = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
        if (AppPlugin) {
            AppPlugin.addListener('backButton', function() {
                var modalAbierto = document.querySelector('.modal.show');
                if (modalAbierto && window.bootstrap) {
                    var instancia = bootstrap.Modal.getInstance(modalAbierto);
                    if (instancia) { instancia.hide(); return; }
                }

                var mobileCart = document.getElementById('mobile-cart');
                if (mobileCart && mobileCart.classList.contains('visible')) {
                    mobileCart.classList.remove('visible');
                    return;
                }

                var vistaActual = localStorage.getItem('lastView') || 'pos';
                if (vistaActual !== 'pos') {
                    var btnPos = document.querySelector(".nav-btn[onclick*=\"'pos'\"]");
                    if (btnPos && window.nav) { window.nav('pos', btnPos); return; }
                }

                AppPlugin.minimizeApp();
            });
        }
    }

    var lastView = localStorage.getItem('lastView') || 'pos';
    var btn = document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`);
    if(btn && window.nav) window.nav(lastView, btn);
    else if(window.nav && document.querySelector('.nav-btn')) window.nav('pos', document.querySelector('.nav-btn'));

    window.verificarIdentidad();
    window.updateOnlineStatus();

    // ── ARRANQUE OFFLINE-FIRST ──────────────────────────────────────────
    // Antes, cada apertura de la app esperaba primero a la red (hasta 15s
    // de "Conectando al Servidor...") y solo si esa petición fallaba caía
    // a los datos guardados localmente. Eso hacía que la app pareciera
    // requerir internet siempre, aunque ya tuviera datos de una sesión
    // anterior. Ahora: si hay datos guardados, se muestran de inmediato
    // (la app abre y funciona al instante, con o sin señal) y la
    // actualización con el servidor ocurre en segundo plano sin bloquear
    // nada. El loader que espera a la red solo aparece la primerísima vez
    // que se abre la app (todavía no hay nada guardado localmente).
    var datosGuardados = window.loadLocalData();
    if (datosGuardados) {
        datosGuardados.inv = datosGuardados.inventario || datosGuardados.inv;
        datosGuardados.ped = datosGuardados.pedidos || datosGuardados.ped;
        window.D = datosGuardados;
        window.renderData();
        // FIX: el loader arranca visible por defecto en el HTML (display:flex)
        // y solo loadData() lo oculta — pero aquí se pinta con renderData()
        // directamente y loadData(true) es silencioso (no lo toca), así que
        // sin esto la pantalla "Conectando al Servidor..." se quedaba
        // pegada para siempre TAPANDO los datos ya cargados y visibles detrás.
        var loaderEl = document.getElementById('loader');
        if (loaderEl) loaderEl.style.display = 'none';
        if (window.loadData) window.loadData(true);
    } else if (window.loadData) {
        window.loadData();
    }
    // ─────────────────────────────────────────────────────────────────────
};
