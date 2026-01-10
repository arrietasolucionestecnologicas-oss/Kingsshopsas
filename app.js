// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbzWEqQQTow3irxkTU4Y3CVJshtfjo1s2m1dwSicRihQ42_fArC6L9MAuQoUPUfzzXYS/exec"; 

var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed, myModalEditPed;
var prodEdit = null;
var pedEditId = null; 
var calculatedValues = { total: 0, inicial: 0 };

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// --- GESTIÓN DE ESTADO OFFLINE/ONLINE ---
function updateOnlineStatus() {
    const status = document.getElementById('offline-indicator');
    if(navigator.onLine) {
        status.style.display = 'none';
        sincronizarCola(); // Intentar subir ventas pendientes al volver internet
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
    
    // Procesar uno por uno para no saturar
    let nuevaCola = [];
    for (let item of cola) {
        try {
            // Intentar enviar
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: item.action, data: item.data })
            });
            const res = await response.json();
            if (!res.exito) throw new Error(res.error);
        } catch (e) {
            console.error("Fallo al sincronizar item:", item, e);
            nuevaCola.push(item); // Si falla, se queda en la cola
        }
    }
    
    localStorage.setItem('kingshop_queue', JSON.stringify(nuevaCola));
    if (nuevaCola.length === 0) {
        showToast("¡Sincronización completada!", "success");
        loadData(); // Recargar datos frescos
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
  // Si no hay internet y es una acción de escritura (guardar/vender), usar cola
  if (!navigator.onLine && action !== 'obtenerDatosCompletos') {
      guardarEnCola(action, data);
      return { exito: true, offline: true }; // Simular éxito
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
    // Si falla la red al intentar enviar, guardar en cola
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
  
  // ESTRATEGIA: Intentar cargar de red. Si falla, cargar de local.
  callAPI('obtenerDatosCompletos').then(res => {
    if(res && res.inventario) {
        // ÉXITO ONLINE: Guardar en local y usar
        saveLocalData(res);
        renderData(res);
    } else {
        // FALLO: Usar local
        console.log("Usando datos locales por fallo de red");
        const local = loadLocalData();
        if(local) renderData(local);
    }
    document.getElementById('loader').style.display='none';
  }).catch(() => {
      // SI FALLA FETCH TOTAL (Offline)
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
    
    var dl = document.getElementById('list-cats'); if(dl) { dl.innerHTML=''; (res.categorias || []).forEach(c => { var o=document.createElement('option'); o.value=c; dl.appendChild(o); }); }
    
    var dlp = document.querySelectorAll('#list-prods-all'); 
    dlp.forEach(list => {
        list.innerHTML = '';
        (D.inv || []).forEach(p => { var o=document.createElement('option'); o.value=p.nombre; list.appendChild(o); });
    });

    var editCat = document.getElementById('inp-edit-categoria');
    if(editCat){
        editCat.innerHTML = '';
        (res.categorias || []).forEach(c => { var o = document.createElement('option'); o.value = c; o.text = c; editCat.appendChild(o); });
    }
    updateGastosSelect();
}

function updateGastosSelect() {
    var sg = document.getElementById('g-vinculo');
    if(sg) {
        sg.innerHTML = '<option value="">-- Ninguna (Gasto General) --</option>';
        if (D.ultimasVentas && D.ultimasVentas.length > 0) {
            D.ultimasVentas.forEach(v => { var o = document.createElement('option'); o.value = v.id; o.text = v.desc; sg.appendChild(o); });
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
    if (url.includes("drive.google.com") && url.includes("id=")) {
        var m = url.match(/id=([a-zA-Z0-9_-]+)/);
        if (m && m[1]) return "http://lh3.googleusercontent.com/d/" + m[1];
    }
    return url;
}

// --- VENTA (POS) TIPO BUSCADOR PROFESIONAL ---
function renderPos(){
  var q = document.getElementById('pos-search').value.toLowerCase().trim();
  var c = document.getElementById('pos-list'); 
  var placeholder = document.getElementById('pos-placeholder');
  c.innerHTML='';
  
  if(!q) {
      placeholder.style.display = 'block';
      return;
  }
  placeholder.style.display = 'none';

  var lista = D.inv || [];
  var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
  
  if(res.length === 0) {
      c.innerHTML = '<div class="text-center text-muted py-3">No encontrado</div>';
      return;
  }

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
       el.classList.remove('active'); 
   } else { 
       CART.push(p); 
       el.classList.add('active'); 
   }
   updateCartUI();
}

function updateCartUI() {
   var count = CART.length;
   calcCart();
   var btnFloat = document.getElementById('btn-float-cart');
   btnFloat.style.display = count > 0 ? 'block' : 'none';
   btnFloat.innerText = "🛒 " + count;
   
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!parent) parent = document.getElementById('desktop-cart-container');
   
   var dateInput = parent.querySelector('#c-fecha');
   if(dateInput && !dateInput.value) {
       var today = new Date();
       var yyyy = today.getFullYear();
       var mm = String(today.getMonth() + 1).padStart(2, '0');
       var dd = String(today.getDate()).padStart(2, '0');
       dateInput.value = `${yyyy}-${mm}-${dd}`;
   }
   
   if(count === 0) {
       document.getElementById('mobile-cart').classList.remove('visible');
   }

   var names = CART.map(x=>x.nombre).join(', ');
   document.querySelectorAll('#cart-items-list').forEach(e => e.innerText = names || 'Selecciona productos...');
}

function toggleManual() {
    var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
    var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');

    var isManual = parent.querySelector('#c-manual').checked;
    var inpTotal = parent.querySelector('#res-cont-input');
    var txtTotal = parent.querySelector('#res-cont');
    var inpUtil = parent.querySelector('#c-util');

    if(isManual) { 
        inpTotal.style.display = 'inline-block'; 
        txtTotal.style.display = 'none'; 
        inpUtil.disabled = true; 
        setTimeout(() => { inpTotal.focus(); }, 100);
    } else { 
        inpTotal.style.display = 'none'; 
        txtTotal.style.display = 'inline-block'; 
        inpUtil.disabled = false; 
    }
    calcCart();
}

function calcCart() {
   if(CART.length===0) { document.querySelectorAll('#res-cont').forEach(e => e.innerText = COP.format(0)); return; }
   
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var parent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!parent) parent = document.getElementById('desktop-cart-container'); 

   var util = parseFloat(parent.querySelector('#c-util').value)||0;
   var inter = parseFloat(parent.querySelector('#c-int').value)||0;
   var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
   var conIva = parent.querySelector('#c-iva').checked;
   var isManual = parent.querySelector('#c-manual').checked;
   var metodo = parent.querySelector('#c-metodo').value;
   var base = 0;

   if (isManual) {
       var manualVal = parseFloat(parent.querySelector('#res-cont-input').value);
       base = isNaN(manualVal) ? 0 : manualVal;
   } else {
       base = CART.reduce((acc, item) => {
           if(item.publico > 0) return acc + item.publico; 
           return acc + (item.costo * (1 + util/100)); 
       }, 0);
       if(conIva) base = base * 1.19;
       document.querySelectorAll('#res-cont').forEach(e => e.innerText = COP.format(Math.round(base)));
       document.querySelectorAll('#res-cont-input').forEach(e => e.value = Math.round(base));
   }
   calculatedValues.total = base;
   
   var rowCred = parent.querySelectorAll('#row-cred'); 
   var inpInicial = parent.querySelectorAll('#c-inicial');

   if(metodo === "Crédito") {
       var activeEl = document.activeElement;
       var isTypingInicial = (activeEl && activeEl.id === 'c-inicial' && parent.contains(activeEl));
       
       var inicial = 0;
       if(isTypingInicial) {
           inicial = parseFloat(parent.querySelector('#c-inicial').value);
           if(isNaN(inicial)) inicial = 0;
       } else {
           inicial = base * 0.30;
       }
       
       calculatedValues.inicial = inicial;
       
       var saldoRestante = base - inicial;
       if(saldoRestante < 0) saldoRestante = 0;

       var saldoConInteres = saldoRestante * (1 + inter/100); 
       var valorCuota = saldoConInteres / cuotas;
       
       rowCred.forEach(e => { 
           e.style.display = 'block'; 
           e.querySelector('#res-ini').innerText = COP.format(Math.round(inicial)); 
           e.querySelector('#res-cuota-val').innerText = COP.format(Math.round(valorCuota)); 
           e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} cuotas`; 
       });
       
       inpInicial.forEach(e => { 
           if(!isTypingInicial) e.value = Math.round(inicial); 
           e.style.display='block'; 
           e.disabled = false;
           e.style.background = '#fff';
       });
   } else { 
       rowCred.forEach(e => e.style.display = 'none'); 
       inpInicial.forEach(e => e.style.display='none'); 
   }
}

function toggleMobileCart() { document.getElementById('mobile-cart').classList.toggle('visible'); }
function toggleIni() { calcCart(); }
function clearCart() { CART=[]; renderPos(); updateCartUI(); }

function finalizarVenta() {
   if(CART.length===0) return alert("Carrito vacío");
   var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   var cli = parent.querySelector('#c-cliente').value;
   if(!cli) return alert("Falta Cliente");
   var metodo = parent.querySelector('#c-metodo').value;
   
   var fechaVal = parent.querySelector('#c-fecha').value;
   
   if(calculatedValues.total <= 0) return alert("Precio 0 no permitido");
   
   var totalCostoRef = CART.reduce((a,b)=>a+(b.publico>0?b.publico:b.costo),0); 
   var factor = calculatedValues.total / totalCostoRef; 
   if(isNaN(factor)) factor = 1;

   var itemsData = CART.map(p => {
       var baseItem = p.publico > 0 ? p.publico : p.costo;
       var peso = baseItem / CART.reduce((a,b)=>a+(b.publico>0?b.publico:b.costo),0);
       return { nombre: p.nombre, cat: p.cat, costo: p.costo, precioVenta: calculatedValues.total * peso };
   });

   var d = { 
       items: itemsData, 
       cliente: cli, 
       metodo: metodo, 
       inicial: (metodo === 'Crédito') ? calculatedValues.inicial : 0, 
       vendedor: D.user || "Offline User",
       fechaPersonalizada: fechaVal 
   };
   
   document.getElementById('loader').style.display='flex';
   callAPI('procesarVentaCarrito', d).then(r => { 
       if(r.exito) { 
           if(r.offline) {
               alert("Venta guardada OFFLINE. Se subirá cuando haya internet.");
               location.reload(); // Recargar para limpiar carro
           } else {
               location.reload(); 
           }
       } else { 
           alert(r.error); 
           document.getElementById('loader').style.display='none'; 
       } 
   });
}

function abrirModalProv() { renderProvs(); myModalProv.show(); }
function abrirModalNuevo() { 
    document.getElementById('new-id').value=''; 
    document.getElementById('new-file-foto').value = ""; 
    myModalNuevo.show(); 
}
function abrirModalWA() { myModalWA.show(); }
function abrirModalPed() { myModalPed.show(); }

function calcGain(idCosto, idPublico) {
    var costo = parseFloat(document.getElementById(idCosto).value);
    if(costo > 0) {
        var ganancia = costo * 1.30; 
        document.getElementById(idPublico).value = Math.round(ganancia);
    }
}

// --- FUNCIÓN BLINDADA: EDICIÓN POR ID ---
function prepararEdicion(id) {
    var p = D.inv.find(x => x.id === id);
    if (p) {
        openEdit(p);
    } else {
        alert("Producto no encontrado en memoria");
    }
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
    var totalDeuda = 0;
    
    if(!D.deudores || D.deudores.length === 0) {
        c.innerHTML = '<div class="text-center text-muted p-5">👏 Excelente, no hay deudas pendientes.</div>';
    } else {
        D.deudores.forEach(d => {
            totalDeuda += d.saldo;
            var fechaTxt = d.fechaLimite ? `<small class="text-muted"><i class="far fa-calendar-alt"></i> Vence: ${d.fechaLimite}</small>` : '<small class="text-muted">Sin fecha</small>';
            
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
                        <div class="mt-1"><span class="badge-debt">Pendiente</span></div>
                    </div>
                </div>
            </div>`;
        });
    }
    
    if(bal) bal.innerText = COP.format(totalDeuda);
}

function renderWeb() {
    var q = document.getElementById('web-search').value.toLowerCase().trim();
    var c = document.getElementById('web-list');
    c.innerHTML = '';
    
    var lista = (D.inv || []).filter(p => p.enWeb === true);
    
    if(q) {
        lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));
    }

    if(lista.length === 0) {
        c.innerHTML = `<div class="text-center text-muted p-5">
            <div style="font-size:2rem">🌐</div>
            <p>No hay productos en Web.<br>Actívalos desde Inventario.</p>
        </div>`;
        return;
    }

    lista.slice(0, 50).forEach(p => {
        var fixedUrl = fixDriveLink(p.foto);
        var img = fixedUrl ? `<img src="${fixedUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:5px;">` : `<div style="width:50px; height:50px; background:#eee; border-radius:5px;">📷</div>`;
        
        c.innerHTML += `
        <div class="card-k">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex gap-2 align-items-center">
                    ${img}
                    <div>
                        <strong>${p.nombre}</strong><br>
                        <small class="badge bg-primary">${p.catWeb}</small> 
                        <small class="text-muted">| ${COP.format(p.publico)}</small>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="toggleWebStatus('${p.id}')">
                    Desactivar
                </button>
            </div>
        </div>`;
    });
}

function toggleWebStatus(id) {
    var idx = D.inv.findIndex(x => x.id === id);
    if(idx > -1) {
        var p = D.inv[idx];
        p.enWeb = !p.enWeb; 
        
        renderWeb();
        renderInv(); 
        showToast("Producto actualizado", "info");

        var payload = {
           id: p.id,
           nombre: p.nombre,
           categoria: p.cat,
           proveedor: p.prov,
           costo: p.costo,
           publico: p.publico,
           descripcion: p.desc,
           urlExistente: p.foto || "", 
           enWeb: p.enWeb,
           catWeb: p.catWeb
        };
        callAPI('guardarProductoAvanzado', payload);
    }
}

// --- ACTUALIZADO: RENDERIZADO CATÁLOGO CON FILTRO PROVEEDOR ---
function renderInv(){ 
    var q = document.getElementById('inv-search').value.toLowerCase().trim();
    // LEEMOS EL FILTRO
    var filterProv = document.getElementById('filter-prov').value;
    
    var c = document.getElementById('inv-list');
    c.innerHTML=''; 
    var lista = D.inv || [];
    
    // FILTRO COMPUESTO
    if(q) { 
        lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)); 
    }
    if(filterProv) {
        lista = lista.filter(p => p.prov === filterProv);
    }

    lista.slice(0, 50).forEach(p=>{
        var descEncoded = encodeURIComponent(p.desc || "");
        var fixedUrl = fixDriveLink(p.foto);
        var imgHtml = fixedUrl ? `<img src="${fixedUrl}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? COP.format(p.publico) : 'N/A';

        // Estructura Tarjeta Grid
        var div = document.createElement('div');
        div.className = 'card-catalog';
        div.innerHTML = `
            <div class="cat-img-box">
                ${imgHtml}
                <div class="btn-edit-float" onclick="prepararEdicion('${p.id}')"><i class="fas fa-pencil-alt"></i></div>
            </div>
            <div class="cat-body">
                <div class="cat-title">${p.nombre}</div>
                <div class="cat-price">${precioDisplay}</div>
                <small class="text-muted" style="font-size:0.7rem;">Costo: ${COP.format(p.costo)}</small>
            </div>
            <div class="cat-actions">
                <div class="btn-copy-mini" onclick="copiarDato('${p.id}')">ID</div>
                <div class="btn-copy-mini" onclick="copiarDato('${p.nombre}')">Nom</div>
                <div class="btn-copy-mini" onclick="copiarDato(decodeURIComponent('${descEncoded}'))">Desc</div>
                <div class="btn-copy-mini" onclick="copiarDato('${p.publico}')">$$</div>
            </div>
        `;
        c.appendChild(div);
    }); 
}

function copiarDato(txt) {
    if(!txt || txt === 'undefined' || txt === '0') return alert("Dato vacío o no disponible");
    navigator.clipboard.writeText(txt).then(() => { showToast("Copiado: " + txt.substring(0,10) + "..."); });
}

function previewFile(){ var f=document.getElementById('inp-file-foto').files[0]; if(f){var r=new FileReader();r.onload=e=>{document.getElementById('img-preview-box').src=e.target.result;document.getElementById('img-preview-box').style.display='block';};r.readAsDataURL(f);} }

function guardarCambiosAvanzado(){
   if(!prodEdit) return; 
   
   var newVal = {
       id: prodEdit.id, 
       nombre: document.getElementById('inp-edit-nombre').value, 
       cat: document.getElementById('inp-edit-categoria').value, 
       prov: document.getElementById('inp-edit-proveedor').value, 
       costo: parseFloat(document.getElementById('inp-edit-costo').value), 
       publico: parseFloat(document.getElementById('inp-edit-publico').value), 
       desc: document.getElementById('inp-edit-desc').value, 
       foto: prodEdit.foto || "", 
       enWeb: document.getElementById('inp-edit-web').checked,
       catWeb: document.getElementById('inp-edit-cat-web').value
   };

   var f = document.getElementById('inp-file-foto').files[0];
   var promise = Promise.resolve(null);

   if(f) {
       // USAR COMPRESIÓN AL EDITAR TAMBIÉN
       promise = compressImage(f);
   }

   promise.then(b64 => {
       var idx = D.inv.findIndex(x => x.id === prodEdit.id);
       if(idx > -1) {
           if(b64) {
               // En preview mostramos b64 directo, el split se hace al enviar
               var previewSrc = document.getElementById('img-preview-box').src;
               // El canvas toDataURL devuelve el string completo
               if(b64) newVal.foto = b64; 
           }
           D.inv[idx] = newVal; 
       }

       renderInv();
       renderPos();
       myModalEdit.hide();
       showToast("Guardando cambios...", "info");

       var payload = {
           id: newVal.id,
           nombre: newVal.nombre,
           categoria: newVal.cat,
           proveedor: newVal.prov,
           costo: newVal.costo,
           publico: newVal.publico,
           descripcion: newVal.desc,
           urlExistente: prodEdit.foto || "", 
           enWeb: newVal.enWeb,
           catWeb: newVal.catWeb
       };

       if(b64) {
           payload.imagenBase64 = b64.split(',')[1];
           payload.mimeType = f.type; 
           payload.nombreArchivo = f.name;
       }

       callAPI('guardarProductoAvanzado', payload).then(r => {
           if(r.exito) {
               showToast("¡Guardado exitoso!", "success");
           } else {
               showToast("Error guardando: " + r.error, "danger");
           }
       });
   });
}

function eliminarProductoActual(){ if(confirm("Eliminar?")){ callAPI('eliminarProductoBackend', prodEdit.id).then(r=>{if(r.exito)location.reload()}); } }
function generarIDAuto(){ var c=document.getElementById('new-categoria').value; if(c)document.getElementById('new-id').value=c.substring(0,3).toUpperCase()+'-'+Math.floor(Math.random()*9999); }

// --- FUNCIÓN ARREGLADA: CREACIÓN CON COMPRESIÓN ---
function crearProducto(){ 
    var d={
        nombre:document.getElementById('new-nombre').value, 
        categoria:document.getElementById('new-categoria').value, 
        proveedor:document.getElementById('new-proveedor').value, 
        costo: parseFloat(document.getElementById('new-costo').value), 
        publico: parseFloat(document.getElementById('new-publico').value), 
        descripcion: document.getElementById('new-desc').value,
        enWeb: document.getElementById('new-web').checked,
        catWeb: document.getElementById('new-cat-web').value,
        id:document.getElementById('new-id').value||'GEN-'+Math.random()
    }; 
    
    var f = document.getElementById('new-file-foto').files[0];
    
    // 1. Promesa de compresión
    var promise = Promise.resolve(null);
    if(f) {
        promise = compressImage(f); // USAR COMPRESOR
    }

    promise.then(b64 => {
        // Actualizar UI local
        var localProd = {
            id: d.id, nombre: d.nombre, cat: d.categoria, prov: d.proveedor, 
            costo: d.costo, publico: d.publico, desc: d.descripcion,
            foto: b64 || "", 
            enWeb: d.enWeb, catWeb: d.catWeb
        };
        D.inv.unshift(localProd);
        renderInv();
        myModalNuevo.hide();
        showToast("Creando producto...", "info");

        // Preparar payload para API
        if(b64) {
            d.imagenBase64 = b64.split(',')[1]; 
            d.mimeType = f.type;
            d.nombreArchivo = f.name;
        }

        callAPI('crearProductoManual', d).then(r=>{
            if(r.exito){ showToast("Producto sincronizado", "success"); }
            else { showToast("Error al crear en servidor", "danger"); }
        });
    });
}

function procesarWA(){ var p=document.getElementById('wa-prov').value,c=document.getElementById('wa-cat').value,t=document.getElementById('wa-text').value; if(!c||!t)return alert("Falta datos"); var btn=document.querySelector('#modalWA .btn-success'); btn.innerText="Procesando..."; btn.disabled=true; callAPI('procesarImportacionDirecta', {prov:p, cat:c, txt:t}).then(r=>{alert(r.mensaje||r.error);location.reload()}); }
function renderFin(){ 
  var s=document.getElementById('ab-cli'); s.innerHTML='<option value="">Seleccione...</option>'; 
  D.deudores.forEach(d=>{ s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${COP.format(d.saldo)})</option>`; });
  var h=document.getElementById('hist-list'); h.innerHTML=''; 
  var dataHist = D.historial || []; 
  if(dataHist.length === 0) { h.innerHTML = '<div class="text-center text-muted p-3">Sin movimientos registrados.</div>'; } 
  else { 
    dataHist.forEach(x=>{ 
        var i=(x.tipo.includes('ingreso')||x.tipo.includes('abono')); 
        h.innerHTML+=`<div class="mov-item d-flex align-items-center mb-2 p-2 border-bottom"><div class="mov-icon me-3 ${i?'text-success':'text-danger'}"><i class="fas fa-${i?'arrow-down':'arrow-up'}"></i></div><div class="flex-grow-1 lh-1"><div class="fw-bold small">${x.desc}</div><small class="text-muted" style="font-size:0.75rem">${x.fecha}</small></div><div class="fw-bold ${i?'text-success':'text-danger'}">${i?'+':'-'} ${COP.format(x.monto)}</div></div>`; 
    }); 
  }
}
function doAbono(){ 
    var id=document.getElementById('ab-cli').value; if(!id)return alert("Seleccione un cliente"); 
    var txt=document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text; var cli=txt.split('(')[0].trim(); 
    document.getElementById('loader').style.display='flex'; 
    callAPI('registrarAbono', {idVenta:id, monto:document.getElementById('ab-monto').value, cliente:cli}).then(()=>location.reload()); 
}
// NUEVA FUNCIÓN PARA INGRESO EXTRA
function doIngresoExtra() {
    var desc = document.getElementById('inc-desc').value;
    var cat = document.getElementById('inc-cat').value;
    var monto = document.getElementById('inc-monto').value;
    
    if(!desc || !monto) return alert("Falta descripción o monto");
    
    document.getElementById('loader').style.display = 'flex';
    callAPI('registrarIngresoExtra', { desc: desc, cat: cat, monto: monto }).then(r => {
        if(r.exito) location.reload();
        else { alert(r.error); document.getElementById('loader').style.display = 'none'; }
    });
}

function doGasto(){ 
    var desc = document.getElementById('g-desc').value; var monto = document.getElementById('g-monto').value;
    if(!desc || !monto) return alert("Falta descripción o monto");
    var d={ desc: desc, cat: document.getElementById('g-cat').value, monto: monto, vinculo: document.getElementById('g-vinculo').value }; 
    document.getElementById('loader').style.display='flex'; callAPI('registrarGasto', d).then(()=>location.reload()); 
}

function renderPed(){ 
    var c=document.getElementById('ped-list'); c.innerHTML=''; 
    (D.ped || []).forEach(p=>{ 
        var isPend = p.estado === 'Pendiente';
        // CAMBIO: Mostrar botones SIEMPRE, no solo si es pendiente
        var badge = isPend ? `<span class="badge bg-warning text-dark">${p.estado}</span>` : `<span class="badge bg-success">${p.estado}</span>`;
        var controls = `
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill" onclick='openEditPed(${JSON.stringify(p)})'>✏️</button>
            <button class="btn btn-sm btn-outline-danger flex-fill" onclick="delPed('${p.id}')">🗑️</button>
            ${isPend ? `<button class="btn btn-sm btn-outline-success flex-fill" onclick="comprarPedido('${p.id}', '${p.prod}')">✅</button>` : ''}
          </div>`;
        
        c.innerHTML+=`
        <div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}">
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${p.prod}</strong><br>
                    <small class="text-muted">${p.prov || 'Sin Prov.'}</small>
                </div>
                <div class="text-end">
                    <small>${p.fecha}</small><br>${badge}
                </div>
            </div>
            ${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}
            ${controls}
        </div>`;
    }); 
}

function savePed(){ 
    var p=document.getElementById('pe-prod').value; 
    if(!p) return alert("Escribe un producto");
    var d = { user: D.user, prod: p, prov: document.getElementById('pe-prov').value, costoEst: document.getElementById('pe-costo').value, notas: document.getElementById('pe-nota').value };
    document.getElementById('loader').style.display='flex';
    callAPI('guardarPedido', d).then(()=>location.reload()); 
}

function openEditPed(p) {
    pedEditId = p.id;
    document.getElementById('ed-ped-prod').value = p.prod;
    document.getElementById('ed-ped-prov').value = p.prov;
    document.getElementById('ed-ped-costo').value = p.costo;
    document.getElementById('ed-ped-nota').value = p.notas;
    myModalEditPed.show();
}

function guardarEdicionPed() {
    if(!pedEditId) return;
    var d = { id: pedEditId, prod: document.getElementById('ed-ped-prod').value, prov: document.getElementById('ed-ped-prov').value, costoEst: document.getElementById('ed-ped-costo').value, notas: document.getElementById('ed-ped-nota').value };
    document.getElementById('loader').style.display='flex';
    callAPI('editarPedido', d).then(r => { if(r.exito) location.reload(); else { alert(r.error); document.getElementById('loader').style.display='none'; } });
}

function delPed(id) {
    Swal.fire({ title: '¿Eliminar Pedido?', text: "No podrás deshacer esta acción.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('loader').style.display='flex';
            callAPI('eliminarPedido', id).then(r => { if(r.exito) location.reload(); else { alert(r.error); document.getElementById('loader').style.display='none'; } });
        }
    });
}

function comprarPedido(id, nombreProd) {
    Swal.fire({
        title: 'Confirmar Compra',
        text: `¿Ya compraste "${nombreProd}"? Ingresa el costo REAL final.`,
        input: 'number',
        inputLabel: 'Costo Real de Compra',
        inputPlaceholder: 'Ej: 50000',
        showCancelButton: true,
        confirmButtonText: 'Sí, Registrar Gasto e Inventario',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => { if (!value || value <= 0) return 'Debes ingresar un costo válido.'; }
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('loader').style.display = 'flex';
            callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => {
                 if(r.exito) { Swal.fire('¡Éxito!', 'Gasto registrado e inventario actualizado.', 'success').then(() => location.reload()); } else { alert(r.error); document.getElementById('loader').style.display = 'none'; }
            });
        }
    });
}

function verBancos() { const num = "0090894825"; Swal.fire({title:'Bancolombia',text:num,icon:'info',confirmButtonText:'Copiar'}).then((r)=>{if(r.isConfirmed)navigator.clipboard.writeText(num)}); }
