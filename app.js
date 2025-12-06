// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// debe terminar en /exec
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbza8m9l6c_RS-3GJArGDHLwBbfkIiWGA1lbBL3yPoBdsYOPG03p7TQ4qrit61vsim5Y/exec"; 
var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
// Variables globales para modales
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed;
var prodEdit = null;
var calculatedValues = { total: 0, inicial: 0 };

async function callAPI(action, data = null) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, data: data })
    });
    const result = await response.json();
    return result;
  } catch (e) {
    alert("Error de conexión: " + e.toString());
    return { exito: false, error: e.toString() };
  }
}

window.onload = function() {
  // Inicialización de Modales
  myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
  myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  myModalWA = new bootstrap.Modal(document.getElementById('modalWA'));
  myModalProv = new bootstrap.Modal(document.getElementById('modalProv'));
  myModalPed = new bootstrap.Modal(document.getElementById('modalPed'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;
  
  loadData();
};

function loadData(){
  callAPI('obtenerDatosCompletos').then(res => {
    D = res;
    D.inv = res.inventario || [];
    D.historial = res.historial || []; 
    D.proveedores = res.proveedores || [];
    D.ultimasVentas = res.ultimasVentas || []; // Recibimos la lista garantizada
    
    document.getElementById('loader').style.display='none';
    document.getElementById('user-display').innerText = res.user;
    document.getElementById('bal-caja').innerText = '$'+res.metricas.saldo.toLocaleString();
    document.getElementById('bal-ventas').innerText = '$'+res.metricas.ventaMes.toLocaleString();
    document.getElementById('bal-ganancia').innerText = '$'+res.metricas.gananciaMes.toLocaleString();
    
    renderPos(); renderInv(); renderFin(); renderPed(); renderProvs();
    
    var dl = document.getElementById('list-cats'); dl.innerHTML='';
    res.categorias.forEach(c => { var o=document.createElement('option'); o.value=c; dl.appendChild(o); });

    // LLAMADO A LA FUNCIÓN DE VINCULACIÓN
    updateGastosSelect();
  });
}

function updateGastosSelect() {
    var sg = document.getElementById('g-vinculo');
    if(sg) {
        // Limpiamos y dejamos la opción por defecto
        sg.innerHTML = '<option value="">-- Ninguna --</option>';
        
        // Llenamos con la data garantizada del backend
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
  btn.classList.add('active');
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
    var priceTxt = p.costo > 0 ? `$${p.costo.toLocaleString()}` : '<small class="text-danger">Consultar</small>';
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
   if(CART.length===0) { document.querySelectorAll('#res-cont').forEach(e => e.innerText = '$0'); return; }
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
       document.querySelectorAll('#res-cont').forEach(e => e.innerText = '$'+Math.round(base).toLocaleString());
       document.querySelectorAll('#res-cont-input').forEach(e => e.value = Math.round(base));
   }
   calculatedValues.total = base;
   var rowCred = parent.querySelectorAll('#row-cred'); var inpInicial = parent.querySelectorAll('#c-inicial');
   if(metodo === "Crédito") {
       var inicial = base * 0.30; calculatedValues.inicial = inicial;
       var saldoRestante = base - inicial; var saldoConInteres = saldoRestante * (1 + inter/100); var valorCuota = saldoConInteres / cuotas;
       rowCred.forEach(e => { e.style.display = 'block'; e.querySelector('#res-ini').innerText = '$'+Math.round(inicial).toLocaleString(); e.querySelector('#res-cuota-val').innerText = '$'+Math.round(valorCuota).toLocaleString(); e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} cuotas`; });
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

// --- FUNCIONES DE MODALES ---
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
  var s=document.getElementById('ab-cli'); s.innerHTML='<option value="">Seleccione...</option>'; D.deudores.forEach(d=>{ s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} ($${d.saldo.toLocaleString()})</option>`; });
  var h=document.getElementById('hist-list'); h.innerHTML=''; 
  var dataHist = D.historial || []; if(dataHist.length === 0) { h.innerHTML = '<div class="text-center text-muted p-3">Sin movimientos registrados.</div>'; } 
  else { dataHist.forEach(x=>{ var i=(x.tipo.includes('ingreso')||x.tipo.includes('abono')); h.innerHTML+=`<div class="mov-item d-flex align-items-center mb-2 p-2 border-bottom"><div class="mov-icon me-3 ${i?'text-success':'text-danger'}"><i class="fas fa-${i?'arrow-down':'arrow-up'}"></i></div><div class="flex-grow-1 lh-1"><div class="fw-bold small">${x.desc}</div><small class="text-muted" style="font-size:0.75rem">${x.fecha}</small></div><div class="fw-bold ${i?'text-success':'text-danger'}">${i?'+':'-'} $${x.monto.toLocaleString()}</div></div>`; }); }
}
function doAbono(){ var id=document.getElementById('ab-cli').value; if(!id)return; var txt=document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text; var cli=txt.split('(')[0].trim(); document.getElementById('loader').style.display='flex'; callAPI('registrarAbono', {idVenta:id, monto:document.getElementById('ab-monto').value, cliente:cli}).then(()=>location.reload()); }
function doGasto(){ var d={desc:document.getElementById('g-desc').value, cat:document.getElementById('g-cat').value, monto:document.getElementById('g-monto').value, vinculo:document.getElementById('g-vinculo').value}; document.getElementById('loader').style.display='flex'; callAPI('registrarGasto', d).then(()=>location.reload()); }
function renderPed(){ var c=document.getElementById('ped-list'); c.innerHTML=''; D.ped.forEach(p=>{ c.innerHTML+=`<div class="card-k border-start border-4 ${p.estado==='Pendiente'?'border-warning':'border-success'}"><strong>${p.prod}</strong><br><small>${p.user} - ${p.fecha}</small></div>`}); }
function savePed(){ var p=document.getElementById('pe-prod').value; if(!p)return; callAPI('guardarPedido', {user:D.user, prod:p, notas:document.getElementById('pe-nota').value}).then(()=>location.reload()); }
function verBancos() { const num = "0090894825"; Swal.fire({title:'Bancolombia',text:num,icon:'info',confirmButtonText:'Copiar'}).then((r)=>{if(r.isConfirmed)navigator.clipboard.writeText(num)}); }
