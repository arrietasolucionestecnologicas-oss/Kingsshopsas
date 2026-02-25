// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbzWEqQQTow3irxkTU4Y3CVJshtfjo1s2m1dwSicRihQ42_fArC6L9MAuQoUPUfzzXYS/exec"; 

var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed, myModalEditPed, myModalEditMov, myModalRefinanciar;
var prodEdit = null;
var pedEditId = null; 
var movEditObj = null; 
var refEditId = null;
var refSaldoActual = 0;
var calculatedValues = { total: 0, inicial: 0, base: 0 };

var usuarioForzoInicial = false;

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
        loadData(); 
    } else {
        showToast(`Quedan ${nuevaCola.length} pendientes.`, "warning");
    }
}

// --- TOAST NOTIFICATION SYSTEM ---
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

// --- COMPRESOR DE IMÁGENES ---
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

// --- CALL API INTELIGENTE (OFFLINE AWARE) ---
async function callAPI(action, data = null) {
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
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;

  document.querySelectorAll('#c-inicial').forEach(el => {
      el.removeAttribute('disabled');
      el.style.background = '#fff'; 
      el.oninput = calcCart;        
  });
  
  var lastView = localStorage.getItem('lastView') || 'pos';
  var btn = document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`);
  if(btn) nav(lastView, btn);
  else nav('pos', document.querySelector('.nav-btn'));

  updateOnlineStatus();
  loadData();
};

function loadData(){
  document.getElementById('loader').style.display='flex';
  
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
          showToast("Modo Offline: Datos locales cargados", "warning");
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

    if(res.metricas) {
        document.getElementById('user-display').innerText = res.user || "Offline User";
        document.getElementById('bal-caja').innerText = COP.format(res.metricas.saldo||0);
        document.getElementById('bal-ventas').innerText = COP.format(res.metricas.ventaMes||0);
        document.getElementById('bal-ganancia').innerText = COP.format(res.metricas.gananciaMes||0);
    }
    
    var provSelect = document.getElementById('filter-prov');
    if(provSelect) {
        provSelect.innerHTML = '<option value="">Todos</option>';
        D.proveedores.forEach(p => {
            provSelect.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`;
        });
    }
    
    renderPos(); 
    renderInv(); 
    renderWeb();  
    renderFin(); 
    renderPed();
    renderProvs();
    renderCartera();
    
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
  document.getElementById('view-'+v).style.display='block';
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
  var q = document.getElementById('pos-search').value.toLowerCase().trim();
  var c = document.getElementById('pos-list'); 
  var placeholder = document.getElementById('pos-placeholder');
  c.innerHTML='';
  
  if(!q) { placeholder.style.display = 'block'; return; }
  placeholder.style.display = 'none';

  var lista = D.inv || [];
  var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
  
  if(res.length === 0) { c.innerHTML = '<div class="text-center text-muted py-3">No encontrado</div>'; return; }

  res.slice(0,20).forEach(p => {
    var active = CART.some(x=>x.id===p.id) ? 'active' : '';
    var precioDisplay = p.publico > 0 ? COP.format(p.publico) : `<span class="text-muted small">Costo: ${COP.format(p.costo)}</span>`;
    var descCorto = p.cat + (p.prov ? ` • ${p.prov}` : '');

    var div = document.createElement('div');
    div.className = `pos-row-lite ${active}`;
    div.onclick = function() { toggleCart(p, div); };
    div.innerHTML = `
        <div class="info">
            <div class="name">${p.nombre}</div>
            <div class="meta">${descCorto}</div>
        </div>
        <div class="price">${precioDisplay}</div>
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
       CART.push(item); 
       if(el) el.classList.add('active'); 
   }
   updateCartUI();
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
        manual: true
    });
    updateCartUI(true);
}

function updateCartUI(keepOpen = false) {
   var count = CART.reduce((acc, item) => acc + (item.cantidad || 1), 0);
   
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!parent) parent = document.getElementById('desktop-cart-container');
   
   var btnFloat = document.getElementById('btn-float-cart');
   btnFloat.style.display = count > 0 ? 'block' : 'none';
   btnFloat.innerText = "🛒 " + count;
   
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
       if(!keepOpen) { document.getElementById('mobile-cart').classList.remove('visible'); }
       if(inputConcepto) inputConcepto.style.display = 'block';
       document.querySelectorAll('#cart-items-list').forEach(e => e.style.display = 'none');
   } else {
       if(inputConcepto) { inputConcepto.style.display = 'none'; inputConcepto.value = ''; }
       document.querySelectorAll('#cart-items-list').forEach(e => {
           e.style.display = 'block';
           var html = '';
           CART.forEach(x => {
               var px = x.publico || 0;
               html += `
               <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom">
                   <div class="lh-1" style="flex:1;">
                       <small class="fw-bold" style="color:var(--primary);">${x.nombre}</small><br>
                       <small class="text-muted">${COP.format(px)} c/u</small>
                   </div>
                   <div class="d-flex align-items-center gap-2">
                       <button class="btn btn-sm btn-light border py-0 px-2" onclick="changeQty('${x.id}', -1)">-</button>
                       <span class="fw-bold small">${x.cantidad || 1}</span>
                       <button class="btn btn-sm btn-light border py-0 px-2" onclick="changeQty('${x.id}', 1)">+</button>
                   </div>
               </div>`;
           });
           e.innerHTML = html;
       });
   }
   calcCart();
}

function toggleManual() {
    var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
    var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');

    var isManual = parent.querySelector('#c-manual').checked;
    var inpTotal = parent.querySelector('#res-cont-input');
    var inpUtil = parent.querySelector('#c-util');

    if(isManual) { inpUtil.disabled = true; setTimeout(() => { inpTotal.focus(); }, 100); } else { inpUtil.disabled = false; }
    calcCart();
}

function calcCart() {
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!parent) parent = document.getElementById('desktop-cart-container'); 

   var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
   var metodo = parent.querySelector('#c-metodo').value;
   var conIva = parent.querySelector('#c-iva').checked;
   var isManual = parent.querySelector('#c-manual').checked;
   var util = parseFloat(parent.querySelector('#c-util').value)||0; 
   var tasaMensual = parseFloat(parent.querySelector('#c-int').value)||0; 
   var targetVal = parseFloat(parent.querySelector('#c-target').value);
   var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   var baseParaCalculo = 0;

   if (CART.length > 0) {
       baseParaCalculo = CART.reduce((acc, item) => acc + ((item.costo || 0) * (item.cantidad || 1)), 0);
   } else {
       var manualVal = parseFloat(parent.querySelector('#res-cont-input').value);
       baseParaCalculo = isNaN(manualVal) ? 0 : manualVal;
   }

   var totalFinal = 0;
   if (tieneTarget) {
       totalFinal = targetVal;
       parent.querySelector('#c-int').value = 0;
   } else {
       if (CART.length === 0 && isManual) { 
           totalFinal = baseParaCalculo; 
       } else { 
           totalFinal = baseParaCalculo * (1 + util/100); 
       }
       if(conIva) totalFinal = totalFinal * 1.19;
       if (metodo === "Crédito") {
           var iniTemp = totalFinal * 0.30;
           var saldoTemp = totalFinal - iniTemp;
           var interesTotal = saldoTemp * (tasaMensual/100) * cuotas;
           totalFinal = totalFinal + interesTotal;
       }
   }
   
   calculatedValues.base = baseParaCalculo; 
   calculatedValues.total = totalFinal;

   var inpInicial = parent.querySelector('#c-inicial');
   var activeEl = document.activeElement;
   var isTypingInicial = (activeEl && activeEl.id === 'c-inicial' && parent.contains(activeEl));
   var inicial = 0;
   
   if (isTypingInicial) {
       usuarioForzoInicial = true;
       inicial = parseFloat(inpInicial.value);
       if(isNaN(inicial)) inicial = 0;
   } else if (usuarioForzoInicial && inpInicial.value !== "") {
       inicial = parseFloat(inpInicial.value);
       if(isNaN(inicial)) inicial = 0;
   } else {
       inicial = Math.round(totalFinal * 0.30);
       if(inpInicial) inpInicial.value = inicial; 
   }
   
   calculatedValues.inicial = inicial;

   var rowCred = parent.querySelectorAll('#row-cred'); 
   var totalText = document.querySelectorAll('#res-cont');
   var inputTotal = parent.querySelector('#res-cont-input');

   if(metodo === "Crédito") {
       var saldo = totalFinal - inicial;
       if(saldo < 0) saldo = 0;
       var valorCuota = saldo / cuotas;

       totalText.forEach(e => { e.innerText = COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
       if(CART.length === 0) { inputTotal.style.display = 'inline-block'; } else { inputTotal.style.display = 'none'; }

       rowCred.forEach(e => { 
           e.style.display = 'block'; 
           e.querySelector('#res-ini').innerText = COP.format(Math.round(inicial)); 
           e.querySelector('#res-cuota-val').innerText = COP.format(Math.round(valorCuota)); 
           e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} mes(es)`; 
       });
       
       if (inpInicial) {
           inpInicial.style.display='block'; 
           inpInicial.disabled = false;
           inpInicial.style.background = '#fff';
       }
   } else { 
       calculatedValues.inicial = 0;
       totalText.forEach(e => { e.innerText = COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
       if (CART.length === 0) {
           inputTotal.style.display = 'inline-block';
           if(isManual) totalText.forEach(e => e.style.display = 'none');
       } else { inputTotal.style.display = 'none'; }
       
       rowCred.forEach(e => e.style.display = 'none'); 
       if(inpInicial) inpInicial.style.display='none'; 
   }
}

function toggleMobileCart() { document.getElementById('mobile-cart').classList.toggle('visible'); }

function toggleIni() { 
    var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    var metodo = parent.querySelector('#c-metodo').value;
    if(metodo !== "Crédito") { usuarioForzoInicial = false; } 
    calcCart(); 
}

function clearCart() { 
    CART=[]; 
    usuarioForzoInicial = false;
    var inpInicial = document.getElementById('c-inicial');
    if(inpInicial) inpInicial.value = '';
    renderPos(); 
    updateCartUI(); 
}

function shareQuote() {
    var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    var cli = parent.querySelector('#c-cliente').value || "Cliente";
    var concepto = "";
    if(CART.length > 0) { 
        concepto = CART.map(x=> `${x.cantidad}x ${x.nombre}`).join(', '); 
    } else { 
        concepto = parent.querySelector('#c-concepto').value || "Varios"; 
    }
    
    var total = calculatedValues.total;
    var metodo = parent.querySelector('#c-metodo').value;
    var msg = `Hola *${cli}*, esta es tu cotización en King's Shop:\n\n`;
    msg += `📦 *Producto(s):* ${concepto}\n`;
    
    if(metodo === "Crédito") {
        var inicial = calculatedValues.inicial;
        var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
        var valorCuota = parent.querySelector('#res-cuota-val').innerText;
        msg += `💳 *Método:* Crédito\n`;
        msg += `💰 *Valor Total (Financiado):* ${COP.format(total)}\n`;
        msg += `🔹 *Inicial:* ${COP.format(inicial)}\n`;
        msg += `📅 *Plan:* ${cuotas} cuotas de *${valorCuota}*`;
    } else {
        msg += `💵 *Método:* Contado\n`;
        msg += `💰 *Total a Pagar:* ${COP.format(total)}`;
    }
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

function embellecerDescripcion(texto) {
    if (!texto) return "Sin detalles disponibles.";
    let t = texto;
    const diccionario = [
        { clave: "Pantalla", emoji: "📱" }, { clave: "Diseño", emoji: "✨" }, { clave: "Rendimiento", emoji: "🚀" },
        { clave: "Procesador", emoji: "🧠" }, { clave: "Cámaras", emoji: "📸" }, { clave: "Cámara", emoji: "📷" },
        { clave: "Batería", emoji: "🔋" }, { clave: "Seguridad", emoji: "🔒" }, { clave: "Audio", emoji: "🔊" },
        { clave: "Sonido", emoji: "🔈" }, { clave: "Almacenamiento", emoji: "💾" }, { clave: "Memoria", emoji: "💾" },
        { clave: "Conectividad", emoji: "📡" }, { clave: "Características", emoji: "📋" }, { clave: "Versión", emoji: "ℹ️" },
        { clave: "Garantía", emoji: "🛡️" }
    ];
    diccionario.forEach(item => {
        const regex = new RegExp(`(${item.clave}:?)`, 'gi');
        t = t.replace(regex, (match) => { return `%0A${item.emoji} *${match.trim()}*`; });
    });
    return t;
}

function shareProdWhatsApp(id) {
    var p = D.inv.find(x => x.id === id);
    if (!p) return alert("Producto no encontrado");
    var nombre = p.nombre.toUpperCase();
    var descripcionBonita = embellecerDescripcion(p.desc);
    var linkFoto = fixDriveLink(p.foto); 
    var msg = `👑 *KING'S SHOP* 👑%0A%0A`;
    msg += `📦 *PRODUCTO:* ${nombre}%0A`;
    msg += `📝 *DETALLES:*${descripcionBonita}%0A%0A`; 
    if(linkFoto && linkFoto.length > 10) { msg += `🖼️ *FOTO:* ${linkFoto}%0A%0A`; }
    msg += `👉 _¡Pregúntame por el precio!_%0A`; 
    msg += `🤝 _Siempre es un gusto atenderte_ 👑`; 
    var url = "https://wa.me/?text=" + msg;
    window.open(url, '_blank');
}

function shareProdLink(id) {
    if(!id) return;
    var link = "https://kishopsas.com/?id=" + id;
    if (navigator.share) {
        navigator.share({ title: 'King\'s Shop', text: 'Mira este producto:', url: link }).catch(err => { copyingDato(link); });
    } else { copyingDato(link); showToast("Enlace copiado", "info"); }
}

function finalizarVenta() {
   var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   var cli = parent.querySelector('#c-cliente').value;
   if(!cli) return alert("Falta Cliente");
   var metodo = parent.querySelector('#c-metodo').value;
   var fechaVal = parent.querySelector('#c-fecha').value;
   var cuotasVal = parseInt(parent.querySelector('#c-cuotas').value)||1;
   
   if(calculatedValues.total <= 0) return alert("Precio 0 no permitido");
   
   var itemsData = [];
   if(CART.length > 0) {
       var totalCostoRef = CART.reduce((a,b) => a + ((b.costo || 0) * (b.cantidad || 1)), 0); 
       var totalItemsCount = CART.reduce((a,b) => a + (b.cantidad || 1), 0);
       
       CART.forEach(p => {
           var qty = p.cantidad || 1;
           for (var i = 0; i < qty; i++) {
               var peso = (p.costo || 0) / totalCostoRef;
               if (totalCostoRef === 0) peso = 1 / totalItemsCount;
               itemsData.push({ nombre: p.nombre, cat: p.cat, costo: p.costo, precioVenta: calculatedValues.total * peso });
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

   var d = { items: itemsData, cliente: cli, metodo: metodo, inicial: (metodo === 'Crédito') ? calculatedValues.inicial : 0, vendedor: D.user || "Offline User", fechaPersonalizada: fechaVal, cuotas: cuotasVal };
   
   document.getElementById('loader').style.display='flex';
   callAPI('procesarVentaCarrito', d).then(r => { 
       if(r.exito) { if(r.offline) { alert("Venta guardada OFFLINE. Se subirá cuando haya internet."); location.reload(); } else { location.reload(); } } else { alert(r.error); document.getElementById('loader').style.display='none'; } 
   });
}

function abrirModalProv() { renderProvs(); myModalProv.show(); }
function abrirModalNuevo() { document.getElementById('new-id').value=''; document.getElementById('new-file-foto').value = ""; myModalNuevo.show(); }
function abrirModalWA() { myModalWA.show(); }
function abrirModalPed() { myModalPed.show(); }

function calcGain(idCosto, idPublico) {
    var costo = parseFloat(document.getElementById(idCosto).value);
    if(costo > 0) { var ganancia = costo * 1.30; document.getElementById(idPublico).value = Math.round(ganancia); }
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
    document.getElementById('inp-edit-proveedor').value=p.prov; 
    document.getElementById('inp-edit-desc').value=p.desc; 
    document.getElementById('inp-edit-web').checked = p.enWeb || false;
    document.getElementById('inp-edit-cat-web').value = p.catWeb || 'tecnologia';
    document.getElementById('inp-file-foto').value = "";
    document.getElementById('img-preview-box').style.display='none'; 
    var fixedUrl = fixDriveLink(p.foto);
    if(fixedUrl){ document.getElementById('img-preview-box').src=fixedUrl; document.getElementById('img-preview-box').style.display='block';} 
    myModalEdit.show(); 
}

function renderProvs() {
    var c = document.getElementById('list-provs'); c.innerHTML='';
    D.proveedores.forEach(p => {
        var waLink = p.tel ? `https://wa.me/57${p.tel.replace(/\D/g,'')}` : '#';
        var btn = p.tel ? `<a href="${waLink}" target="_blank" class="btn-wa-mini"><i class="fab fa-whatsapp"></i></a>` : '<span class="text-muted">-</span>';
        c.innerHTML += `<div class="prov-item"><div><strong>${p.nombre}</strong><br><small class="text-muted">${p.tel||'Sin numero'}</small></div><div class="d-flex gap-2">${btn}<button class="btn btn-sm btn-light border" onclick="editarProv('${p.nombre}')">✏️</button></div></div>`;
    });
}
function guardarProvManual(){ var n = document.getElementById('new-prov-name').value; var t = document.getElementById('new-prov-tel').value; if(!n) return; callAPI('registrarProveedor', {nombre:n, tel:t}).then(r=>{ document.getElementById('new-prov-name').value=''; document.getElementById('new-prov-tel').value=''; loadData(); }); }
function editarProv(nombre){ var t = prompt("Nuevo teléfono para "+nombre+":"); if(t) { callAPI('registrarProveedor', {nombre:nombre, tel:t}).then(()=>loadData()); } }

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

            c.innerHTML += `
            <div class="card-k card-debt">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="fw-bold mb-1">${d.cliente}</h6>
                        <small class="text-muted d-block text-truncate" style="max-width:150px;">${d.producto}</small>
                        ${fechaTxt}
                    </div>
                    <div class="text-end">
                        <h5 class="fw-bold text-danger m-0">${COP.format(d.saldo)}</h5>
                        <div class="mt-1 d-flex gap-1 justify-content-end">
                            <span class="badge-debt">Pendiente</span>
                            <button class="btn btn-xs btn-outline-primary" onclick="abrirModalRefinanciar('${d.idVenta}', '${d.cliente}', ${d.saldo})" title="Refinanciar Deuda">🔄</button>
                            <button class="btn btn-xs btn-outline-dark" onclick="castigarDeuda('${d.idVenta}', '${d.cliente}')" title="Castigar Cartera (Lista Negra)">☠️</button>
                        </div>
                    </div>
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

// NUEVO: FUNCIONES DE REFINANCIACIÓN
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
    myModalRefinanciar.show();
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
    
    document.getElementById('loader').style.display='flex';
    myModalRefinanciar.hide();
    
    callAPI('refinanciarDeuda', d).then(r => {
        if(r.exito) {
            showToast("Cartera refinanciada con éxito", "success");
            location.reload();
        } else {
            alert(r.error);
            document.getElementById('loader').style.display='none';
        }
    });
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
            document.getElementById('loader').style.display='flex';
            callAPI('castigarCartera', {idVenta: id}).then(r => {
                if(r.exito) { location.reload(); } 
                else { alert(r.error); document.getElementById('loader').style.display='none'; }
            });
        }
    });
}

function renderWeb() {
    var q = document.getElementById('web-search').value.toLowerCase().trim();
    var c = document.getElementById('web-list');
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
    var q = document.getElementById('inv-search').value.toLowerCase().trim();
    var filterProv = document.getElementById('filter-prov').value;
    var c = document.getElementById('inv-list');
    c.innerHTML=''; 
    var lista = D.inv || [];
    if(q) { lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)); }
    if(filterProv) { var fClean = filterProv.trim().toLowerCase(); lista = lista.filter(p => p.prov && String(p.prov).trim().toLowerCase().includes(fClean)); }

    lista.slice(0, 50).forEach(p=>{
        var descEncoded = encodeURIComponent(p.desc || "");
        var fixedUrl = fixDriveLink(p.foto);
        var imgHtml = fixedUrl ? `<img src="${fixedUrl}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? COP.format(p.publico) : 'N/A';
        var btnShareNoPrice = `<div class="btn-copy-mini text-white" style="background:#17a2b8; border-color:#17a2b8;" onclick="shareProdWhatsApp('${p.id}')" title="Enviar Ficha (Sin Precio)"><i class="fas fa-file-alt"></i> Ficha</div>`;
        var btnLink = `<div class="btn-copy-mini" style="background:var(--gold); color:black;" onclick="shareProdLink('${p.id}')" title="Copiar Link Web"><i class="fas fa-link"></i></div>`;

        var div = document.createElement('div');
        div.className = 'card-catalog';
        div.innerHTML = `<div class="cat-img-box">${imgHtml}<div class="btn-edit-float" onclick="prepararEdicion('${p.id}')"><i class="fas fa-pencil-alt"></i></div></div><div class="cat-body"><div class="cat-title">${p.nombre}</div><div class="cat-price">${precioDisplay}</div><small class="text-muted" style="font-size:0.7rem;">Costo: ${COP.format(p.costo)}</small></div><div class="cat-actions"><div class="btn-copy-mini" onclick="copyingDato('${p.id}')" title="Copiar ID">ID</div><div class="btn-copy-mini" onclick="copyingDato('${p.nombre}')" title="Copiar Nombre">Nom</div><div class="btn-copy-mini" onclick="copyingDato('${p.publico}')" title="Copiar Precio">$$</div>${btnShareNoPrice}${btnLink}</div>`;
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
   var newVal = { id: prodEdit.id, nombre: document.getElementById('inp-edit-nombre').value, cat: document.getElementById('inp-edit-categoria').value, prov: document.getElementById('inp-edit-proveedor').value, costo: parseFloat(document.getElementById('inp-edit-costo').value), publico: parseFloat(document.getElementById('inp-edit-publico').value), desc: document.getElementById('inp-edit-desc').value, foto: prodEdit.foto || "", enWeb: document.getElementById('inp-edit-web').checked, catWeb: document.getElementById('inp-edit-cat-web').value };
   var f = document.getElementById('inp-file-foto').files[0];
   var promise = Promise.resolve(null);
   if(f) { promise = compressImage(f); }
   promise.then(b64 => {
       var idx = D.inv.findIndex(x => x.id === prodEdit.id);
       if(idx > -1) { if(b64) { newVal.foto = b64; } D.inv[idx] = newVal; }
       renderInv(); renderPos(); myModalEdit.hide(); showToast("Guardando cambios...", "info");
       var payload = { id: newVal.id, nombre: newVal.nombre, categoria: newVal.cat, proveedor: newVal.prov, costo: newVal.costo, publico: newVal.publico, descripcion: newVal.desc, urlExistente: prodEdit.foto || "", enWeb: newVal.enWeb, catWeb: newVal.catWeb };
       if(b64) { payload.imagenBase64 = b64.split(',')[1]; payload.mimeType = f.type; payload.nombreArchivo = f.name; }
       callAPI('guardarProductoAvanzado', payload).then(r => { if(r.exito) { showToast("¡Guardado exitoso!", "success"); } else { showToast("Error guardando: " + r.error, "danger"); } });
   });
}

function eliminarProductoActual(){ if(confirm("Eliminar?")){ callAPI('eliminarProductoBackend', prodEdit.id).then(r=>{if(r.exito)location.reload()}); } }
function generarIDAuto(){ var c=document.getElementById('new-categoria').value; if(c)document.getElementById('new-id').value=c.substring(0,3).toUpperCase()+'-'+Math.floor(Math.random()*9999); }

function crearProducto(){ 
    var d={ nombre:document.getElementById('new-nombre').value, categoria:document.getElementById('new-categoria').value, proveedor:document.getElementById('new-proveedor').value, costo: parseFloat(document.getElementById('new-costo').value), publico: parseFloat(document.getElementById('new-publico').value), descripcion: document.getElementById('new-desc').value, enWeb: document.getElementById('new-web').checked, catWeb: document.getElementById('new-cat-web').value, id:document.getElementById('new-id').value||'GEN-'+Math.random() }; 
    var f = document.getElementById('new-file-foto').files[0];
    var promise = Promise.resolve(null);
    if(f) { promise = compressImage(f); }
    promise.then(b64 => {
        var localProd = { id: d.id, nombre: d.nombre, cat: d.categoria, prov: d.proveedor, costo: d.costo, publico: d.publico, desc: d.descripcion, foto: b64 || "", enWeb: d.enWeb, catWeb: d.catWeb };
        D.inv.unshift(localProd); renderInv(); myModalNuevo.hide(); showToast("Creando producto...", "info");
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

function doIngresoExtra() { var desc = document.getElementById('inc-desc').value; var cat = document.getElementById('inc-cat').value; var monto = document.getElementById('inc-monto').value; if(!desc || !monto) return alert("Falta descripción o monto"); document.getElementById('loader').style.display = 'flex'; callAPI('registrarIngresoExtra', { desc: desc, cat: cat, monto: monto }).then(r => { if(r.exito) location.reload(); else { alert(r.error); document.getElementById('loader').style.display = 'none'; } }); }

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

    document.getElementById('loader').style.display = 'flex';
    callAPI('registrarGasto', d).then(() => location.reload());
}

function renderFin(){ 
  var s=document.getElementById('ab-cli'); s.innerHTML='<option value="">Seleccione...</option>'; 
  (D.deudores || []).filter(d => d.estado !== 'Castigado').forEach(d=>{ s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${COP.format(d.saldo)})</option>`; });
  
  var today = new Date().toISOString().split('T')[0];
  var elFecha = document.getElementById('ab-fecha');
  if(elFecha) elFecha.value = today;

  var q = document.getElementById('hist-search') ? document.getElementById('hist-search').value.toLowerCase() : "";
  var h=document.getElementById('hist-list'); h.innerHTML=''; 
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
    var fechaRaw = movEditObj.fecha;
    var fechaIso = "";
    if(fechaRaw.includes('/')) { var parts = fechaRaw.split('/'); if(parts.length === 3) fechaIso = `${parts[2]}-${parts[1]}-${parts[0]}`; } else { fechaIso = fechaRaw.split(' ')[0]; }
    document.getElementById('ed-mov-fecha').value = fechaIso;
    myModalEditMov.show();
}

function guardarEdicionMovimiento() {
    if(!movEditObj) return;
    var nuevaFecha = document.getElementById('ed-mov-fecha').value;
    var nuevoMonto = document.getElementById('ed-mov-monto').value;
    if(!nuevaFecha || !nuevoMonto) return alert("Fecha y monto requeridos");
    var payload = { original: movEditObj, fecha: nuevaFecha, monto: nuevoMonto };
    document.getElementById('loader').style.display = 'flex';
    myModalEditMov.hide();
    callAPI('editarMovimiento', payload).then(r => { if(r.exito) { showToast("Movimiento corregido", "success"); location.reload(); } else { alert("Error al editar: " + r.error); document.getElementById('loader').style.display = 'none'; } });
}

function doAbono(){ var id=document.getElementById('ab-cli').value; if(!id)return alert("Seleccione un cliente"); var txt=document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text; var cli=txt.split('(')[0].trim(); var monto = document.getElementById('ab-monto').value; var fechaVal = document.getElementById('ab-fecha').value; document.getElementById('loader').style.display='flex'; callAPI('registrarAbono', {idVenta:id, monto:monto, cliente:cli, fecha: fechaVal}).then(()=>location.reload()); }
function renderPed(){ var c=document.getElementById('ped-list'); c.innerHTML=''; (D.ped || []).forEach(p=>{ var isPend = p.estado === 'Pendiente'; var badge = isPend ? `<span class="badge bg-warning text-dark">${p.estado}</span>` : `<span class="badge bg-success">${p.estado}</span>`; var controls = `<div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-outline-secondary flex-fill" onclick='openEditPed(${JSON.stringify(p)})'>✏️</button><button class="btn btn-sm btn-outline-danger flex-fill" onclick="delPed('${p.id}')">🗑️</button>${isPend ? `<button class="btn btn-sm btn-outline-success flex-fill" onclick="comprarPedido('${p.id}', '${p.prod}')">✅</button>` : ''}</div>`; c.innerHTML+=`<div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}"><div class="d-flex justify-content-between"><div><strong>${p.prod}</strong><br><small class="text-muted">${p.prov || 'Sin Prov.'}</small></div><div class="text-end"><small>${p.fecha}</small><br>${badge}</div></div>${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}${controls}</div>`; }); }
function savePed(){ var p=document.getElementById('pe-prod').value; if(!p) return alert("Escribe un producto"); var d = { user: D.user, prod: p, prov: document.getElementById('pe-prov').value, costoEst: document.getElementById('pe-costo').value, notas: document.getElementById('pe-nota').value }; document.getElementById('loader').style.display='flex'; callAPI('guardarPedido', d).then(()=>location.reload()); }
function openEditPed(p) { pedEditId = p.id; document.getElementById('ed-ped-prod').value = p.prod; document.getElementById('ed-ped-prov').value = p.prov; document.getElementById('ed-ped-costo').value = p.costo; document.getElementById('ed-ped-nota').value = p.notas; myModalEditPed.show(); }
function guardarEdicionPed() { if(!pedEditId) return; var d = { id: pedEditId, prod: document.getElementById('ed-ped-prod').value, prov: document.getElementById('ed-ped-prov').value, costoEst: document.getElementById('ed-ped-costo').value, notas: document.getElementById('ed-ped-nota').value }; document.getElementById('loader').style.display='flex'; callAPI('editarPedido', d).then(r => { if(r.exito) location.reload(); else { alert(r.error); document.getElementById('loader').style.display='none'; } }); }
function delPed(id) { Swal.fire({ title: '¿Eliminar Pedido?', text: "No podrás deshacer esta acción.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' }).then((result) => { if (result.isConfirmed) { document.getElementById('loader').style.display='flex'; callAPI('eliminarPedido', id).then(r => { if(r.exito) location.reload(); else { alert(r.error); document.getElementById('loader').style.display='none'; } }); } }); }
function comprarPedido(id, nombreProd) { Swal.fire({ title: 'Confirmar Compra', text: `¿Ya compraste "${nombreProd}"? Ingresa el costo REAL final.`, input: 'number', inputLabel: 'Costo Real de Compra', inputPlaceholder: 'Ej: 50000', showCancelButton: true, confirmButtonText: 'Sí, Registrar Gasto e Inventario', cancelButtonText: 'Cancelar', inputValidator: (value) => { if (!value || value <= 0) return 'Debes ingresar un costo válido.'; } }).then((result) => { if (result.isConfirmed) { document.getElementById('loader').style.display = 'flex'; callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => { if(r.exito) { Swal.fire('¡Éxito!', 'Gasto registrado e inventario actualizado.', 'success').then(() => location.reload()); } else { alert(r.error); document.getElementById('loader').style.display = 'none'; } }); } }); }
function verBancos() { const num = "0090894825"; Swal.fire({title:'Bancolombia',text:num,icon:'info',confirmButtonText:'Copiar'}).then((r)=>{if(r.isConfirmed)navigator.clipboard.writeText(num)}); }
