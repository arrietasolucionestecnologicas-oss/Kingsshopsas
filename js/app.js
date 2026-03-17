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
  if(window.loadData) window.loadData();
};

window.loadData = function(silent = false){
  var loader = document.getElementById('loader');
  if(!silent && (window.D.inv && window.D.inv.length === 0) && loader) loader.style.display='flex';
  
  window.callAPI('obtenerDatosCompletos').then(res => {
    if(res && res.inventario) {
        window.saveLocalData(res);
        window.renderData(res);
    } else {
        const local = window.loadLocalData();
        if(local) window.renderData(local);
    }
    if(loader) loader.style.display='none';
  }).catch(() => {
      const local = window.loadLocalData();
      if(local) {
          window.renderData(local);
          if(!silent) window.showToast("Modo Offline: Datos locales cargados", "warning");
      }
      if(loader) loader.style.display='none';
  });
}

window.renderData = function(res) {
    window.D = res;
    window.D.inv = res.inventario || [];
    window.D.historial = res.historial || []; 
    window.D.proveedores = res.proveedores || [];
    window.D.ultimasVentas = res.ultimasVentas || []; 
    window.D.ped = res.pedidos || [];
    window.D.deudores = res.deudores || [];
    window.D.cotizaciones = res.cotizaciones || [];
    window.D.pasivos = res.pasivos || [];

    if(res.metricas) {
        var uDisplay = document.getElementById('user-display');
        if(uDisplay) uDisplay.innerText = window.currentUserAlias;
        var bCaja = document.getElementById('bal-caja');
        if(bCaja) bCaja.innerText = window.COP.format(res.metricas.saldo||0);
        var bVentas = document.getElementById('bal-ventas');
        if(bVentas) bVentas.innerText = window.COP.format(res.metricas.ventaMes||0);
        var bGanancia = document.getElementById('bal-ganancia');
        if(bGanancia) bGanancia.innerText = window.COP.format(res.metricas.gananciaMes||0);
    }
    
    var provSet = new Set();
    window.D.proveedores.forEach(p => {
        if(p.nombre) provSet.add(String(p.nombre).toUpperCase().trim());
    });
    (window.D.inv || []).forEach(p => {
        if(p.prov) provSet.add(String(p.prov).toUpperCase().trim());
    });
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
    
    if(window.renderPos) window.renderPos(); 
    if(window.renderInv) window.renderInv(); 
    if(window.renderWeb) window.renderWeb();  
    if(window.renderFin) window.renderFin(); 
    if(window.renderPed) window.renderPed();
    if(window.renderProvs) window.renderProvs();
    if(window.renderCartera) window.renderCartera();
    if(window.renderPasivos) window.renderPasivos();
    
    var allCats = res.categorias || [];
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
        (window.D.inv || []).forEach(p => { var o=document.createElement('option'); o.value=p.nombre; list.appendChild(o); });
    });

    var editCat = document.getElementById('inp-edit-categoria');
    if(editCat){
        editCat.innerHTML = '';
        allCats.forEach(c => { var o = document.createElement('option'); o.value = c; o.text = c; editCat.appendChild(o); });
    }
    if(window.updateGastosSelect) window.updateGastosSelect();
}

window.nav = function(v, btn){
  document.querySelectorAll('.view-sec').forEach(e => e.style.display='none');
  var target = document.getElementById('view-'+v);
  if(target) target.style.display='block';
  document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
  if(btn) btn.classList.add('active');
  localStorage.setItem('lastView', v);
}

window.verBancos = function() {
    const msg = `👑 ¡Hola! Gracias por elegir KING'S SHOP SAS 🛒\n\nPara procesar tu pedido, por favor realiza el pago mediante transferencia. Aquí tienes nuestros datos bancarios:\n\n🏦 Banco: Bancolombia\n💳 Tipo de cuenta: Ahorro\n🔢 No Cuenta: 767-000051-51\n🔢 Llave: 0090894825\n👤 Titular: KING'S SHOP SAS\n📄 NIT: 901866162-1\n\n📲 Importante: Una vez realizada la transacción, por favor envíanos una foto o captura del comprobante por este chat. Esto nos permite verificar el pago y programar tu envío de inmediato. 📦🚀\n\nQuedamos atentos a tu confirmación. ¡Gracias por tu confianza! 🤝`;
    
    Swal.fire({
        title: 'Datos Bancarios',
        text: '¿Copiar plantilla de pago al portapapeles?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, Copiar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            navigator.clipboard.writeText(msg).then(() => {
                window.showToast("Datos de pago copiados al portapapeles", "success");
            });
        }
    });
}
