// ============================================
// ⚠️ PEGA TU URL DE GOOGLE APPS SCRIPT AQUÍ
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbx2P2M77oje0uwwcJPnUkY2jakGMBUSSdJx-veS_ZmC55_tRzwBdjmz_gRLEvJ0xebG/exec"; 

// --- BASE DE DATOS LOCAL (DEXIE) ---
// Esto persiste aunque cierres el navegador o apagues el celular
const db = new Dexie("KingshopDB");
db.version(1).stores({
    kv: 'key', // Para guardar la data completa (inventario)
    queue: '++id, action, data, timestamp' // Cola de sincronización
});

// VARIABLES GLOBALES
var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed, myModalEditPed;
var prodEdit = null;
var pedEditId = null; 
var calculatedValues = { total: 0, inicial: 0 };

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// --- GESTIÓN ONLINE/OFFLINE ---
function updateStatus() {
    const el = document.getElementById('status-bar');
    if(navigator.onLine) {
        if(el) {
             el.className = 'status-sync';
             el.innerText = '🟢 Conectado - Sincronizando...';
             el.style.display = 'block';
        }
        processQueue(); // Intentar subir cola
        setTimeout(() => { if(el) el.style.display = 'none'; }, 2000);
    } else {
        if(el) {
            el.className = 'status-offline';
            el.innerText = '🟠 Modo Offline Activado';
            el.style.display = 'block';
        }
        const ind = document.getElementById('offline-indicator');
        if(ind) ind.style.display = 'block';
    }
}
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

// --- CALL API HÍBRIDO (OFFLINE FIRST) ---
async function callAPI(action, data = null) {
    // Si no hay internet y es una escritura -> Guardar en Cola
    if (!navigator.onLine && action !== 'obtenerDatosCompletos') {
        await db.queue.add({ action: action, data: data, timestamp: Date.now() });
        showToast("Guardado localmente. Se subirá al tener internet.", "warning");
        return { exito: true, offline: true };
    }

    // Si hay internet, intentar enviar
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, data: data })
        });
        const result = await response.json();
        return result;
    } catch (e) {
        console.error("Fallo de red:", e);
        // Si falla la red en pleno envío, guardar en cola también
        if (action !== 'obtenerDatosCompletos') {
            await db.queue.add({ action: action, data: data, timestamp: Date.now() });
            showToast("Red inestable. Guardado en cola.", "warning");
            return { exito: true, offline: true };
        }
        return { exito: false, error: e.toString() };
    }
}

// --- PROCESADOR DE COLA (SYNC) ---
async function processQueue() {
    const count = await db.queue.count();
    if (count === 0) return;

    showToast(`Sincronizando ${count} cambios pendientes...`, "info");
    const items = await db.queue.toArray();

    for (const item of items) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: item.action, data: item.data })
            });
            const json = await res.json();
            if (json.exito) {
                await db.queue.delete(item.id); // Borrar si tuvo éxito
            }
        } catch (e) {
            console.log("Reintento fallido, sigue en cola");
        }
    }
    
    const remaining = await db.queue.count();
    if(remaining === 0) {
        showToast("¡Todo sincronizado!", "success");
        loadData(); // Refrescar datos reales
    }
}

// --- COMPRESOR DE IMÁGENES (EVITA ERRORES DE TAMAÑO) ---
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

window.onload = function() {
  myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
  myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  myModalWA = new bootstrap.Modal(document.getElementById('modalWA'));
  myModalProv = new bootstrap.Modal(document.getElementById('modalProv'));
  myModalPed = new bootstrap.Modal(document.getElementById('modalPed'));
  myModalEditPed = new bootstrap.Modal(document.getElementById('modalEditPed'));
  
  var tplEl = document.getElementById('tpl-cart');
  if(tplEl) {
      var tpl = tplEl.innerHTML;
      document.getElementById('desktop-cart-container').innerHTML = tpl;
      document.getElementById('mobile-cart').innerHTML = tpl;

      document.querySelectorAll('#c-inicial').forEach(el => {
           el.removeAttribute('disabled');
           el.style.background = '#fff'; 
           el.oninput = calcCart;        
      });
  }
  
  updateStatus();
  loadData();
};

// --- CARGA DE DATOS (ESTRATEGIA CACHE-THEN-NETWORK) ---
async function loadData() {
    var loader = document.getElementById('loader');
    if(loader) loader.style.display='flex';

    // 1. Mostrar lo local INMEDIATAMENTE (Velocidad)
    const localData = await db.kv.get('full_data');
    if (localData) {
        console.log("Cargando desde IndexedDB local...");
        renderData(localData);
        if(loader) loader.style.display='none'; // Quitar loader ya
    }

    // 2. Buscar actualización en la nube (Segundo plano)
    if (navigator.onLine) {
        try {
            const res = await callAPI('obtenerDatosCompletos');
            if (res && res.inventario) {
                // Guardar en DB Local para la próxima
                await db.kv.put(res, 'full_data');
                console.log("Datos actualizados desde Nube");
                renderData(res); // Refrescar vista con lo nuevo
            }
        } catch (e) {
            console.log("No se pudo actualizar, manteniendo versión local.");
        }
    }
    
    // Asegurar que el loader se quite si no había datos locales
    if (!localData && loader) loader.style.display='none';
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
        const uDisp = document.getElementById('user-display');
        if(uDisp) uDisp.innerText = res.user || "Usuario";
        
        const balC = document.getElementById('bal-caja');
        if(balC) balC.innerText = COP.format(res.metricas.saldo||0);
        
        const balV = document.getElementById('bal-ventas');
        if(balV) balV.innerText = COP.format(res.metricas.ventaMes||0);
        
        const balG = document.getElementById('bal-ganancia');
        if(balG) balG.innerText = COP.format(res.metricas.gananciaMes||0);
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
        sg.innerHTML = '<option value="">-- Ninguna --</option>';
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

function renderPos(){
  var searchInp = document.getElementById('pos-search');
  if(!searchInp) return;
  var q = searchInp.value.toLowerCase().trim();
  var c = document.getElementById('pos-list'); 
  var placeholder = document.getElementById('pos-placeholder');
  c.innerHTML='';
  
  if(!q) {
      if(placeholder) placeholder.style.display = 'block';
      return;
  }
  if(placeholder) placeholder.style.display = 'none';

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
   if(btnFloat) {
       btnFloat.style.display = count > 0 ? 'block' : 'none';
       btnFloat.innerText = "🛒 " + count;
   }
   
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

   var names = CART.map(x=>x.nombre
