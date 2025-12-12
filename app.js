// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// debe terminar en /exec
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbza8m9l6c_RS-3GJArGDHLwBbfkIiWGA1lbBL3yPoBdsYOPG03p7TQ4qrit61vsim5Y/exec"; 

var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed;
var prodEdit = null;
var calculatedValues = { total: 0, inicial: 0 };

// --- UTILIDAD DE FORMATO COLOMBIA ---
const COP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

async function callAPI(action, data = null) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, data: data })
    });
    const result = await response.json();
    return result;
  } catch (e) {
    console.error("Error API:", e);
    alert("Error de conexión. Revisa tu internet.");
    return { exito: false, error: e.toString() };
  }
}

window.onload = function() {
  myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
  myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  myModalWA = new bootstrap.Modal(document.getElementById('modalWA'));
  myModalProv = new bootstrap.Modal(document.getElementById('modalProv'));
  myModalPed = new bootstrap.Modal(document.getElementById('modalPed'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;
  
  // --- PERSISTENCIA DE VISTA ---
  var lastView = localStorage.getItem('lastView') || 'pos';
  var btn = document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`);
  if(btn) nav(lastView, btn);
  else nav('pos', document.querySelector('.nav-btn'));

  loadData();
};

function loadData(){
  callAPI('obtenerDatosCompletos').then(res => {
    D = res;
    
    D.inv = res.inventario || [];
    D.historial = res.historial || []; 
    D.proveedores = res.proveedores || [];
    D.ultimasVentas = res.ultimasVentas || []; 
    D.ped = res.pedidos || [];
    D.deudores = res.deudores || [];

    document.getElementById('loader').style.display='none';
    
    if(res.metricas) {
        document.getElementById('user-display').innerText = res.user;
        document.getElementById('bal-caja').innerText = COP.format(res.metricas.saldo||0);
        document.getElementById('bal-ventas').innerText = COP.format(res.metricas.ventaMes||0);
        document.getElementById('bal-ganancia').innerText = COP.format(res.metricas.gananciaMes||0);
    }
    
    renderPos(); 
    renderInv(); 
    renderFin(); 
    renderPed();
    renderProvs();
    
    // Categorias
    var dl = document.getElementById('list-cats'); dl.innerHTML='';
    (res.categorias || []).forEach(c => { var o=document.createElement('option'); o.value=c; dl.appendChild(o); });
    
    // NUEVO: Autocompletar Productos en Pedidos
    var dlp = document.getElementById('list-prods-all'); 
    if(dlp) {
        dlp.innerHTML = '';
        (D.inv || []).forEach(p => { 
            var o=document.createElement('option'); 
            o.value=p.nombre; 
            dlp.appendChild(o); 
        });
    }

    updateGastosSelect();
  });
}

function updateGastosSelect() {
    var sg = document.getElementById('g-vinculo');
    if(sg) {
        sg.innerHTML = '<option value="">-- Ninguna (Gasto General) --</option>';
        if (D.ultimasVentas && D.ultimasVentas.length > 0) {
            D.ultimasVentas.forEach(v => {
                var o = document.createElement('option');
                o.value = v.id;
                o.text = v.desc;
                sg.appendChild(o);
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

function renderPos(){
  var q = document.getElementById('pos-search').value.toLowerCase();
  var c = document.getElementById('pos-list'); c.innerHTML='';
  var lista = D.inv || [];
  var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
  if(res.length === 0) document.getElementById('msg-empty-pos').style.display = 'block';
  else document.getElementById('msg-empty-pos').style.display = 'none';

  res.slice(0,40).forEach(p => {
    var active = CART.some(x=>x.id===p.id) ? 'active' : '';
    var src = (p.foto && p.foto.includes('http')) ? p.foto.replace('view','thumbnail') : '';
    var img = src ? `<img src="${src}" class="product-thumb">` : `<div class="product-thumb">📷</div>`;
    var priceTxt = p.costo > 0 ? COP.format(p.costo) : '<small class="text-danger">Consultar</small>';
    var div = document.createElement('div');
    div.className = `card-product d-flex align-items-center ${active}`;
    div.onclick = function() { toggleCart(p, div); };
    div.innerHTML = `<div class="check-mark">✓</div>${img}<div class="flex-grow-1" style="min-width:0;"><div class="fw-bold text-dark lh-1 mb-1 text-truncate">${p.nombre}</div><small class="text-muted d-block text-truncate">${p.prov}</small><div class="price-tag mt-1">${priceTxt}</div></div>`;
    c.appendChild(div);
  });
}

function toggleCart(p, el) {
   var idx = CART.findIndex(x=>x.id===p.id);
   if(idx > -1) { CART.splice(idx,1); el.classList.remove('active'); }
   else { CART.push(p); el.classList.add('active'); }
   updateCartUI();
}

function updateCartUI() {
   var count = CART.length;
   calcCart();
   var btnFloat = document.getElementById('btn-float-cart');
   btnFloat.style.display = count > 0 ? 'block' : 'none';
   btnFloat.innerText = "🛒 " + count;
   var names = CART.map(x=>x.nombre).join(', ');
   document.querySelectorAll('#cart-items-list').forEach(e => e.innerText = names || 'Selecciona productos...');
}

function toggleManual() {
    var isManual = document.querySelector('#c-manual').checked;
    var inpTotal = document.querySelector('#res-cont-input');
    var txtTotal = document.querySelector('#res-cont');
    var inpUtil = document.querySelector('#c-util');
    if(isManual) { inpTotal.style.display = 'inline-block'; txtTotal.style.display = 'none'; inpUtil.disabled = true; } 
    else { inpTotal.style.display = 'none'; txtTotal.style.display = 'inline-block'; inpUtil.disabled = false; }
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
       var totalCosto = CART.reduce((a,b)=>a+b.costo,0);
       base = totalCosto * (1 + util/100);
       if(conIva) base = base * 1.19;
       document.querySelectorAll('#res-cont').forEach(e => e.innerText = COP.format(Math.round(base)));
       document.querySelectorAll('#res-cont-input').forEach(e => e.value = Math.round(base));
   }
   calculatedValues.total = base;
   var rowCred = parent.querySelectorAll('#row-cred'); var inpInicial = parent.querySelectorAll('#c-inicial');
   if(metodo === "Crédito") {
       var inicial = base * 0.30; calculatedValues.inicial = inicial;
       var saldoRestante = base - inicial; var saldoConInteres = saldoRestante * (1 + inter/100); var valorCuota = saldoConInteres / cuotas;
       rowCred.forEach(e => { 
           e.style.display = 'block'; 
           e.querySelector('#res-ini').innerText = COP.format(Math.round(inicial)); 
           e.querySelector('#res-cuota-val').innerText = COP.format(Math.round(valorCuota)); 
           e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} cuotas`; 
       });
       inpInicial.forEach(e => { e.value = Math.round(inicial); e.style.display='block'; });
   } else { rowCred.forEach(e => e.style.display = 'none'); inpInicial.forEach(e => e.style.display='none'); }
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
   if(calculatedValues.total <= 0) return alert("Precio 0 no permitido");
   var factor = calculatedValues.total / CART.reduce((a,b)=>a+b.costo,0);
   var d = { items: CART.map(p => ({ nombre: p.nombre, cat: p.cat, costo: p.costo, precioVenta: p.costo * factor })), cliente: cli, metodo: metodo, inicial: (metodo === 'Crédito') ? calculatedValues.inicial : 0, vendedor: D.user };
   document.getElementById('loader').style.display='flex';
   callAPI('procesarVentaCarrito', d).then(r => { if(r.exito) { location.reload(); } else { alert(r.error); document.getElementById('loader').style.display='none'; } });
}

function abrirModalProv() { renderProvs(); myModalProv.show(); }
function abrirModalNuevo() { document.getElementById('new-id').value=''; myModalNuevo.show(); }
function abrirModalWA() { myModalWA.show(); }
function abrirModalPed() { myModalPed.show(); }
function openEdit(p) { 
    prodEdit=p; 
    document.getElementById('inp-edit-nombre').value=p.nombre; 
    document.getElementById('inp-edit-categoria').value=p.cat; 
    document.getElementById('inp-edit-costo').value=p.costo; 
    document.getElementById('inp-edit-proveedor').value=p.prov; 
    document.getElementById('inp-edit-desc').value=p.desc; 
    document.getElementById('img-preview-box').style.display='none'; 
    if(p.foto){document.getElementById('img-preview-box').src=p.foto.replace('view','thumbnail');document.getElementById('img-preview-box').style.display='block';} 
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
function renderInv(){ var c=document.getElementById('inv-list');c.innerHTML=''; (D.inv||[]).forEach(p=>{c.innerHTML+=`<div class="card-k d-flex justify-content-between align-items-center" onclick='openEdit(${JSON.stringify(p)})'><div><strong>${p.nombre}</strong><br><small>${p.cat}</small></div><button class="btn btn-sm btn-light border">✏️</button></div>`}); }
function previewFile(){ var f=document.getElementById('inp-file-foto').files[0]; if(f){var r=new FileReader();r.onload=e=>{document.getElementById('img-preview-box').src=e.target.result;document.getElementById('img-preview-box').style.display='block';};r.readAsDataURL(f);} }
function guardarCambiosAvanzado(){
   if(!prodEdit) return; var btn=document.querySelector('#modalEdicion .btn-dark'); var txt=btn.innerText;
   var d={id:prodEdit.id, nombre:document.getElementById('inp-edit-nombre').value, categoria:document.getElementById('inp-edit-categoria').value, proveedor:document.getElementById('inp-edit-proveedor').value, costo:document.getElementById('inp-edit-costo').value, descripcion:document.getElementById('inp-edit-desc').value, urlExistente:prodEdit.foto||""};
   var f=document.getElementById('inp-file-foto').files[0];
   var send=function(b64){ d.imagenBase64=b64; if(f){d.mimeType=f.type;d.nombreArchivo=f.name;} callAPI('guardarProductoAvanzado', d).then(r=>{btn.innerText=txt;btn.disabled=false;if(r.exito){myModalEdit.hide();location.reload();}else alert(r.error)}); };
   if(f){ btn.innerText="Subiendo...";btn.disabled=true; var r=new FileReader(); r.onload=e=>send(e.target.result.split(',')[1]); r.readAsDataURL(f); } else { send(); }
}
function eliminarProductoActual(){ if(confirm("Eliminar?")){ callAPI('eliminarProductoBackend', prodEdit.id).then(r=>{if(r.exito)location.reload()}); } }
function generarIDAuto(){ var c=document.getElementById('new-categoria').value; if(c)document.getElementById('new-id').value=c.substring(0,3).toUpperCase()+'-'+Math.floor(Math.random()*9999); }
function crearProducto(){ var d={nombre:document.getElementById('new-nombre').value, categoria:document.getElementById('new-categoria').value, proveedor:document.getElementById('new-proveedor').value, costo:document.getElementById('new-costo').value, id:document.getElementById('new-id').value||'GEN-'+Math.random()}; callAPI('crearProductoManual', d).then(r=>{if(r.exito){myModalNuevo.hide();location.reload();}}); }
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
function doGasto(){ 
    var desc = document.getElementById('g-desc').value; var monto = document.getElementById('g-monto').value;
    if(!desc || !monto) return alert("Falta descripción o monto");
    var d={ desc: desc, cat: document.getElementById('g-cat').value, monto: monto, vinculo: document.getElementById('g-vinculo').value }; 
    document.getElementById('loader').style.display='flex'; callAPI('registrarGasto', d).then(()=>location.reload()); 
}

// --- LOGICA DE PEDIDOS MEJORADA ---
function renderPed(){ 
    var c=document.getElementById('ped-list'); c.innerHTML=''; 
    (D.ped || []).forEach(p=>{ 
        var isPend = p.estado === 'Pendiente';
        var btnAction = isPend 
           ? `<button class="btn btn-sm btn-outline-success w-100 mt-2" onclick="comprarPedido('${p.id}', '${p.prod}')">✅ Comprar</button>` 
           : `<div class="badge bg-success mt-2 d-block">Comprado</div>`;
        
        c.innerHTML+=`<div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}">
           <div class="d-flex justify-content-between">
              <div><strong>${p.prod}</strong><br><small class="text-muted">${p.prov || 'Sin Prov.'}</small></div>
              <div class="text-end"><small>${p.fecha}</small><br><span class="badge ${isPend?'bg-warning text-dark':'bg-success'}">${p.estado}</span></div>
           </div>
           ${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}
           ${btnAction}
        </div>`;
    }); 
}

function savePed(){ 
    var p=document.getElementById('pe-prod').value; 
    if(!p) return alert("Escribe un producto");
    
    var d = {
        user: D.user, 
        prod: p, 
        prov: document.getElementById('pe-prov').value,
        costoEst: document.getElementById('pe-costo').value,
        notas: document.getElementById('pe-nota').value
    };
    
    document.getElementById('loader').style.display='flex';
    callAPI('guardarPedido', d).then(()=>location.reload()); 
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
        inputValidator: (value) => {
            if (!value || value <= 0) return 'Debes ingresar un costo válido para registrar el gasto.';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('loader').style.display = 'flex';
            callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => {
                 if(r.exito) {
                     Swal.fire('¡Éxito!', 'Gasto registrado e inventario actualizado.', 'success').then(() => location.reload());
                 } else {
                     alert(r.error);
                     document.getElementById('loader').style.display = 'none';
                 }
            });
        }
    });
}

function verBancos() { const num = "0090894825"; Swal.fire({title:'Bancolombia',text:num,icon:'info',confirmButtonText:'Copiar'}).then((r)=>{if(r.isConfirmed)navigator.clipboard.writeText(num)}); }
