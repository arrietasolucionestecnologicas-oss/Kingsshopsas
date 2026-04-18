/* ARCHIVO: js/app.js - Orquestador Central KING'S SHOP */
import { API_URL, COP } from './state.js';
import { callAPI, sincronizarCola } from './api.js';

// Importación de módulos UI (Rutas corregidas)
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
    if(navigator.onLine) {
        if(status) status.style.display = 'none';
        window.sincronizarCola(); 
    } else {
        if(status) status.style.display = 'block';
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

    var lastView = localStorage.getItem('lastView') || 'pos';
    var btn = document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`);
    if(btn && window.nav) window.nav(lastView, btn);
    else if(window.nav && document.querySelector('.nav-btn')) window.nav('pos', document.querySelector('.nav-btn'));

    window.verificarIdentidad();
    window.updateOnlineStatus();
    
    // Arranque vital restaurado
    if(window.loadData) window.loadData();
};
