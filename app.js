// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbzWEqQQTow3irxkTU4Y3CVJshtfjo1s2m1dwSicRihQ42_fArC6L9MAuQoUPUfzzXYS/exec"; 

var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[], cotizaciones:[], pasivos:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed, myModalEditPed, myModalEditMov, myModalRefinanciar, myModalEditItem, myModalCotizaciones, myModalLogin, myModalAbonarPasivo;
var prodEdit = null;
var pedEditId = null; 
var movEditObj = null; 
var refEditId = null;
var refSaldoActual = 0;
var calculatedValues = { total: 0, inicial: 0, base: 0, descuento: 0 };
var currentUserAlias = "Anonimo";

var usuarioForzoInicial = false;

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// --- GESTIÓN DE IDENTIDAD (BITÁCORA) ---
function verificarIdentidad() {
    var alias = localStorage.getItem('kingshop_alias');
    if (!alias) {
        myModalLogin.show();
    } else {
        currentUserAlias = alias;
    }
}

function guardarIdentidad() {
    var alias = document.getElementById('login-alias').value.trim();
    if (alias.length < 3) return alert("Por favor ingresa un nombre válido (Mínimo 3 letras).");
    localStorage.setItem('kingshop_alias', alias);
    currentUserAlias = alias;
    myModalLogin.hide();
    showToast("Bienvenido, " + alias, "success");
    document.getElementById('user-display').innerText = currentUserAlias;
}

// --- GESTIÓN DE ESTADO OFFLINE/ONLINE ---
function updateOnlineStatus() {
    const status = document.getElementById('offline-indicator');
    if(navigator.onLine) {
        status.style.display = 'none';
        sincronizarCola(); 
    } else {
        status.style.display = 'block';
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// --- LOCAL STORAGE HELPERS ---
function saveLocalData(data) {
    localStorage.setItem('kingshop_data', JSON.stringify(data));
    localStorage.setItem('kingshop_last_sync', new Date().toISOString());
}

function loadLocalData() {
    const raw = localStorage.getItem('kingshop_data');
    return raw ? JSON.parse(raw) : null;
}

function guardarEnCola(accion, datos) {
    let cola = JSON.parse(localStorage.getItem('kingshop_queue') || "[]");
    cola.push({ action: accion, data: datos, timestamp: Date.now() });
    localStorage.setItem('kingshop_queue', JSON.stringify(cola));
    showToast("Guardado sin internet. Se subirá luego.", "warning");
}

async function sincronizarCola() {
    let cola = JSON.parse(localStorage.getItem('kingshop_queue') || "[]");
    if (cola.length === 0) return;

    showToast(`Sincronizando ${cola.length} acciones pendientes...`, "info");
    
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
        showToast("¡Sincronización completada!", "success");
        loadData(true); 
    } else {
        showToast(`Quedan ${nuevaCola.length} pendientes.`, "warning");
    }
}

function showToast(msg, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
    toast.role = 'alert';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas');
                const scaleFactor = maxWidth / img.width;
                elem.width = maxWidth;
                elem.height = img.height * scaleFactor;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, elem.width, elem.height);
                resolve(elem.toDataURL(file.type, quality));
            }
            img.onerror = error => reject(error);
        }
        reader.onerror = error => reject(error);
    });
}

// --- CALL API INTELIGENTE (Inyecta la firma del Usuario en todas las peticiones) ---
async function callAPI(action, data = null) {
  if (data && typeof data === 'object') {
      data.aliasOperador = currentUserAlias; 
  }

  if (!navigator.onLine && action !== 'obtenerDatosCompletos') {
      guardarEnCola(action, data);
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
        guardarEnCola(action, data);
        return { exito: true, offline: true };
    }
    showToast("Error de conexión", 'danger');
    return { exito: false, error: e.toString() };
  }
}

window.onload = function() {
  myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
  myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  myModalWA = new bootstrap.Modal(document.getElementById('modalWA'));
  myModalProv = new bootstrap.Modal(document.getElementById('modalProv'));
  myModalPed = new bootstrap.Modal(document.getElementById('modalPed'));
  myModalEditPed = new bootstrap.Modal(document.getElementById('modalEditPed'));
  myModalEditMov = new bootstrap.Modal(document.getElementById('modalEditMov')); 
  myModalRefinanciar = new bootstrap.Modal(document.getElementById('modalRefinanciar'));
  myModalEditItem = new bootstrap.Modal(document.getElementById('modalEditItem'));
  myModalCotizaciones = new bootstrap.Modal(document.getElementById('modalCotizaciones'));
  myModalLogin = new bootstrap.Modal(document.getElementById('modalLoginApp'));
  myModalAbonarPasivo = new bootstrap.Modal(document.getElementById('modalAbonarPasivo'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;

  document.querySelectorAll('#c-inicial').forEach(el => {
      el.removeAttribute('disabled');
      el.style.background = '#fff'; 
      el.oninput = calcCart;        
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
  if(btn) nav(lastView, btn);
  else nav('pos', document.querySelector('.nav-btn'));

  verificarIdentidad();
  updateOnlineStatus();
  loadData();
};

function loadData(silent = false){
  if(!silent && (D.inv && D.inv.length === 0)) document.getElementById('loader').style.display='flex';
  
  callAPI('obtenerDatosCompletos').then(res => {
    if(res && res.inventario) {
        saveLocalData(res);
        renderData(res);
    } else {
        const local = loadLocalData();
        if(local) renderData(local);
    }
    document.getElementById('loader').style.display='none';
  }).catch(() => {
      const local = loadLocalData();
      if(local) {
          renderData(local);
          if(!silent) showToast("Modo Offline: Datos locales cargados", "warning");
      }
      document.getElementById('loader').style.display='none';
  });
}

function renderData(res) {
    D = res;
    D.inv = res.inventario || [];
    D.historial = res.historial || []; 
    D.proveedores = res.proveedores || [];
    D.ultimasVentas = res.ultimasVentas || []; 
    D.ped = res.pedidos || [];
    D.deudores = res.deudores || [];
    D.cotizaciones = res.cotizaciones || [];
    D.pasivos = res.pasivos || [];

    if(res.metricas) {
        var uDisplay = document.getElementById('user-display');
        if(uDisplay) uDisplay.innerText = currentUserAlias;
        var bCaja = document.getElementById('bal-caja');
        if(bCaja) bCaja.innerText = COP.format(res.metricas.saldo||0);
        var bVentas = document.getElementById('bal-ventas');
        if(bVentas) bVentas.innerText = COP.format(res.metricas.ventaMes||0);
        var bGanancia = document.getElementById('bal-ganancia');
        if(bGanancia) bGanancia.innerText = COP.format(res.metricas.gananciaMes||0);
    }
    
    var provSet = new Set();
    D.proveedores.forEach(p => {
        if(p.nombre) provSet.add(String(p.nombre).toUpperCase().trim());
    });
    (D.inv || []).forEach(p => {
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
    
    renderPos(); 
    renderInv(); 
    renderWeb();  
    renderFin(); 
    renderPed();
    renderProvs();
    renderCartera();
    renderPasivos();
    
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
        (D.inv || []).forEach(p => { var o=document.createElement('option'); o.value=p.nombre; list.appendChild(o); });
    });

    var editCat = document.getElementById('inp-edit-categoria');
    if(editCat){
        editCat.innerHTML = '';
        allCats.forEach(c => { var o = document.createElement('option'); o.value = c; o.text = c; editCat.appendChild(o); });
    }
    updateGastosSelect();
}

function renderPasivos() {
    var totalPasivos = D.pasivos.reduce((sum, p) => sum + (Number(p.saldo)||0), 0);
    var el = document.getElementById('bal-pasivos');
    if(el) el.innerText = COP.format(totalPasivos);
}

function abrirModalPasivos() {
    var sel = document.getElementById('pas-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">Seleccione...</option>';
    if (D.pasivos.length === 0) {
        sel.innerHTML += `<option value="" disabled>No tienes obligaciones pendientes</option>`;
    } else {
        D.pasivos.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.acreedor} (Debes: ${COP.format(p.saldo)})</option>`;
        });
    }
    var m = document.getElementById('pas-monto');
    if(m) m.value = '';
    myModalAbonarPasivo.show();
}

function seleccionarPasivo() {
    var id = document.getElementById('pas-select').value;
    var p = D.pasivos.find(x => x.id === id);
    var m = document.getElementById('pas-monto');
    if(p && m) m.value = p.saldo;
}

function doAbonoPasivo() {
    var sel = document.getElementById('pas-select');
    var m = document.getElementById('pas-monto');
    if(!sel || !m) return;
    
    var id = sel.value;
    var monto = parseFloat(m.value) || 0;
    if(!id || monto <= 0) return alert("Verifica el monto a pagar.");
    
    var pIdx = D.pasivos.findIndex(x => x.id === id);
    var acreedorName = "Desconocido";
    if(pIdx > -1) {
        acreedorName = D.pasivos[pIdx].acreedor;
        D.pasivos[pIdx].saldo -= monto;
        if(D.pasivos[pIdx].saldo <= 0) {
            D.pasivos.splice(pIdx, 1);
        }
    }
    
    if(D.metricas) D.metricas.saldo -= monto;
    D.historial.unshift({ desc: "Pago a Deuda: " + acreedorName, tipo: "egreso", monto: monto, fecha: new Date().toISOString().split('T')[0], _originalIndex: D.historial.length, saldo: D.metricas.saldo });
    
    myModalAbonarPasivo.hide();
    renderPasivos();
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && D.metricas) bCaja.innerText = COP.format(D.metricas.saldo||0);
    showToast("Pago de obligación registrado", "success");
    
    callAPI('abonarPasivo', {idPasivo: id, monto: monto, acreedor: acreedorName});
}

function updateGastosSelect() {
    var dl = document.getElementById('g-vinculo-list');
    if(dl) {
        dl.innerHTML = ''; 
        if (D.ultimasVentas && D.ultimasVentas.length > 0) {
            D.ultimasVentas.forEach(v => { 
                var o = document.createElement('option'); 
                o.value = `${v.desc} [${v.id}]`; 
                dl.appendChild(o); 
            });
        }
        if (D.inv && D.inv.length > 0) {
            var invSorted = [...D.inv].sort((a,b) => a.nombre.localeCompare(b.nombre));
            invSorted.forEach(p => {
                var o = document.createElement('option');
                o.value = `Stock: ${p.nombre} [${p.id}]`;
                dl.appendChild(o);
            });
        }
    }
}

function nav(v, btn){
  document.querySelectorAll('.view-sec').forEach(e => e.style.display='none');
  var target = document.getElementById('view-'+v);
  if(target) target.style.display='block';
  document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
  if(btn) btn.classList.add('active');
  localStorage.setItem('lastView', v);
}

function fixDriveLink(url) {
    if (!url) return "";
    try { url = decodeURIComponent(url).trim(); } catch(e) {}
    var match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) { match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); }
    if (match && match[1]) {
        return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";
    }
    return url.split(' ')[0];
}

// --- VENTA (POS) ---
function renderPos(){
  var searchEl = document.getElementById('pos-search');
  var placeholder = document.getElementById('pos-placeholder');
  var c = document.getElementById('pos-list'); 
  if(!searchEl || !placeholder || !c) return;
  
  var q = searchEl.value.toLowerCase().trim();
  c.innerHTML='';
  
  if(!q) { placeholder.style.display = 'block'; return; }
  placeholder.style.display = 'none';

  var lista = D.inv || [];
  var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
  
  if(res.length === 0) { c.innerHTML = '<div class="text-center text-muted py-3">No encontrado</div>'; return; }

  res.slice(0,20).forEach(p => {
    var active = CART.some(x=>x.id===p.id) ? 'active' : '';
    var precioDisplay = p.publico > 0 ? COP.format(p.publico) : `<span class="text-muted small">Costo: ${COP.format(p.costo)}</span>`;
    var descCorto = p.cat + (p.prov ? `<br><span style="color: var(--primary); font-weight: bold; font-size: 0.75rem;">Prov: ${p.prov}</span>` : '');

    var div = document.createElement('div');
    div.className = `pos-row-lite ${active}`;
    div.onclick = function() { toggleCart(p, div); };
    div.innerHTML = `
        <div class="info" style="min-width: 0; flex: 1; padding-right: 10px;">
            <div class="name" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal;">${p.nombre}</div>
            <div class="meta mt-1">${descCorto}</div>
        </div>
        <div class="price" style="white-space: nowrap;">${precioDisplay}</div>
    `;
    c.appendChild(div);
  });
}

function toggleCart(p, el) {
   var idx = CART.findIndex(x=>x.id===p.id);
   if(idx > -1) { 
       CART.splice(idx,1); 
       if(el) el.classList.remove('active'); 
   } else { 
       var item = Object.assign({}, p);
       item.cantidad = 1;
       item.conIva = false;
       item.modificadoManualmente = false; 
       
       if (item.publico > 0) {
           item.precioUnitarioFinal = item.publico; 
           if(item.costo > 0) {
               item.margenIndividual = ((item.publico / item.costo) - 1) * 100;
           } else {
               item.margenIndividual = 100;
           }
           item.modificadoManualmente = true; 
       } else {
           var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30;
           item.margenIndividual = globalUtil; 
           item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil/100);
       }
       
       item.descuentoIndividual = 0;
       
       CART.push(item); 
       if(el) el.classList.add('active'); 
   }
   updateCartUI();
}

function agregarAlCarritoDesdeInv(id) {
    var p = D.inv.find(x => x.id === id);
    if (!p) return showToast("Producto no encontrado", "danger");
    
    var idx = CART.findIndex(x => x.id === p.id);
    if (idx > -1) { 
        CART[idx].cantidad++; 
    } else { 
        var item = Object.assign({}, p);
        item.cantidad = 1;
        item.conIva = false;
        item.modificadoManualmente = false; 
        
        if (item.publico > 0) {
            item.precioUnitarioFinal = item.publico; 
            if(item.costo > 0) {
                item.margenIndividual = ((item.publico / item.costo) - 1) * 100;
            } else {
                item.margenIndividual = 100;
            }
            item.modificadoManualmente = true; 
        } else {
            var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30;
            item.margenIndividual = globalUtil; 
            item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil/100);
        }
        
        item.descuentoIndividual = 0;
        CART.push(item); 
    }
    
    updateCartUI();
    showToast("🛍️ Agregado al carrito: " + p.nombre, "success");
}

function abrirEditorItem(id) {
    var item = CART.find(x => x.id === id);
    if (!item) return;
    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-item-nombre').value = item.nombre;
    document.getElementById('edit-item-costo').value = item.costo || 0;
    
    document.getElementById('edit-item-margen').value = item.margenIndividual.toFixed(1);
    document.getElementById('edit-item-desc').value = item.descuentoIndividual || 0;
    document.getElementById('edit-item-iva').checked = item.conIva || false;
    
    var pactadoEl = document.getElementById('edit-item-precio-pactado');
    if (pactadoEl) {
        pactadoEl.value = '';
    }
    
    calcEditorItem();
    myModalEditItem.show();
}

function calcEditorItem() {
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0;
    var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    var descPrc = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
    var iva = document.getElementById('edit-item-iva').checked;
    
    var precioLista = costo * (1 + margen/100);
    var descuentoMonto = precioLista * (descPrc / 100);
    var precioNeto = precioLista - descuentoMonto;
    
    if (precioNeto < 0) precioNeto = 0;
    if (iva) precioNeto *= 1.19;
    
    document.getElementById('edit-item-total').innerText = COP.format(Math.round(precioNeto));
}

function aplicarPrecioPactado() {
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0;
    var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    var precioPactado = parseFloat(document.getElementById('edit-item-precio-pactado').value) || 0;
    var iva = document.getElementById('edit-item-iva').checked;

    if (precioPactado <= 0) {
        document.getElementById('edit-item-desc').value = 0;
        calcEditorItem();
        return;
    }

    var precioObjetivoBase = iva ? (precioPactado / 1.19) : precioPactado;
    var precioLista = costo * (1 + margen/100);
    
    if (precioLista > 0) {
        var descuentoRequeridoMonto = precioLista - precioObjetivoBase;
        var descuentoRequeridoPrc = (descuentoRequeridoMonto / precioLista) * 100;
        
        if (descuentoRequeridoPrc < 0) {
             descuentoRequeridoPrc = 0;
             var nuevoMargen = ((precioObjetivoBase / costo) - 1) * 100;
             document.getElementById('edit-item-margen').value = nuevoMargen.toFixed(1);
        }
        
        document.getElementById('edit-item-desc').value = descuentoRequeridoPrc.toFixed(2);
    }
    calcEditorItem();
}

function guardarEditorItem() {
    var id = document.getElementById('edit-item-id').value;
    var item = CART.find(x => x.id === id);
    if (item) {
        item.nombre = document.getElementById('edit-item-nombre').value;
        item.margenIndividual = parseFloat(document.getElementById('edit-item-margen').value) || 0;
        item.descuentoIndividual = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
        item.conIva = document.getElementById('edit-item-iva').checked;
        item.modificadoManualmente = true; 
    }
    myModalEditItem.hide();
    updateCartUI(true);
}

function toggleItemIva(id) {
    var item = CART.find(x => x.id === id);
    if (item) {
        item.conIva = !item.conIva;
        updateCartUI();
    }
}

function changeQty(id, delta) {
    var item = CART.find(x => x.id === id);
    if (item) {
        item.cantidad += delta;
        if (item.cantidad <= 0) {
            var idx = CART.findIndex(x => x.id === id);
            CART.splice(idx, 1);
            renderPos();
        }
        updateCartUI();
    }
}

function agregarItemManual() {
    var nombre = prompt("Nombre del ítem / servicio:");
    if (!nombre) return;
    var precioStr = prompt("Precio de venta ($):");
    if (!precioStr) return;
    var precio = parseFloat(precioStr);
    if (isNaN(precio)) return alert("Precio inválido");

    var costoStr = prompt("Costo interno ($) (Deja vacío o 0 si no aplica):");
    var costo = parseFloat(costoStr) || 0;

    CART.push({
        id: 'MANUAL-' + Date.now(),
        nombre: nombre,
        cat: 'Manual',
        costo: costo,
        publico: precio,
        cantidad: 1,
        conIva: false,
        manual: true,
        modificadoManualmente: true,
        margenIndividual: costo > 0 ? ((precio/costo)-1)*100 : 100,
        descuentoIndividual: 0,
        precioUnitarioFinal: precio
    });
    updateCartUI(true);
}

function updateCartUI(keepOpen = false) {
   var count = CART.reduce((acc, item) => acc + (item.cantidad || 1), 0);
   
   var btnFloat = document.getElementById('btn-float-cart');
   if(btnFloat) {
       btnFloat.style.display = count > 0 ? 'block' : 'none';
       btnFloat.innerText = "🛒 " + count;
   }
   
   var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
   
   panels.forEach(parent => {
       if(!parent) return;
       var dateInput = parent.querySelector('#c-fecha');
       if(dateInput && !dateInput.value) {
           var today = new Date();
           var yyyy = today.getFullYear();
           var mm = String(today.getMonth() + 1).padStart(2, '0');
           var dd = String(today.getDate()).padStart(2, '0');
           dateInput.value = `${yyyy}-${mm}-${dd}`;
       }
       
       var inputConcepto = parent.querySelector('#c-concepto');
       
       if(CART.length === 0) {
           if(inputConcepto) inputConcepto.style.display = 'block';
           parent.querySelectorAll('#cart-items-list').forEach(e => e.style.display = 'none');
       } else {
           if(inputConcepto) { inputConcepto.style.display = 'none'; inputConcepto.value = ''; }
           parent.querySelectorAll('#cart-items-list').forEach(e => e.style.display = 'block');
       }
   });

   if(CART.length === 0 && !keepOpen) {
       var mobCart = document.getElementById('mobile-cart');
       if(mobCart) mobCart.classList.remove('visible');
   }
   
   calcCart(); 
}

function toggleManual() {
    var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
    var activeParent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    if(!activeParent) activeParent = document.getElementById('desktop-cart-container');

    if(!activeParent) return;
    var isManual = activeParent.querySelector('#c-manual') ? activeParent.querySelector('#c-manual').checked : false;
    var inpTotal = activeParent.querySelector('#res-cont-input');
    var inpUtil = activeParent.querySelector('#c-util');

    if(isManual) { 
        if(inpUtil) inpUtil.disabled = true; 
        setTimeout(() => { if(inpTotal) inpTotal.focus(); }, 100); 
    } else { 
        if(inpUtil) inpUtil.disabled = false; 
    }
    calcCart();
}

function calcCart() {
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var activeParent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!activeParent) activeParent = document.getElementById('desktop-cart-container'); 
   if(!activeParent) return;

   var cuotas = parseInt(activeParent.querySelector('#c-cuotas')?activeParent.querySelector('#c-cuotas').value:1)||1;
   var metodo = activeParent.querySelector('#c-metodo')?activeParent.querySelector('#c-metodo').value:'Contado';
   var conIvaGlobal = activeParent.querySelector('#c-iva')?activeParent.querySelector('#c-iva').checked:false;
   var isManual = activeParent.querySelector('#c-manual')?activeParent.querySelector('#c-manual').checked:false;
   var utilGlobal = parseFloat(activeParent.querySelector('#c-util')?activeParent.querySelector('#c-util').value:30)||0; 
   var descuentoGlobalPrc = parseFloat(activeParent.querySelector('#c-desc')?activeParent.querySelector('#c-desc').value:0)||0; 
   var tasaMensual = parseFloat(activeParent.querySelector('#c-int')?activeParent.querySelector('#c-int').value:5)||0; 
   var targetVal = parseFloat(activeParent.querySelector('#c-target')?activeParent.querySelector('#c-target').value:0);
   var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   
   var baseParaCalculo = 0;
   var totalFinal = 0;
   var descuentoDineroTotal = 0; 

   if (CART.length > 0) {
       CART.forEach(item => {
           let c = item.costo || 0;
           let q = item.cantidad || 1;
           
           if (item.manual) {
               totalFinal += (item.precioUnitarioFinal * q);
               baseParaCalculo += (item.precioUnitarioFinal * q);
           } else {
               let m = item.modificadoManualmente ? item.margenIndividual : utilGlobal;
               let precioLista = c * (1 + m/100);
               let dPrc = descuentoGlobalPrc > 0 ? descuentoGlobalPrc : (item.descuentoIndividual || 0);
               let descuentoDinero = precioLista * (dPrc / 100);
               descuentoDineroTotal += (descuentoDinero * q);
               
               let px = precioLista - descuentoDinero;
               if (px < 0) px = 0;
               if (item.conIva || conIvaGlobal) px *= 1.19;
               item.precioUnitarioFinal = px;
               
               baseParaCalculo += (c * q);
               totalFinal += (px * q);
           }
       });
   } else {
       var resContInput = activeParent.querySelector('#res-cont-input');
       var manualVal = resContInput ? parseFloat(resContInput.value) : 0;
       baseParaCalculo = isNaN(manualVal) ? 0 : manualVal;
       let precioListaBruto = baseParaCalculo * (1 + utilGlobal/100);
       descuentoDineroTotal = precioListaBruto * (descuentoGlobalPrc / 100);
       totalFinal = precioListaBruto - descuentoDineroTotal;
       if (totalFinal < 0) totalFinal = 0;
       if (conIvaGlobal) totalFinal *= 1.19; 
   }

   if (tieneTarget) {
       totalFinal = targetVal;
       if(activeParent.querySelector('#c-int')) activeParent.querySelector('#c-int').value = 0;
       if(activeParent.querySelector('#c-desc')) activeParent.querySelector('#c-desc').value = 0;
       descuentoDineroTotal = 0;
       
       if (CART.length > 0) {
           let totalPrevio = CART.reduce((acc, b) => acc + ((b.precioUnitarioFinal||0) * b.cantidad), 0);
           CART.forEach(item => {
               let peso = totalPrevio > 0 ? ((item.precioUnitarioFinal||0) * item.cantidad) / totalPrevio : 1 / CART.length;
               item.precioUnitarioFinal = (targetVal * peso) / item.cantidad;
           });
       }
   } else {
       if (metodo === "Crédito") {
           var iniTemp = totalFinal * 0.30;
           var saldoTemp = totalFinal - iniTemp;
           var interesTotal = saldoTemp * (tasaMensual/100) * cuotas;
           totalFinal = totalFinal + interesTotal;
       }
   }
   
   calculatedValues.base = baseParaCalculo; 
   calculatedValues.total = totalFinal;
   calculatedValues.descuento = descuentoDineroTotal;

   var inpInicial = activeParent.querySelector('#c-inicial');
   var activeEl = document.activeElement;
   var isTypingInicial = (activeEl && activeEl.id === 'c-inicial' && activeParent.contains(activeEl));
   var inicial = 0;
   
   if (isTypingInicial) {
       usuarioForzoInicial = true;
       inicial = parseFloat(inpInicial.value);
       if(isNaN(inicial)) inicial = 0;
   } else if (usuarioForzoInicial && inpInicial && inpInicial.value !== "") {
       inicial = parseFloat(inpInicial.value);
       if(isNaN(inicial)) inicial = 0;
   } else {
       inicial = Math.round(totalFinal * 0.30);
   }
   
   calculatedValues.inicial = inicial;
   var valorCuota = 0;
   if(metodo === "Crédito") {
       var saldo = totalFinal - inicial;
       if(saldo < 0) saldo = 0;
       valorCuota = saldo / cuotas;
   }

   var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
   
   panels.forEach(parent => {
       if(!parent) return;

       if (parent !== activeParent) {
           if(parent.querySelector('#c-cuotas') && document.activeElement !== parent.querySelector('#c-cuotas')) parent.querySelector('#c-cuotas').value = cuotas;
           if(parent.querySelector('#c-metodo') && document.activeElement !== parent.querySelector('#c-metodo')) parent.querySelector('#c-metodo').value = metodo;
           if(parent.querySelector('#c-iva') && document.activeElement !== parent.querySelector('#c-iva')) parent.querySelector('#c-iva').checked = conIvaGlobal;
           if(parent.querySelector('#c-manual') && document.activeElement !== parent.querySelector('#c-manual')) parent.querySelector('#c-manual').checked = isManual;
           if(parent.querySelector('#c-util') && document.activeElement !== parent.querySelector('#c-util')) parent.querySelector('#c-util').value = utilGlobal;
           if(parent.querySelector('#c-desc') && document.activeElement !== parent.querySelector('#c-desc')) parent.querySelector('#c-desc').value = descuentoGlobalPrc;
           if(parent.querySelector('#c-int') && document.activeElement !== parent.querySelector('#c-int')) parent.querySelector('#c-int').value = tasaMensual;
           if(parent.querySelector('#c-target') && document.activeElement !== parent.querySelector('#c-target')) parent.querySelector('#c-target').value = isNaN(targetVal) ? '' : targetVal;
           if(parent.querySelector('#c-cliente') && document.activeElement !== parent.querySelector('#c-cliente')) parent.querySelector('#c-cliente').value = activeParent.querySelector('#c-cliente') ? activeParent.querySelector('#c-cliente').value : "";
           if(parent.querySelector('#c-nit') && document.activeElement !== parent.querySelector('#c-nit')) parent.querySelector('#c-nit').value = activeParent.querySelector('#c-nit') ? activeParent.querySelector('#c-nit').value : "";
           if(parent.querySelector('#c-tel') && document.activeElement !== parent.querySelector('#c-tel')) parent.querySelector('#c-tel').value = activeParent.querySelector('#c-tel') ? activeParent.querySelector('#c-tel').value : "";
           if(parent.querySelector('#c-incluir-desc') && document.activeElement !== parent.querySelector('#c-incluir-desc')) parent.querySelector('#c-incluir-desc').checked = activeParent.querySelector('#c-incluir-desc') ? activeParent.querySelector('#c-incluir-desc').checked : false;
       }

       if (CART.length > 0) {
           var listContainer = parent.querySelector('#cart-items-list');
           if (listContainer) {
               var html = '';
               CART.forEach(x => {
                   var px = x.precioUnitarioFinal || 0;
                   var isLocked = x.modificadoManualmente ? `<i class="fas fa-lock" style="font-size:0.6rem; color:var(--gold);"></i>` : '';
                   html += `
                   <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom">
                       <div class="lh-1" style="flex:1;">
                           <small class="fw-bold" style="color:var(--primary);">${isLocked} ${x.nombre}</small><br>
                           <small class="text-muted">${COP.format(Math.round(px))} c/u</small>
                       </div>
                       <div class="d-flex align-items-center gap-2">
                           <button class="btn btn-sm ${x.modificadoManualmente ? 'btn-dark' : 'btn-light border'} py-0 px-2 text-primary" onclick="abrirEditorItem('${x.id}')" title="Editar precio/descuento">✏️</button>
                           <button class="btn btn-sm ${x.conIva ? 'btn-success' : 'btn-outline-secondary'} py-0 px-2 fw-bold" onclick="toggleItemIva('${x.id}')" title="Aplicar IVA"><small>IVA</small></button>
                           <button class="btn btn-sm btn-light border py-0 px-2" onclick="changeQty('${x.id}', -1)">-</button>
                           <span class="fw-bold small">${x.cantidad || 1}</span>
                           <button class="btn btn-sm btn-light border py-0 px-2" onclick="changeQty('${x.id}', 1)">+</button>
                       </div>
                   </div>`;
               });
               listContainer.innerHTML = html;
           }
       }

       var rowDesc = parent.querySelector('#row-descuento');
       var resDescVal = parent.querySelector('#res-desc-val');
       if(descuentoDineroTotal > 0 && !tieneTarget) {
           if(rowDesc) { rowDesc.style.display = 'block'; if(resDescVal) resDescVal.innerText = "- " + COP.format(descuentoDineroTotal); }
       } else {
           if(rowDesc) rowDesc.style.display = 'none';
       }

       var pInpInicial = parent.querySelector('#c-inicial');
       if(!isTypingInicial || parent === activeParent) {
           if(pInpInicial) pInpInicial.value = inicial; 
       }

       var rowCred = parent.querySelectorAll('#row-cred'); 
       var totalText = parent.querySelectorAll('#res-cont');
       var inputTotal = parent.querySelector('#res-cont-input');

       if(metodo === "Crédito") {
           totalText.forEach(e => { e.innerText = COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
           if(CART.length === 0) { if(inputTotal) inputTotal.style.display = 'inline-block'; } else { if(inputTotal) inputTotal.style.display = 'none'; }

           rowCred.forEach(e => { 
               e.style.display = 'block'; 
               if(e.querySelector('#res-ini')) e.querySelector('#res-ini').innerText = COP.format(Math.round(inicial)); 
               if(e.querySelector('#res-cuota-val')) e.querySelector('#res-cuota-val').innerText = COP.format(Math.round(valorCuota)); 
               if(e.querySelector('#res-cuota-txt')) e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} mes(es)`; 
           });
           
           if (pInpInicial) {
               pInpInicial.style.display='block'; 
               pInpInicial.disabled = false;
               pInpInicial.style.background = '#fff';
           }
       } else { 
           totalText.forEach(e => { e.innerText = COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
           if (CART.length === 0) {
               if(inputTotal) inputTotal.style.display = 'inline-block';
               if(isManual) totalText.forEach(e => e.style.display = 'none');
           } else { if(inputTotal) inputTotal.style.display = 'none'; }
           
           rowCred.forEach(e => e.style.display = 'none'); 
           if(pInpInicial) pInpInicial.style.display='none'; 
       }
   });
}

function guardarCotizacionActual() {
    var desktopCart = document.getElementById('desktop-cart-container');
    var mobileCart = document.getElementById('mobile-cart');
    
    var cliDesktop = desktopCart ? desktopCart.querySelector('#c-cliente').value : "";
    var cliMobile = mobileCart ? mobileCart.querySelector('#c-cliente').value : "";
    var cli = cliDesktop || cliMobile;
    
    if(!cli) return alert("Falta Cliente para guardar la cotización");
    
    var parent = (window.innerWidth < 992 && mobileCart && mobileCart.classList.contains('visible')) ? mobileCart : desktopCart;
    if(!parent) return;
    if(CART.length === 0 && !parent.querySelector('#c-concepto').value && calculatedValues.total <= 0) return alert("El carrito está vacío");

    var idGenerado = parent.getAttribute('data-cotizacion-id') || ('COT-' + Date.now());

    var paquete = {
        id: idGenerado,
        fecha: parent.querySelector('#c-fecha').value || new Date().toISOString().split('T')[0],
        cliente: cli,
        nit: parent.querySelector('#c-nit') ? parent.querySelector('#c-nit').value : '',
        tel: parent.querySelector('#c-tel') ? parent.querySelector('#c-tel').value : '',
        metodo: parent.querySelector('#c-metodo').value,
        cuotas: parent.querySelector('#c-cuotas').value,
        iva: parent.querySelector('#c-iva').checked,
        manual: parent.querySelector('#c-manual').checked,
        util: parent.querySelector('#c-util').value,
        desc: parent.querySelector('#c-desc').value,
        int: parent.querySelector('#c-int').value,
        target: parent.querySelector('#c-target').value,
        concepto: parent.querySelector('#c-concepto').value,
        cart: JSON.parse(JSON.stringify(CART)),
        total: calculatedValues.total
    };

    var idx = D.cotizaciones.findIndex(x => x.id === idGenerado);
    if(idx > -1) { D.cotizaciones[idx] = paquete; } 
    else { D.cotizaciones.unshift(paquete); }

    showToast("Cotización guardada exitosamente", "success");
    clearCart();
    callAPI('guardarCotizacion', paquete);
}

function abrirModalCotizaciones() {
    renderCotizaciones();
    if(myModalCotizaciones) myModalCotizaciones.show();
}

function renderCotizaciones() {
    var c = document.getElementById('cotizaciones-list');
    if(!c) return;
    c.innerHTML = '';
    var activas = D.cotizaciones.filter(x => x.estado !== 'Facturada');
    
    if(activas.length === 0) {
        c.innerHTML = '<div class="text-center text-muted p-4">No hay cotizaciones pendientes</div>';
        return;
    }
    
    activas.forEach(cot => {
        var html = `
        <div class="card-k mb-2 border-start border-4 border-info bg-white shadow-sm p-3">
            <div class="d-flex justify-content-between align-items-center">
                <div style="flex:1; min-width:0;">
                    <strong class="text-primary text-truncate d-block">${cot.cliente}</strong>
                    <small class="text-muted d-block">${cot.fecha} | Total: <strong class="text-dark">${COP.format(cot.total)}</strong></small>
                    <small class="text-secondary">${cot.cart.length} Item(s) | ${cot.metodo}</small>
                </div>
                <div class="d-flex flex-column gap-2 ms-2">
                    <button class="btn btn-sm btn-primary fw-bold" onclick="cargarCotizacion('${cot.id}')">✏️ Retomar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarCotizacion('${cot.id}')">🗑️ Eliminar</button>
                </div>
            </div>
        </div>`;
        c.innerHTML += html;
    });
}

function cargarCotizacion(id) {
    var cot = D.cotizaciones.find(x => x.id === id);
    if(!cot) return;
    
    CART = JSON.parse(JSON.stringify(cot.cart));
    
    var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
    panels.forEach(parent => {
        if(!parent) return;
        if(parent.querySelector('#c-cliente')) parent.querySelector('#c-cliente').value = cot.cliente || '';
        if(parent.querySelector('#c-nit')) parent.querySelector('#c-nit').value = cot.nit || '';
        if(parent.querySelector('#c-tel')) parent.querySelector('#c-tel').value = cot.tel || '';
        if(parent.querySelector('#c-fecha')) parent.querySelector('#c-fecha').value = cot.fecha || '';
        if(parent.querySelector('#c-metodo')) parent.querySelector('#c-metodo').value = cot.metodo || 'Contado';
        if(parent.querySelector('#c-cuotas')) parent.querySelector('#c-cuotas').value = cot.cuotas || 1;
        if(parent.querySelector('#c-iva')) parent.querySelector('#c-iva').checked = cot.iva || false;
        if(parent.querySelector('#c-manual')) parent.querySelector('#c-manual').checked = cot.manual || false;
        if(parent.querySelector('#c-util')) parent.querySelector('#c-util').value = cot.util || 30;
        if(parent.querySelector('#c-desc')) parent.querySelector('#c-desc').value = cot.desc || 0;
        if(parent.querySelector('#c-int')) parent.querySelector('#c-int').value = cot.int || 5;
        if(parent.querySelector('#c-target')) parent.querySelector('#c-target').value = cot.target || '';
        if(parent.querySelector('#c-concepto')) parent.querySelector('#c-concepto').value = cot.concepto || '';
        
        parent.setAttribute('data-cotizacion-id', id);
    });
    
    if(myModalCotizaciones) myModalCotizaciones.hide();
    showToast("Cotización cargada al carrito", "info");
    updateCartUI(true);
}

function eliminarCotizacion(id) {
    if(!confirm("¿Eliminar esta cotización permanentemente?")) return;
    D.cotizaciones = D.cotizaciones.filter(x => x.id !== id);
    renderCotizaciones();
    callAPI('eliminarCotizacion', id);
}

function toggleMobileCart() { 
    var mc = document.getElementById('mobile-cart');
    if(mc) {
        mc.classList.toggle('visible'); 
        updateCartUI(true);
    }
}

function toggleIni() { 
    var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart') && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    if(!parent) return;
    var metodo = parent.querySelector('#c-metodo').value;
    if(metodo !== "Crédito") { usuarioForzoInicial = false; } 
    calcCart(); 
}

function clearCart() { 
    CART=[]; 
    usuarioForzoInicial = false;
    
    var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
    panels.forEach(parent => {
        if(!parent) return;
        var inpInicial = parent.querySelector('#c-inicial');
        if(inpInicial) inpInicial.value = '';
        var inpDesc = parent.querySelector('#c-desc');
        if(inpDesc) inpDesc.value = '0';
        var inpConcepto = parent.querySelector('#c-concepto');
        if(inpConcepto) inpConcepto.value = '';
        
        parent.removeAttribute('data-cotizacion-id');
    });
    
    renderPos(); 
    updateCartUI(); 
}

function embellecerDescripcion(texto) {
    if (!texto) return "";
    var lineas = texto.split('\n');
    var bonitas = lineas.map(l => {
        var tl = l.trim();
        if(!tl) return "";
        if(tl.startsWith('-') || tl.startsWith('🔹') || tl.startsWith('•') || tl.startsWith('*')) {
            return "• " + tl.replace(/^[-•*🔹]\s*/, '');
        }
        return "• " + tl;
    }).filter(l => l !== "").join('\n');
    return bonitas;
}

async function shareQuote() {
    var desktopCart = document.getElementById('desktop-cart-container');
    var mobileCart = document.getElementById('mobile-cart');
    var isMobile = window.innerWidth < 992 && mobileCart && mobileCart.classList.contains('visible');
    var parent = isMobile ? mobileCart : desktopCart;
    if(!parent) parent = desktopCart;

    var cli = parent.querySelector('#c-cliente').value || "Cliente";
    var concepto = "";
    var incDesc = parent.querySelector('#c-incluir-desc') ? parent.querySelector('#c-incluir-desc').checked : false;
    
    var total = calculatedValues.total;
    var metodo = parent.querySelector('#c-metodo').value;
    
    var msg = `👑 *KING'S SHOP SAS*\n\n`;
    msg += `Hola *${cli.trim()}*, esta es tu cotización:\n\n`;
    
    var fileToShare = null;
    var hasImage = false;
    var firstImgUrl = "";

    if (incDesc && CART.length > 0) {
        CART.forEach(x => {
            var p = D.inv.find(inv => inv.id === x.id); 
            var desc = p ? p.desc : (x.desc || "");
            var foto = p ? p.foto : (x.foto || "");
            var fixedUrl = fixDriveLink(foto);
            
            if (fixedUrl && fixedUrl.length > 10 && !firstImgUrl) {
                firstImgUrl = fixedUrl;
            }
            
            msg += `🛍️ *Producto:* ${x.cantidad}x ${x.nombre.toUpperCase()}\n`;
            var descBonita = embellecerDescripcion(desc);
            if (descBonita) {
                msg += `📋 *Detalles:*\n${descBonita}\n\n`;
            } else {
                msg += `\n`;
            }
        });
        msg += `────────────────\n\n`;

        if (firstImgUrl) {
            var loader = document.getElementById('loader');
            if(loader) loader.style.display = 'flex';
            try {
                fileToShare = await getFileFromUrlAsync(firstImgUrl, 'cotizacion_kingshop');
                if (fileToShare) hasImage = true;
            } catch(e) {
                console.error("Error descargando imagen para cotización", e);
            }
            if(loader) loader.style.display = 'none';
        }
    } else {
        if(CART.length > 0) { 
            concepto = CART.map(x=> `${x.cantidad}x ${x.nombre}`).join(', '); 
        } else { 
            concepto = parent.querySelector('#c-concepto').value || "Varios"; 
        }
        msg += `📦 *Producto(s):* ${concepto}\n\n`;
    }
    
    if(metodo === "Crédito") {
        var inicial = calculatedValues.inicial;
        var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
        var resCuotaVal = parent.querySelector('#res-cuota-val');
        var valorCuota = resCuotaVal ? resCuotaVal.innerText : 0;
        msg += `💳 *Método:* Crédito\n`;
        msg += `💰 *Valor Total (Financiado):* ${COP.format(total)}\n`;
        msg += `• *Inicial:* ${COP.format(inicial)}\n`;
        msg += `📅 *Plan:* ${cuotas} cuotas de *${valorCuota}*\n\n`;
    } else {
        msg += `💵 *Método:* Contado\n`;
        msg += `💰 *Total a Pagar:* ${COP.format(total)}\n\n`;
    }
    
    msg += `🤝 _Quedamos a su entera disposición para procesar su pedido._`;
    
    if (hasImage && navigator.canShare) {
        var shareData = {
            title: "Cotización King's Shop",
            text: msg,
            files: [fileToShare]
        };
        if (navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                showToast("¡Cotización compartida con éxito!", "success");
                return; 
            } catch (err) {
                console.error("Error compartiendo cotización nativamente:", err);
            }
        }
    }

    if (firstImgUrl) {
        msg = msg.replace(`Hola *${cli.trim()}*, esta es tu cotización:\n\n`, `Hola *${cli.trim()}*, esta es tu cotización:\n\n🖼️ *Imagen:* ${firstImgUrl}\n\n`);
    }

    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

function shareProdWhatsApp(id) {
    var p = D.inv.find(x => x.id === id);
    if (!p) return alert("Producto no encontrado");
    var nombre = p.nombre.toUpperCase();
    var precio = p.publico > 0 ? COP.format(p.publico) : 'Consultar';
    var descripcionBonita = embellecerDescripcion(p.desc);
    var linkFoto = fixDriveLink(p.foto); 
    
    var msg = `👑 *KING'S SHOP SAS*\n\n`;
    if(linkFoto && linkFoto.length > 10) { msg += `🖼️ *Imagen:* ${linkFoto}\n\n`; }
    msg += `🛍️ *Producto:* ${nombre}\n`;
    msg += `💳 *Inversión:* ${precio}\n\n`;
    if (descripcionBonita) { msg += `📋 *Detalles:*\n${descripcionBonita}\n\n`; }
    msg += `🤝 _Quedamos a su entera disposición._`; 
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

async function getFileFromUrlAsync(url, defaultName) {
    try {
        if (url.startsWith('data:image')) {
            var arr = url.split(',');
            var mime = arr[0].match(/:(.*?);/)[1];
            var bstr = atob(arr[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], defaultName + ".jpg", {type: mime});
        } else {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            return new File([blob], defaultName + ".jpg", {type: blob.type || "image/jpeg"});
        }
    } catch(e) {
        console.error("Fallo al convertir URL a File:", e);
        return null;
    }
}

async function shareProductNative(id) {
    var loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';
    
    try {
        var p = D.inv.find(x => x.id === id);
        if (!p) {
            if(loader) loader.style.display = 'none';
            return alert("Producto no encontrado");
        }
        
        var nombre = p.nombre.toUpperCase();
        var precio = p.publico > 0 ? COP.format(p.publico) : 'Consultar';
        var desc = embellecerDescripcion(p.desc);
        
        var shareText = `👑 *KING'S SHOP SAS*\n\n🛍️ *Producto:* ${nombre}\n💳 *Inversión:* ${precio}\n\n`;
        if (desc) { shareText += `📋 *Detalles:*\n${desc}\n\n`; }
        shareText += `🤝 _Quedamos a su entera disposición._`;
        
        var shareData = {
            title: nombre,
            text: shareText
        };

        var hasImage = false;
        var fixedUrl = fixDriveLink(p.foto);
        
        if (fixedUrl && fixedUrl.length > 5) {
            var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            var file = await getFileFromUrlAsync(fixedUrl, cleanName);
            if (file) {
                shareData.files = [file];
                hasImage = true;
            }
        }
        
        if(loader) loader.style.display = 'none';

        if (navigator.canShare && navigator.share) {
            if (hasImage && !navigator.canShare({ files: shareData.files })) {
                console.warn("El dispositivo no soporta compartir archivos, se enviará solo texto.");
                delete shareData.files;
            }
            
            await navigator.share(shareData);
            showToast("¡Compartido con éxito!", "success");
        } else {
            alert("Tu navegador no soporta compartir nativamente. Abriendo WhatsApp clásico.");
            shareProdWhatsApp(id);
        }
    } catch(error) {
        if(loader) loader.style.display = 'none';
        console.error("Error compartiendo:", error);
        if (error.name !== 'AbortError') {
            alert("No se pudo compartir el archivo nativamente. Abriendo texto clásico.");
            shareProdWhatsApp(id); 
        } else {
            showToast("Compartir cancelado por el usuario", "info");
        }
    }
}

function finalizarVenta() {
   var desktopCart = document.getElementById('desktop-cart-container');
   var mobileCart = document.getElementById('mobile-cart');
   var isMobile = window.innerWidth < 992 && mobileCart && mobileCart.classList.contains('visible');
   var parent = isMobile ? mobileCart : desktopCart;
   if(!parent) parent = desktopCart;

   var cli = parent.querySelector('#c-cliente').value;
   if(!cli) return alert("Falta Cliente");
   var metodo = parent.querySelector('#c-metodo').value;
   var fechaVal = parent.querySelector('#c-fecha').value;
   var cuotasVal = parseInt(parent.querySelector('#c-cuotas').value)||1;
   
   if(calculatedValues.total <= 0) return alert("Precio 0 no permitido");
   
   var itemsData = [];
   if(CART.length > 0) {
       CART.forEach(p => {
           var qty = p.cantidad || 1;
           var unitPrice = p.precioUnitarioFinal || 0;

           for (var i = 0; i < qty; i++) {
               itemsData.push({ nombre: p.nombre, cat: p.cat, costo: p.costo, precioVenta: unitPrice });
           }
       });
   } else {
       var nombreManual = parent.querySelector('#c-concepto').value || "Venta Manual";
       var costoManual = calculatedValues.base;
       if(costoManual === 0 && calculatedValues.total > 0) {
           costoManual = Math.round(calculatedValues.total / 1.3);
       }
       itemsData.push({ nombre: nombreManual, cat: "General", costo: costoManual, precioVenta: calculatedValues.total });
   }
   
   var idCotiz = parent.getAttribute('data-cotizacion-id');
   var d = { items: itemsData, cliente: cli, metodo: metodo, inicial: (metodo === 'Crédito') ? calculatedValues.inicial : 0, vendedor: currentUserAlias, fechaPersonalizada: fechaVal, cuotas: cuotasVal, idCotizacion: idCotiz };
   
   var btn = parent.querySelector('#btn-vender-main');
   if(btn) { btn.innerText = "Procesando..."; btn.disabled = true; }
   
   callAPI('procesarVentaCarrito', d).then(r => { 
       if(btn) { btn.innerText = "✅ VENDER / FACTURAR"; btn.disabled = false; }
       if(r.exito) { 
           if(r.offline) { 
               alert("Venta guardada OFFLINE. Se subirá cuando haya internet."); 
               clearCart(); 
           } else { 
               showToast("¡Venta Registrada con Éxito!", "success");
               clearCart();
               loadData(true); 
           } 
       } else { 
           alert(r.error); 
       } 
   });
}

function abrirModalProv() { renderProvs(); if(myModalProv) myModalProv.show(); }
function abrirModalNuevo() { 
    document.getElementById('new-id').value=''; 
    document.getElementById('new-file-foto').value = ""; 
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-categoria').value = '';
    document.getElementById('new-proveedor').value = '';
    document.getElementById('new-costo').value = '';
    document.getElementById('new-publico').value = '';
    document.getElementById('new-margen').value = '30';
    document.getElementById('new-desc').value = '';
    document.getElementById('new-web').checked = false;
    document.getElementById('new-cat-web').value = 'tecnologia';
    if(myModalNuevo) myModalNuevo.show(); 
}
function abrirModalWA() { if(myModalWA) myModalWA.show(); }
function abrirModalPed() { if(myModalPed) myModalPed.show(); }

function calcGain(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var margen = idMargen ? (parseFloat(document.getElementById(idMargen).value) || 0) : 30;
    if(costo > 0) { 
        var ganancia = costo * (1 + (margen/100)); 
        document.getElementById(idPublico).value = Math.round(ganancia); 
    }
}

function calcMargen(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var publico = parseFloat(document.getElementById(idPublico).value) || 0;
    if(costo > 0 && publico > 0) { 
        var margen = ((publico / costo) - 1) * 100; 
        document.getElementById(idMargen).value = margen.toFixed(1); 
    }
}

function prepararEdicion(id) {
    var p = D.inv.find(x => x.id === id);
    if (p) { openEdit(p); } else { alert("Producto no encontrado en memoria"); }
}

function openEdit(p) { 
    prodEdit=p; 
    document.getElementById('inp-edit-nombre').value=p.nombre; 
    document.getElementById('inp-edit-categoria').value=p.cat; 
    document.getElementById('inp-edit-costo').value=p.costo; 
    document.getElementById('inp-edit-publico').value=p.publico || 0; 
    
    var m = 30;
    if(p.costo > 0 && p.publico > 0) m = ((p.publico / p.costo) - 1) * 100;
    if(document.getElementById('inp-edit-margen')) document.getElementById('inp-edit-margen').value = m.toFixed(1);

    document.getElementById('inp-edit-proveedor').value=p.prov; 
    document.getElementById('inp-edit-desc').value=p.desc; 
    document.getElementById('inp-edit-web').checked = p.enWeb || false;
    document.getElementById('inp-edit-cat-web').value = p.catWeb || 'tecnologia';
    document.getElementById('inp-file-foto').value = "";
    document.getElementById('img-preview-box').style.display='none'; 
    var fixedUrl = fixDriveLink(p.foto);
    if(fixedUrl){ document.getElementById('img-preview-box').src=fixedUrl; document.getElementById('img-preview-box').style.display='block';} 
    if(myModalEdit) myModalEdit.show(); 
}

function renderProvs() {
    var c = document.getElementById('list-provs'); if(!c) return;
    c.innerHTML='';
    D.proveedores.forEach(p => {
        var waLink = p.tel ? `https://wa.me/57${p.tel.replace(/\D/g,'')}` : '#';
        var btn = p.tel ? `<a href="${waLink}" target="_blank" class="btn-wa-mini"><i class="fab fa-whatsapp"></i></a>` : '<span class="text-muted">-</span>';
        c.innerHTML += `<div class="prov-item"><div><strong>${p.nombre}</strong><br><small class="text-muted">${p.tel||'Sin numero'}</small></div><div class="d-flex gap-2">${btn}<button class="btn btn-sm btn-light border" onclick="editarProv('${p.nombre}')">✏️</button></div></div>`;
    });
}
function guardarProvManual(){ var n = document.getElementById('new-prov-name').value; var t = document.getElementById('new-prov-tel').value; if(!n) return; callAPI('registrarProveedor', {nombre:n, tel:t}).then(r=>{ document.getElementById('new-prov-name').value=''; document.getElementById('new-prov-tel').value=''; loadData(true); }); }
function editarProv(nombre){ var t = prompt("Nuevo teléfono para "+nombre+":"); if(t) { callAPI('registrarProveedor', {nombre:nombre, tel:t}).then(()=>loadData(true)); } }

function renderCartera() {
    var c = document.getElementById('cartera-list');
    var bal = document.getElementById('bal-cartera');
    if(!c) return;
    
    c.innerHTML = '';
    
    var activos = (D.deudores || []).filter(d => d.estado !== 'Castigado');
    var castigados = (D.deudores || []).filter(d => d.estado === 'Castigado');
    
    var totalDeuda = activos.reduce((acc, d) => acc + d.saldo, 0);
    
    if(activos.length === 0) {
        c.innerHTML = '<div class="text-center text-muted p-5">👏 Excelente, no hay deudas pendientes.</div>';
    } else {
        activos.forEach(d => {
            var fechaTxt = d.fechaLimite ? `<small class="text-muted"><i class="far fa-calendar-alt"></i> Vence: ${d.fechaLimite}</small>` : '<small class="text-muted">Sin fecha</small>';
            var planDetalle = "";
            var badgeAdelanto = "";
            
            if (d.fechaLimiteRaw && (d.deudaInicial || 0) <= 0 && d.saldo > 0) {
                var fl = new Date(d.fechaLimiteRaw);
                var hoy = new Date();
                var diffDays = Math.ceil((fl.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 30) {
                    badgeAdelanto = `<span class="badge bg-success mt-1"><i class="fas fa-check-circle"></i> Adelantado</span>`;
                }
            }

            if ((d.deudaInicial || 0) > 0) {
                planDetalle = `<div class="mt-2 p-2 bg-warning border rounded text-dark" style="font-size:0.85rem;"><div class="d-flex justify-content-between fw-bold"><span><i class="fas fa-exclamation-triangle"></i> Faltante Inicial:</span><span>${COP.format(d.deudaInicial)}</span></div></div>`;
            } else {
                var valCuotaReal = parseFloat(d.valCuota) || 0;
                var numCuotas = parseInt(d.cuotas) || 1;
                
                if(valCuotaReal > 0) {
                    var cuotasRestantes = (d.saldo / valCuotaReal).toFixed(1);
                    if(cuotasRestantes.endsWith('.0')) cuotasRestantes = parseInt(cuotasRestantes);
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between"><span>Cuota Fija:</span><strong>${COP.format(valCuotaReal)}</strong></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Restan:</span><span>${cuotasRestantes} Cuotas</span></div></div>`;
                } else if (numCuotas > 1 && d.saldo > 0) {
                    var cuotaEstimada = d.saldo / numCuotas; 
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between text-muted"><span>Plan Original:</span><span>${numCuotas} Cuotas</span></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Cuota Aprox:</span><span>${COP.format(cuotaEstimada)} (Est)</span></div></div>`;
                }
            }

            c.innerHTML += `
            <div class="card-k card-debt">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="min-width: 0; flex: 1; padding-right: 10px;">
                        <h6 class="fw-bold mb-1 text-truncate">${d.cliente}</h6>
                        <small class="text-muted d-block text-truncate">${d.producto}</small>
                        ${fechaTxt}
                    </div>
                    <div class="text-end" style="white-space: nowrap;">
                        <h5 class="fw-bold text-danger m-0">${COP.format(d.saldo)}</h5>
                        <span class="badge-debt d-inline-block mt-1">Pendiente</span><br>
                        ${badgeAdelanto}
                    </div>
                </div>
                <div class="mt-2 d-flex gap-2 flex-wrap justify-content-end border-top pt-2">
                    <button class="btn btn-xs btn-outline-success flex-fill" onclick="notificarCobroWA('${d.idVenta}')" title="Notificar Cobro"><i class="fab fa-whatsapp"></i> Cobrar</button>
                    <button class="btn btn-xs btn-outline-primary flex-fill" onclick="abrirModalRefinanciar('${d.idVenta}', '${d.cliente.replace(/'/g, "\\'")}', ${d.saldo})" title="Refinanciar Deuda">🔄 Refinanciar</button>
                    <button class="btn btn-xs btn-outline-dark flex-fill" onclick="castigarDeuda('${d.idVenta}', '${d.cliente.replace(/'/g, "\\'")}')" title="Castigar Cartera (Lista Negra)">☠️ Castigar</button>
                </div>
                ${planDetalle}
            </div>`;
        });
    }
    
    if (castigados.length > 0) {
        c.innerHTML += `<hr class="my-4"><h6 class="text-muted mb-3"><i class="fas fa-skull-crossbones"></i> Cartera Castigada (${castigados.length})</h6>`;
        castigados.forEach(d => {
             c.innerHTML += `
             <div class="card-k bg-light opacity-75">
                <div class="d-flex justify-content-between">
                    <div><strong>${d.cliente}</strong><br><small>${d.producto}</small></div>
                    <div class="text-end text-muted fw-bold">${COP.format(d.saldo)}<br><small class="badge bg-secondary">Castigado</small></div>
                </div>
             </div>`;
        });
    }
    
    if(bal) bal.innerText = COP.format(totalDeuda);
}

function notificarCobroWA(idVenta) {
    var d = D.deudores.find(x => x.idVenta === idVenta);
    if (!d) return alert("Error: Deuda no encontrada en memoria.");
    
    var msg = `👑 *KING'S SHOP* 👑\n\n`;
    msg += `Hola *${d.cliente.trim()}*, esperamos que estés teniendo un excelente día. 👋\n\n`;
    
    if ((d.deudaInicial || 0) > 0) {
        msg += `Te escribimos para recordarte el saldo pendiente de la *Cuota Inicial* de tu compra:\n\n`;
        msg += `📦 *Producto:* ${d.producto}\n`;
        msg += `⚠️ *Faltante Inicial:* ${COP.format(d.deudaInicial)}\n`;
        msg += `📊 *Saldo Total Pendiente:* ${COP.format(d.saldo)}\n\n`;
        msg += `Por favor, ayúdanos a completar este monto para formalizar tu plan de pagos.\n\n`;
    } else {
        var valCuotaReal = parseFloat(d.valCuota) || 0;
        var numCuotas = parseInt(d.cuotas) || 1;
        var fechaTxt = d.fechaLimite || "Pago Inmediato";
        
        msg += `Te escribimos desde el área de cartera para enviarte el recordatorio de tu pago programado:\n\n`;
        msg += `📦 *Producto:* ${d.producto}\n`;
        
        if (valCuotaReal > 0 && numCuotas > 1) {
            msg += `💳 *Valor de la Cuota:* ${COP.format(valCuotaReal)}\n`;
        }
        
        msg += `📅 *Fecha de Pago:* ${fechaTxt}\n\n`;
        msg += `📊 *Saldo Total Pendiente:* ${COP.format(d.saldo)}\n\n`;
    }
    
    msg += `🏦 *Medios de Pago:*\n`;
    msg += `Puedes realizar tu transferencia a Bancolombia o Nequi.\n\n`;
    msg += `Quedamos atentos a tu comprobante. ¡Gracias por tu puntualidad y preferencia! 🤝`;

    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

function abrirModalRefinanciar(id, cliente, saldo) {
    refEditId = id;
    refSaldoActual = parseFloat(saldo) || 0;
    document.getElementById('ref-cliente').value = cliente;
    document.getElementById('ref-saldo-actual').value = COP.format(refSaldoActual);
    document.getElementById('ref-cargo').value = "0";
    document.getElementById('ref-cuotas').value = "1";
    
    var today = new Date();
    today.setMonth(today.getMonth() + 1);
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('ref-fecha').value = `${yyyy}-${mm}-${dd}`;
    
    calcRefinanciamiento();
    if(myModalRefinanciar) myModalRefinanciar.show();
}

function calcRefinanciamiento() {
    var cargo = parseFloat(document.getElementById('ref-cargo').value) || 0;
    var cuotas = parseInt(document.getElementById('ref-cuotas').value) || 1;
    var nuevoSaldo = refSaldoActual + cargo;
    var nuevaCuota = nuevoSaldo / cuotas;
    
    document.getElementById('ref-nuevo-saldo').innerText = COP.format(nuevoSaldo);
    document.getElementById('ref-nueva-cuota').innerText = COP.format(nuevaCuota) + " / mes";
}

function procesarRefinanciamiento() {
    if(!refEditId) return;
    var cargo = parseFloat(document.getElementById('ref-cargo').value) || 0;
    var cuotas = parseInt(document.getElementById('ref-cuotas').value) || 1;
    var fecha = document.getElementById('ref-fecha').value;
    
    if(!fecha || cuotas < 1) return alert("Verifica las cuotas y la fecha");
    
    var d = {
        idVenta: refEditId,
        cargoAdicional: cargo,
        nuevasCuotas: cuotas,
        nuevaFecha: fecha
    };
    
    var dIdx = D.deudores.findIndex(x => x.idVenta === refEditId);
    if(dIdx > -1) {
        D.deudores[dIdx].saldo += cargo;
        D.deudores[dIdx].valCuota = (D.deudores[dIdx].saldo) / cuotas;
        D.deudores[dIdx].cuotas = cuotas;
        D.deudores[dIdx].fechaLimite = fecha;
    }
    
    if(myModalRefinanciar) myModalRefinanciar.hide();
    renderCartera();
    showToast("Cartera refinanciada (Guardando...)", "success");
    callAPI('refinanciarDeuda', d).then(r => { if(!r.exito) loadData(true); });
}

function castigarDeuda(id, nombre) {
    Swal.fire({
        title: '¿Castigar Cartera?',
        text: `Vas a enviar a "${nombre}" a la lista negra. El bot dejará de cobrarle y la deuda no sumará en activos.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, Castigar'
    }).then((result) => {
        if (result.isConfirmed) {
            var d = D.deudores.find(x => x.idVenta === id);
            if(d) d.estado = 'Castigado';
            renderCartera();
            showToast("Cartera castigada (Guardando...)", "success");
            callAPI('castigarCartera', {idVenta: id}).then(r => { if(!r.exito) loadData(true); });
        }
    });
}

function renderWeb() {
    var q = document.getElementById('web-search').value.toLowerCase().trim();
    var c = document.getElementById('web-list');
    if(!c) return;
    c.innerHTML = '';
    var lista = (D.inv || []).filter(p => p.enWeb === true);
    if(q) { lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q)); }
    if(lista.length === 0) { c.innerHTML = `<div class="text-center text-muted p-5"><div style="font-size:2rem">🌐</div><p>No hay productos en Web.<br>Actívalos desde Inventario.</p></div>`; return; }
    lista.slice(0, 50).forEach(p => {
        var fixedUrl = fixDriveLink(p.foto);
        var img = fixedUrl ? `<img src="${fixedUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:5px;">` : `<div style="width:50px; height:50px; background:#eee; border-radius:5px;">📷</div>`;
        c.innerHTML += `<div class="card-k"><div class="d-flex justify-content-between align-items-center"><div class="d-flex gap-2 align-items-center">${img}<div><strong>${p.nombre}</strong><br><small class="badge bg-primary">${p.catWeb}</small> <small class="text-muted">| ${COP.format(p.publico)}</small></div></div><button class="btn btn-sm btn-outline-danger fw-bold" onclick="toggleWebStatus('${p.id}')">Desactivar</button></div></div>`;
    });
}

function toggleWebStatus(id) {
    var idx = D.inv.findIndex(x => x.id === id);
    if(idx > -1) {
        var p = D.inv[idx];
        p.enWeb = !p.enWeb; 
        renderWeb(); renderInv(); showToast("Producto actualizado", "info");
        var payload = { id: p.id, nombre: p.nombre, categoria: p.cat, proveedor: p.prov, costo: p.costo, publico: p.publico, descripcion: p.desc, urlExistente: p.foto || "", enWeb: p.enWeb, catWeb: p.catWeb };
        callAPI('guardarProductoAvanzado', payload);
    }
}

function renderInv(){ 
    var searchEl = document.getElementById('inv-search');
    var filterEl = document.getElementById('filter-prov');
    var c = document.getElementById('inv-list');
    if(!c) return;

    var q = searchEl ? searchEl.value.toLowerCase().trim() : "";
    var filterProv = filterEl ? filterEl.value : "";
    
    c.innerHTML=''; 
    var lista = D.inv || [];
    if(q) { lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)); }
    if(filterProv) { var fClean = filterProv.trim().toLowerCase(); lista = lista.filter(p => p.prov && String(p.prov).trim().toLowerCase().includes(fClean)); }

    lista.slice(0, 50).forEach(p=>{
        var fixedUrl = fixDriveLink(p.foto);
        var imgHtml = fixedUrl ? `<img src="${fixedUrl}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? COP.format(p.publico) : 'N/A';
        
        var btnAddCart = `<div class="btn-copy-mini text-white" style="background:var(--primary); border-color:var(--primary);" onclick="agregarAlCarritoDesdeInv('${p.id}')" title="Agregar al Carrito"><i class="fas fa-cart-plus"></i></div>`;
        var btnShareNative = `<div class="btn-copy-mini text-white" style="background:#25D366; border-color:#25D366;" onclick="shareProductNative('${p.id}')" title="Compartir Tarjeta Web"><i class="fas fa-share-nodes"></i></div>`;

        var div = document.createElement('div');
        div.className = 'card-catalog';
        div.innerHTML = `<div class="cat-img-box">${imgHtml}<div class="btn-edit-float" onclick="prepararEdicion('${p.id}')"><i class="fas fa-pencil-alt"></i></div></div><div class="cat-body"><div class="cat-title text-truncate" style="white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.nombre}</div><div class="cat-price">${precioDisplay}</div><small class="text-muted" style="font-size:0.7rem;">Costo: ${COP.format(p.costo)}</small></div><div class="cat-actions"><div class="btn-copy-mini" onclick="copyingDato('${p.id}')" title="Copiar ID">ID</div><div class="btn-copy-mini" onclick="copyingDato('${p.nombre.replace(/'/g, "\\'")}')" title="Copiar Nombre">Nom</div><div class="btn-copy-mini" onclick="copyingDato('${p.publico}')" title="Copiar Precio">$$</div>${btnAddCart}${btnShareNative}</div>`;
        c.appendChild(div);
    }); 
}

function copyingDato(txt) {
    if(!txt || txt === 'undefined' || txt === '0') return alert("Dato vacío o no disponible");
    navigator.clipboard.writeText(txt).then(() => { showToast("Copiado: " + txt.substring(0,10) + "..."); });
}

function previewFile(){ var f=document.getElementById('inp-file-foto').files[0]; if(f){var r=new FileReader();r.onload=e=>{document.getElementById('img-preview-box').src=e.target.result;document.getElementById('img-preview-box').style.display='block';};r.readAsDataURL(f);} }

function guardarCambiosAvanzado(){
   if(!prodEdit) return; 
   var newVal = { id: prodEdit.id, nombre: document.getElementById('inp-edit-nombre').value, cat: document.getElementById('inp-edit-categoria').value, prov: document.getElementById('inp-edit-proveedor').value.toUpperCase().trim(), costo: parseFloat(document.getElementById('inp-edit-costo').value), publico: parseFloat(document.getElementById('inp-edit-publico').value), desc: document.getElementById('inp-edit-desc').value, foto: prodEdit.foto || "", enWeb: document.getElementById('inp-edit-web').checked, catWeb: document.getElementById('inp-edit-cat-web').value };
   var f = document.getElementById('inp-file-foto').files[0];
   var promise = Promise.resolve(null);
   if(f) { promise = compressImage(f); }
   promise.then(b64 => {
       var idx = D.inv.findIndex(x => x.id === prodEdit.id);
       if(idx > -1) { if(b64) { newVal.foto = b64; } D.inv[idx] = newVal; }
       renderInv(); renderPos(); if(myModalEdit) myModalEdit.hide(); showToast("Guardando cambios...", "info");
       var payload = { id: newVal.id, nombre: newVal.nombre, categoria: newVal.cat, proveedor: newVal.prov, costo: newVal.costo, publico: newVal.publico, descripcion: newVal.desc, urlExistente: prodEdit.foto || "", enWeb: newVal.enWeb, catWeb: newVal.catWeb };
       if(b64) { payload.imagenBase64 = b64.split(',')[1]; payload.mimeType = f.type; payload.nombreArchivo = f.name; }
       callAPI('guardarProductoAvanzado', payload).then(r => { if(r.exito) { showToast("¡Guardado exitoso!", "success"); } else { showToast("Error guardando: " + r.error, "danger"); } });
   });
}

function eliminarProductoActual(){ if(confirm("Eliminar?")){ callAPI('eliminarProductoBackend', {id: prodEdit.id}).then(r=>{if(r.exito)location.reload()}); } }
function generarIDAuto(){ var c=document.getElementById('new-categoria').value; if(c)document.getElementById('new-id').value=c.substring(0,3).toUpperCase()+'-'+Math.floor(Math.random()*9999); }

function crearProducto(){ 
    var d={ nombre:document.getElementById('new-nombre').value, categoria:document.getElementById('new-categoria').value, proveedor:document.getElementById('new-proveedor').value.toUpperCase().trim(), costo: parseFloat(document.getElementById('new-costo').value), publico: parseFloat(document.getElementById('new-publico').value), descripcion: document.getElementById('new-desc').value, enWeb: document.getElementById('new-web').checked, catWeb: document.getElementById('new-cat-web').value, id:document.getElementById('new-id').value||'GEN-'+Math.random() }; 
    var f = document.getElementById('new-file-foto').files[0];
    var promise = Promise.resolve(null);
    if(f) { promise = compressImage(f); }
    promise.then(b64 => {
        var localProd = { id: d.id, nombre: d.nombre, cat: d.categoria, prov: d.proveedor, costo: d.costo, publico: d.publico, desc: d.descripcion, foto: b64 || "", enWeb: d.enWeb, catWeb: d.catWeb };
        D.inv.unshift(localProd); renderInv(); if(myModalNuevo) myModalNuevo.hide(); showToast("Creando producto...", "info");
        if(b64) { d.imagenBase64 = b64.split(',')[1]; d.mimeType = f.type; d.nombreArchivo = f.name; }
        callAPI('crearProductoManual', d).then(r=>{ if(r.exito){ showToast("Producto sincronizado", "success"); } else { showToast("Error al crear en servidor", "danger"); } });
    });
}

function procesarWA(){ var p=document.getElementById('wa-prov').value,c=document.getElementById('wa-cat').value,t=document.getElementById('wa-text').value; if(!c||!t)return alert("Falta datos"); var btn=document.querySelector('#modalWA .btn-success'); btn.innerText="Procesando..."; btn.disabled=true; callAPI('procesarImportacionDirecta', {prov:p, cat:c, txt:t}).then(r=>{alert(r.mensaje||r.error);location.reload()}); }

function verificarBanco() {
    var real = parseFloat(document.getElementById('audit-banco').value) || 0;
    var sys = (D.metricas && D.metricas.saldo) ? D.metricas.saldo : 0;
    var diff = sys - real;
    var el = document.getElementById('audit-res');
    if(Math.abs(diff) < 1) { el.innerHTML = '<span class="badge bg-success">✅ Perfecto</span>'; } else { el.innerHTML = `<span class="badge bg-danger">❌ Desfase: ${COP.format(diff)}</span>`; }
}

function doIngresoExtra() {
    var desc = document.getElementById('inc-desc').value;
    var cat = document.getElementById('inc-cat').value;
    var monto = document.getElementById('inc-monto').value;
    if(!desc || !monto) return alert("Falta descripción o monto");
    
    var acreedor = "";
    var fechaLimite = "";
    if (cat === 'Prestamo') {
        acreedor = document.getElementById('inc-acreedor').value;
        fechaLimite = document.getElementById('inc-fecha-limite').value;
        if(!acreedor || !fechaLimite) return alert("Los datos del préstamo (Acreedor y Fecha) son obligatorios");
    }
    
    var ingresoNum = parseFloat(monto) || 0;
    if(D.metricas) D.metricas.saldo += ingresoNum;
    D.historial.unshift({ desc: "Ingreso Extra: " + desc, tipo: "ingresos", monto: ingresoNum, fecha: new Date().toISOString().split('T')[0], _originalIndex: D.historial.length, saldo: D.metricas.saldo });
    
    if (cat === 'Prestamo') {
         D.pasivos.push({
             id: "PAS-" + Date.now(), acreedor: acreedor, monto: ingresoNum, saldo: ingresoNum, fechaLimite: fechaLimite
         });
         renderPasivos();
    }
    
    document.getElementById('inc-desc').value = '';
    document.getElementById('inc-monto').value = '';
    
    var elAcreedor = document.getElementById('inc-acreedor');
    var elFechaLim = document.getElementById('inc-fecha-limite');
    var elBox = document.getElementById('box-prestamo');
    if(elAcreedor) elAcreedor.value = '';
    if(elFechaLim) elFechaLim.value = '';
    if(elBox) elBox.style.display = 'none';
    document.getElementById('inc-cat').value = 'Venta Externa';
    
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && D.metricas) bCaja.innerText = COP.format(D.metricas.saldo||0);
    showToast("Ingreso registrado", "success");
    
    callAPI('registrarIngresoExtra', { desc: desc, cat: cat, monto: monto, acreedor: acreedor, fechaLimite: fechaLimite });
}

function doGasto() {
    var desc = document.getElementById('g-desc').value;
    var monto = document.getElementById('g-monto').value;
    var vinculoRaw = document.getElementById('g-vinculo').value; 
    
    if(!desc || !monto) return alert("Falta descripción o monto");

    var vinculoClean = "";
    var match = vinculoRaw.match(/\[(.*?)\]$/); 
    if (match && match[1]) {
        vinculoClean = match[1];
    } else {
        vinculoClean = vinculoRaw; 
    }

    var d = { 
        desc: desc, 
        cat: document.getElementById('g-cat').value, 
        monto: monto, 
        vinculo: vinculoClean 
    };

    var gastoNum = parseFloat(monto) || 0;
    if(D.metricas) D.metricas.saldo -= gastoNum;
    D.historial.unshift({ desc: "Gasto: " + desc, tipo: "egreso", monto: gastoNum, fecha: new Date().toISOString().split('T')[0], _originalIndex: D.historial.length, saldo: D.metricas.saldo });

    document.getElementById('g-desc').value = '';
    document.getElementById('g-monto').value = '';
    document.getElementById('g-vinculo').value = '';
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && D.metricas) bCaja.innerText = COP.format(D.metricas.saldo||0);
    showToast("Gasto registrado", "success");

    callAPI('registrarGasto', d);
}

function renderFin(){ 
  var s=document.getElementById('ab-cli'); s.innerHTML='<option value="">Seleccione...</option>'; 
  (D.deudores || []).filter(d => d.estado !== 'Castigado').forEach(d=>{ s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${COP.format(d.saldo)})</option>`; });
  
  var today = new Date().toISOString().split('T')[0];
  var elFecha = document.getElementById('ab-fecha');
  if(elFecha) elFecha.value = today;

  var elSearch = document.getElementById('hist-search');
  var q = elSearch ? elSearch.value.toLowerCase() : "";
  var h=document.getElementById('hist-list'); 
  if(!h) return;
  h.innerHTML=''; 
  var dataHist = D.historial || []; 
  
  dataHist.forEach((x, originalIndex) => {
      x._originalIndex = originalIndex;
  });

  if(q) {
      dataHist = dataHist.filter(x => (x.desc && x.desc.toLowerCase().includes(q)) || (x.monto && x.monto.toString().includes(q)));
  }

  if(dataHist.length === 0) { h.innerHTML = '<div class="text-center text-muted p-3">Sin movimientos registrados.</div>'; } 
  else { 
    dataHist.forEach((x)=>{ 
        var i=(x.tipo.includes('ingreso')||x.tipo.includes('abono')); 
        var btnEdit = `<button class="btn btn-sm btn-light border-0 text-muted ms-2" onclick='abrirEditMov(${x._originalIndex})'><i class="fas fa-pencil-alt"></i></button>`;
        var saldoMoment = (x.saldo !== undefined) ? `<small class="text-muted d-block" style="font-size:0.7rem;">Saldo: ${COP.format(x.saldo)}</small>` : '';
        h.innerHTML+=`<div class="mov-item d-flex align-items-center mb-2 p-2 border-bottom"><div class="mov-icon me-3 ${i?'text-success':'text-danger'}"><i class="fas fa-${i?'arrow-down':'arrow-up'}"></i></div><div class="flex-grow-1 lh-1"><div class="fw-bold small">${x.desc}</div><small class="text-muted" style="font-size:0.75rem">${x.fecha}</small></div><div class="text-end"><div class="fw-bold ${i?'text-success':'text-danger'}">${i?'+':'-'} ${COP.format(x.monto)}</div>${saldoMoment}</div>${btnEdit}</div>`; 
    }); 
  }
}

function abrirEditMov(index) {
    if (!D.historial[index]) return;
    movEditObj = D.historial[index]; 
    document.getElementById('ed-mov-desc').value = movEditObj.desc;
    document.getElementById('ed-mov-monto').value = movEditObj.monto;
    var elJust = document.getElementById('ed-mov-justificacion');
    if(elJust) elJust.value = ""; 
    var fechaRaw = movEditObj.fecha;
    var fechaIso = "";
    if(fechaRaw.includes('/')) { var parts = fechaRaw.split('/'); if(parts.length === 3) fechaIso = `${parts[2]}-${parts[1]}-${parts[0]}`; } else { fechaIso = fechaRaw.split(' ')[0]; }
    document.getElementById('ed-mov-fecha').value = fechaIso;
    if(myModalEditMov) myModalEditMov.show();
}

function guardarEdicionMovimiento() {
    if(!movEditObj) return;
    var nuevaFecha = document.getElementById('ed-mov-fecha').value;
    var nuevoMonto = document.getElementById('ed-mov-monto').value;
    var elJust = document.getElementById('ed-mov-justificacion');
    var justificacion = elJust ? elJust.value.trim() : "Corrección";
    
    if(!nuevaFecha || !nuevoMonto) return alert("Fecha y monto requeridos");
    if(elJust && justificacion.length < 5) return alert("⚠️ Debe escribir una justificación válida para alterar la caja.");
    
    var originalClone = Object.assign({}, movEditObj);
    var payload = { original: originalClone, fecha: nuevaFecha, monto: nuevoMonto, justificacion: justificacion };
    
    movEditObj.fecha = nuevaFecha;
    movEditObj.monto = nuevoMonto;
    
    if(myModalEditMov) myModalEditMov.hide();
    renderFin();
    showToast("Movimiento actualizado (Guardando...)", "success");
    callAPI('editarMovimiento', payload).then(r => { if(!r.exito) { alert("Error al editar: " + r.error); loadData(true); } });
}

function doAbono(){
    var id=document.getElementById('ab-cli').value;
    if(!id)return alert("Seleccione un cliente");
    var txt=document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text;
    var cli=txt.split(' - ')[0].trim();
    var monto = document.getElementById('ab-monto').value;
    var fechaVal = document.getElementById('ab-fecha').value;
    
    var abonoNum = parseFloat(monto) || 0;
    if(D.metricas) D.metricas.saldo += abonoNum;
    
    var dIndex = D.deudores.findIndex(x => x.idVenta === id);
    if(dIndex > -1) {
        D.deudores[dIndex].saldo -= abonoNum;
        if(D.deudores[dIndex].saldo < 0) D.deudores[dIndex].saldo = 0;
        if(D.deudores[dIndex].saldo <= 100) {
            D.deudores[dIndex].estado = 'Pagado';
        }
    }
    
    D.historial.unshift({ desc: "Abono: " + cli, tipo: "abono", monto: abonoNum, fecha: fechaVal || new Date().toISOString().split('T')[0], _originalIndex: D.historial.length, saldo: D.metricas.saldo });
    
    document.getElementById('ab-monto').value = '';
    renderCartera();
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && D.metricas) bCaja.innerText = COP.format(D.metricas.saldo||0);
    showToast("Abono registrado", "success");
    
    callAPI('registrarAbono', {idVenta:id, monto:monto, cliente:cli, fecha: fechaVal});
}

function renderPed(){ var c=document.getElementById('ped-list'); if(!c) return; c.innerHTML=''; (D.ped || []).forEach(p=>{ var isPend = p.estado === 'Pendiente'; var badge = isPend ? `<span class="badge bg-warning text-dark">${p.estado}</span>` : `<span class="badge bg-success">${p.estado}</span>`; var controls = `<div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-outline-secondary flex-fill" onclick='openEditPed(${JSON.stringify(p)})'>✏️</button><button class="btn btn-sm btn-outline-danger flex-fill" onclick="delPed('${p.id}')">🗑️</button>${isPend ? `<button class="btn btn-sm btn-outline-success flex-fill" onclick="comprarPedido('${p.id}', '${p.prod.replace(/'/g, "\\'")}')">✅</button>` : ''}</div>`; c.innerHTML+=`<div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}"><div class="d-flex justify-content-between"><div><strong>${p.prod}</strong><br><small class="text-muted">${p.prov || 'Sin Prov.'}</small></div><div class="text-end"><small>${p.fecha}</small><br>${badge}</div></div>${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}${controls}</div>`; }); }
function savePed(){ var p=document.getElementById('pe-prod').value; if(!p) return alert("Escribe un producto"); var d = { user: currentUserAlias, prod: p, prov: document.getElementById('pe-prov').value, costoEst: document.getElementById('pe-costo').value, notas: document.getElementById('pe-nota').value }; callAPI('guardarPedido', d).then(()=>loadData(true)); showToast("Pedido guardado", "success"); }
function openEditPed(p) { pedEditId = p.id; document.getElementById('ed-ped-prod').value = p.prod; document.getElementById('ed-ped-prov').value = p.prov; document.getElementById('ed-ped-costo').value = p.costo; document.getElementById('ed-ped-nota').value = p.notas; if(myModalEditPed) myModalEditPed.show(); }
function guardarEdicionPed() { if(!pedEditId) return; var d = { id: pedEditId, prod: document.getElementById('ed-ped-prod').value, prov: document.getElementById('ed-ped-prov').value, costoEst: document.getElementById('ed-ped-costo').value, notas: document.getElementById('ed-ped-nota').value }; if(myModalEditPed) myModalEditPed.hide(); showToast("Editando pedido...", "info"); callAPI('editarPedido', d).then(r => { if(r.exito) loadData(true); else { alert(r.error); } }); }
function delPed(id) { 
    Swal.fire({ 
        title: '¿Eliminar Pedido?', 
        text: "Justifica por qué lo vas a eliminar (Ej: Ya no se necesita):", 
        input: 'text',
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'Sí, eliminar',
        preConfirm: (justificacion) => {
            if (!justificacion || justificacion.length < 4) {
                Swal.showValidationMessage('⚠️ Escribe una justificación válida');
            }
            return justificacion;
        }
    }).then((result) => { 
        if (result.isConfirmed) { 
            showToast("Eliminando...", "info"); 
            callAPI('eliminarPedido', {id: id, justificacion: result.value}).then(r => { if(r.exito) loadData(true); else { alert(r.error); } }); 
        } 
    }); 
}
function comprarPedido(id, nombreProd) { Swal.fire({ title: 'Confirmar Compra', text: `¿Ya compraste "${nombreProd}"? Ingresa el costo REAL final.`, input: 'number', inputLabel: 'Costo Real de Compra', inputPlaceholder: 'Ej: 50000', showCancelButton: true, confirmButtonText: 'Sí, Registrar Gasto e Inventario', cancelButtonText: 'Cancelar', inputValidator: (value) => { if (!value || value <= 0) return 'Debes ingresar un costo válido.'; } }).then((result) => { if (result.isConfirmed) { showToast("Procesando compra...", "info"); callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => { if(r.exito) { Swal.fire('¡Éxito!', 'Gasto registrado e inventario actualizado.', 'success').then(() => loadData(true)); } else { alert(r.error); } }); } }); }

function verBancos() {
    const msg = `👑 ¡Hola! Gracias por elegir KINGS SHOP SAS 🛒\n\nPara procesar tu pedido, por favor realiza el pago mediante transferencia. Aquí tienes nuestros datos bancarios:\n\n🏦 Banco: Bancolombia\n💳 Tipo de cuenta: Ahorro\n🔢 No Cuenta: 767-000051-51\n🔢 Llave: 0090894825\n👤 Titular: KINGS SHOP SAS\n📄 NIT: 901866162-1\n\n📲 Importante: Una vez realizada la transacción, por favor envíanos una foto o captura del comprobante por este chat. Esto nos permite verificar el pago y programar tu envío de inmediato. 📦🚀\n\nQuedamos atentos a tu confirmación. ¡Gracias por tu confianza! 🤝`;
    
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
                showToast("Datos de pago copiados al portapapeles", "success");
            });
        }
    });
}

function toggleDatosFormales() {
    var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
    panels.forEach(parent => {
        if(!parent) return;
        var box = parent.querySelector('#box-datos-formales');
        if(box) {
            if(box.style.display === 'none') { box.style.display = 'block'; } else { box.style.display = 'none'; }
        }
    });
}

function generarCotizacionPDF() {
   var desktopCart = document.getElementById('desktop-cart-container');
   var mobileCart = document.getElementById('mobile-cart');
   var isMobile = window.innerWidth < 992 && mobileCart && mobileCart.classList.contains('visible');
   var parent = isMobile ? mobileCart : desktopCart;
   if(!parent) parent = desktopCart;

   var cli = parent.querySelector('#c-cliente').value;

   if(!cli) return alert("Falta el Nombre del Cliente para la cotización");
   
   var nit = parent.querySelector('#c-nit') ? parent.querySelector('#c-nit').value : '';
   var tel = parent.querySelector('#c-tel') ? parent.querySelector('#c-tel').value : '';
   var conIvaGlobal = parent.querySelector('#c-iva').checked;
   var utilGlobal = parseFloat(parent.querySelector('#c-util').value)||0; 
   var descuentoGlobalPrc = parseFloat(parent.querySelector('#c-desc').value)||0; 
   var targetVal = parseFloat(parent.querySelector('#c-target').value);
   var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   var metodo = parent.querySelector('#c-metodo').value;
   var tasaMensual = parseFloat(parent.querySelector('#c-int').value)||0;
   var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
   
   if(calculatedValues.total <= 0 && calculatedValues.base <= 0) return alert("El precio total no puede ser 0");
   
   var itemsData = [];
   var ivaTotalCotizacion = 0;
   var subtotalBaseCotizacion = 0;
   var descuentoTotalCotizacion = 0; 

   if(CART.length > 0) {
       CART.forEach(p => {
           var qty = p.cantidad || 1;
           
           if (tieneTarget) {
               var unitPrice = p.precioUnitarioFinal || 0;
               var totalItem = unitPrice * qty;
               subtotalBaseCotizacion += totalItem;
               itemsData.push({ 
                   nombre: p.nombre, 
                   descripcion: p.desc ? p.desc : p.cat,
                   cantidad: qty, 
                   valorUnitarioBase: unitPrice, 
                   descuentoPrc: 0,
                   descuentoUnitario: 0,
                   valorUnitarioFinal: unitPrice,
                   total: totalItem,
                   conIva: false
               });
           } else if (p.manual) {
               var unitPrice = p.precioUnitarioFinal || 0;
               var totalItem = unitPrice * qty;
               subtotalBaseCotizacion += totalItem;
               itemsData.push({ 
                   nombre: p.nombre, 
                   descripcion: "Servicio / Ítem Manual",
                   cantidad: qty, 
                   valorUnitarioBase: unitPrice, 
                   descuentoPrc: 0,
                   descuentoUnitario: 0,
                   valorUnitarioFinal: unitPrice,
                   total: totalItem,
                   conIva: false
               });
           } else {
               var c = p.costo || 0;
               var m = p.modificadoManualmente ? p.margenIndividual : utilGlobal;
               
               var unitBase = c * (1 + m/100);
               var totalBase = unitBase * qty;
               
               var dPrc = descuentoGlobalPrc > 0 ? descuentoGlobalPrc : (p.descuentoIndividual || 0);
               var descUnitario = unitBase * (dPrc / 100);
               var totalDescItem = descUnitario * qty;
               
               subtotalBaseCotizacion += totalBase;
               descuentoTotalCotizacion += totalDescItem;
               
               var postDesc = totalBase - totalDescItem;
               if (postDesc < 0) postDesc = 0;
               
               var itemIva = 0;
               if (p.conIva || conIvaGlobal) {
                   itemIva = postDesc * 0.19; 
               }
               ivaTotalCotizacion += itemIva;
               
               itemsData.push({ 
                   nombre: p.nombre, 
                   descripcion: p.desc ? p.desc : p.cat,
                   cantidad: qty, 
                   valorUnitarioBase: unitBase, 
                   descuentoPrc: dPrc,
                   descuentoUnitario: descUnitario,
                   valorUnitarioFinal: (postDesc / qty),
                   total: postDesc,
                   conIva: p.conIva || conIvaGlobal
               });
           }
       });
   } else {
       var resContInput = parent.querySelector('#res-cont-input');
       var manualVal = resContInput ? parseFloat(resContInput.value) : 0;
       if (tieneTarget) manualVal = targetVal;
       
       var dPrc = tieneTarget ? 0 : descuentoGlobalPrc;
       var descuentoDinero = manualVal * (dPrc / 100);
       
       descuentoTotalCotizacion = descuentoDinero;
       subtotalBaseCotizacion = manualVal;
       
       var postDesc = manualVal - descuentoDinero;
       if(postDesc < 0) postDesc = 0;
       
       if (conIvaGlobal && !tieneTarget) {
           ivaTotalCotizacion = postDesc * 0.19;
       }
       
       itemsData.push({ 
           nombre: parent.querySelector('#c-concepto').value || "Venta Manual", 
           descripcion: "Servicio / Ítem Manual", 
           cantidad: 1, 
           valorUnitarioBase: manualVal,
           descuentoPrc: dPrc,
           descuentoUnitario: descuentoDinero,
           valorUnitarioFinal: postDesc,
           total: postDesc,
           conIva: conIvaGlobal && !tieneTarget
       });
   }
   
   var interesAplicado = 0;
   if (metodo === "Crédito" && !tieneTarget) {
       var preTotal = subtotalBaseCotizacion - descuentoTotalCotizacion + ivaTotalCotizacion;
       var iniTemp = preTotal * 0.30;
       var saldoTemp = preTotal - iniTemp;
       interesAplicado = saldoTemp * (tasaMensual/100) * cuotas;
       
       if (interesAplicado > 0) {
           itemsData.push({
               nombre: "Intereses de Financiación",
               descripcion: "Costo financiero por pago a crédito (" + cuotas + " cuotas)",
               cantidad: 1,
               valorUnitarioBase: interesAplicado,
               descuentoPrc: 0,
               descuentoUnitario: 0,
               valorUnitarioFinal: interesAplicado,
               total: interesAplicado,
               conIva: false
           });
           subtotalBaseCotizacion += interesAplicado; 
       }
   }

   var fechaVal = parent.querySelector('#c-fecha').value;
   var d = {
       cliente: { nombre: cli, nit: nit, telefono: tel },
       items: itemsData,
       totales: { 
           subtotal: subtotalBaseCotizacion, 
           descuento: descuentoTotalCotizacion,
           iva: ivaTotalCotizacion,
           total: subtotalBaseCotizacion - descuentoTotalCotizacion + ivaTotalCotizacion 
       },
       fecha: fechaVal
   };
   
   document.getElementById('loader').style.display='flex';
   callAPI('generarCotizacionPDF', d).then(r => { 
       document.getElementById('loader').style.display='none';
       if(r.exito) { 
           window.open(r.url, '_blank');
       } else { 
           alert("Error generando PDF: " + r.error); 
       } 
   });
}
