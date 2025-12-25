// ============================================
// ⚠️ PEGA AQUÍ LA URL DE TU IMPLEMENTACIÓN WEB
// debe terminar en /exec
// ============================================
const API_URL = "https://script.google.com/macros/s/AKfycbza8m9l6c_RS-3GJArGDHLwBbfkIiWGA1lbBL3yPoBdsYOPG03p7TQ4qrit61vsim5Y/exec"; 

var D = {inv:[], provs:[], deud:[], ped:[], hist:[], cats:[], proveedores:[], ultimasVentas:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalWA, myModalProv, myModalPed, myModalEditPed;
var prodEdit = null;
var pedEditId = null; 
var calculatedValues = { total: 0, inicial: 0 };

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
  myModalEditPed = new bootstrap.Modal(document.getElementById('modalEditPed'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;
  
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
    
    var dl = document.getElementById('list-cats'); if(dl) { dl.innerHTML=''; (res.categorias || []).forEach(c => { var o=document.createElement('option'); o.value=c; dl.appendChild(o); }); }
    
    var dlp = document.querySelectorAll('#list-prods-all'); 
    dlp.forEach(list => {
        list.innerHTML = '';
        (D.inv || []).forEach(p => { 
            var o=document.createElement('option'); 
            o.value=p.nombre; 
            list.appendChild(o); 
        });
    });

    var editCat = document.getElementById('inp-edit-categoria');
    if(editCat){
        editCat.innerHTML = '';
        (res.categorias || []).forEach(c => {
            var o = document.createElement('option');
            o.value = c; o.text = c;
            editCat.appendChild(o);
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

function fixDriveLink(url) {
    if (!url) return "";
    if (url.includes("drive.google.com") && url.includes("id=")) {
        var m = url.match(/id=([a-zA-Z0-9_-]+)/);
        if (m && m[1]) {
            return "http://lh3.googleusercontent.com/d/" + m[1];
        }
    }
    return url;
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
    
    var fixedUrl = fixDriveLink(p.foto);
    var src = (fixedUrl && fixedUrl.length > 10) ? fixedUrl : '';
    var img = src ? `<img src="${src}" class="product-thumb">` : `<div class="product-thumb">📷</div>`;
    
    var precioDisplay = p.publico > 0 ? `<span class="text-success">${COP.format(p.publico)}</span>` : `<span class="text-muted small">Costo: ${COP.format(p.costo)}</span>`;
    
    var div = document.createElement('div');
    div.className = `card-product d-flex align-items-center ${active}`;
    div.onclick = function() { toggleCart(p, div); };
    div.innerHTML = `<div class="check-mark">✓</div>${img}<div class="flex-grow-1" style="min-width:0;"><div class="fw-bold text-dark lh-1 mb-1 text-truncate">${p.nombre}</div><small class="text-muted d-block text-truncate">${p.prov}</small><div class="price-tag mt-1">${precioDisplay}</div></div>`;
    c.appendChild(div);
  });
}

function toggleCart(p, el) {
   var precioBase = p.publico > 0 ? p.publico : p.costo;
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
       base = CART.reduce((acc, item) => {
           if(item.publico > 0) return acc + item.publico; 
           return acc + (item.costo * (1 + util/100)); 
       }, 0);

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
   
   var totalCostoRef = CART.reduce((a,b)=>a+(b.publico>0?b.publico:b.costo),0); 
   var factor = calculatedValues.total / totalCostoRef; 
   if(isNaN(factor)) factor = 1;

   var itemsData = CART.map(p => {
       var baseItem = p.publico > 0 ? p.publico : p.costo;
       var peso = baseItem / CART.reduce((a,b)=>a+(b.publico>0?b.publico:b.costo),0);
       return { 
           nombre: p.nombre, 
           cat: p.cat, 
           costo: p.costo, 
           precioVenta: calculatedValues.total * peso 
       };
   });

   var d = { items: itemsData, cliente: cli, metodo: metodo, inicial: (metodo === 'Crédito') ? calculatedValues.inicial : 0, vendedor: D.user };
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
    document.getElementById('inp-edit-publico').value=p.publico || 0; 
    document.getElementById('inp-edit-proveedor').value=p.prov; 
    document.getElementById('inp-edit-desc').value=p.desc; 
    
    // CARGAR CHECKBOX WEB
    document.getElementById('inp-edit-web').checked = p.enWeb || false;

    // RESET INPUT FOTO
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

function renderInv(){ 
    var q = document.getElementById('inv-search').value.toLowerCase().trim(); 
    var c=document.getElementById('inv-list');
    c.innerHTML=''; 
    
    var lista = D.inv || [];
    if(q) {
        lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }

    lista.slice(0, 50).forEach(p=>{
        var descEncoded = encodeURIComponent(p.desc || "");
        
        var btnsCopy = `
        <div class="d-flex gap-1 mt-2">
            <button class="btn btn-xs btn-outline-secondary" onclick="copiarDato('${p.id}')" title="Copiar ID"><i class="fas fa-barcode"></i></button>
            <button class="btn btn-xs btn-outline-secondary" onclick="copiarDato('${p.nombre}')" title="Copiar Nombre"><i class="fas fa-tag"></i></button>
            <button class="btn btn-xs btn-outline-secondary" onclick="copiarDato(decodeURIComponent('${descEncoded}'))" title="Copiar Desc"><i class="fas fa-align-left"></i></button>
            <button class="btn btn-xs btn-outline-success fw-bold" onclick="copiarDato('${p.publico}')" title="Copiar Precio Web">$</button>
        </div>`;

        var publicoHtml = p.publico > 0 ? `<div class="text-success fw-bold">P.Público: ${COP.format(p.publico)}</div>` : `<div class="text-muted small">Sin precio público</div>`;
        var webStatus = p.enWeb ? '<span class="badge bg-primary ms-1"><i class="fas fa-globe"></i></span>' : '';

        c.innerHTML+=`
        <div class="card-k">
            <div class="d-flex justify-content-between align-items-start" onclick='openEdit(${JSON.stringify(p)})'>
                <div>
                    <strong>${p.nombre}</strong>${webStatus}<br>
                    <small class="text-muted">${p.cat} | Costo: ${COP.format(p.costo)}</small>
                    ${publicoHtml}
                </div>
                <button class="btn btn-sm btn-light border">✏️</button>
            </div>
            ${btnsCopy}
        </div>`;
    }); 
}

function copiarDato(txt) {
    if(!txt || txt === 'undefined' || txt === '0') return alert("Dato vacío o no disponible");
    navigator.clipboard.writeText(txt).then(() => {
        const el = document.createElement('div');
        el.innerText = "Copiado: " + txt.substring(0,20) + "...";
        el.style.position = 'fixed'; el.style.bottom = '20px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)';
        el.style.background = '#333'; el.style.color = '#fff'; el.style.padding = '5px 10px'; el.style.borderRadius = '5px'; el.style.zIndex = 3000;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    });
}

function previewFile(){ var f=document.getElementById('inp-file-foto').files[0]; if(f){var r=new FileReader();r.onload=e=>{document.getElementById('img-preview-box').src=e.target.result;document.getElementById('img-preview-box').style.display='block';};r.readAsDataURL(f);} }

function guardarCambiosAvanzado(){
   if(!prodEdit) return; var btn=document.querySelector('#modalEdicion .btn-dark'); var txt=btn.innerText;
   var d={
       id:prodEdit.id, 
       nombre:document.getElementById('inp-edit-nombre').value, 
       categoria:document.getElementById('inp-edit-categoria').value, 
       proveedor:document.getElementById('inp-edit-proveedor').value, 
       costo:document.getElementById('inp-edit-costo').value, 
       publico:document.getElementById('inp-edit-publico').value, 
       descripcion:document.getElementById('inp-edit-desc').value, 
       urlExistente:prodEdit.foto||"",
       enWeb: document.getElementById('inp-edit-web').checked
   };
   
   var f=document.getElementById('inp-file-foto').files[0];
   
   var send=function(b64){ 
       if(b64) d.imagenBase64=b64; 
       if(f){d.mimeType=f.type;d.nombreArchivo=f.name;} 
       
       callAPI('guardarProductoAvanzado', d).then(r=>{
           btn.innerText=txt; btn.disabled=false;
           if(r.exito){ myModalEdit.hide(); location.reload(); }
           else alert(r.error)
       }); 
   };

   if(f){ 
       btn.innerText="Subiendo..."; btn.disabled=true; 
       var r=new FileReader(); 
       r.onload=e=>send(e.target.result.split(',')[1]); 
       r.readAsDataURL(f); 
   } else { 
       send(null); 
   }
}

function eliminarProductoActual(){ if(confirm("Eliminar?")){ callAPI('eliminarProductoBackend', prodEdit.id).then(r=>{if(r.exito)location.reload()}); } }
function generarIDAuto(){ var c=document.getElementById('new-categoria').value; if(c)document.getElementById('new-id').value=c.substring(0,3).toUpperCase()+'-'+Math.floor(Math.random()*9999); }
function crearProducto(){ 
    var d={
        nombre:document.getElementById('new-nombre').value, 
        categoria:document.getElementById('new-categoria').value, 
        proveedor:document.getElementById('new-proveedor').value, 
        costo:document.getElementById('new-costo').value, 
        publico:document.getElementById('new-publico').value, 
        id:document.getElementById('new-id').value||'GEN-'+Math.random()
    }; 
    callAPI('crearProductoManual', d).then(r=>{if(r.exito){myModalNuevo.hide();location.reload();}}); 
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
        
        var controls = isPend 
           ? `<div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm btn-outline-secondary flex-fill" onclick='openEditPed(${JSON.stringify(p)})'>✏️ Editar</button>
                <button class="btn btn-sm btn-outline-danger flex-fill" onclick="delPed('${p.id}')">🗑️</button>
              </div>
              <button class="btn btn-sm btn-outline-success w-100 mt-2" onclick="comprarPedido('${p.id}', '${p.prod}')">✅ Comprar</button>` 
           : `<div class="badge bg-success mt-2 d-block w-100">Comprado</div>`;
        
        c.innerHTML+=`<div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}">
           <div class="d-flex justify-content-between">
              <div><strong>${p.prod}</strong><br><small class="text-muted">${p.prov || 'Sin Prov.'}</small></div>
              <div class="text-end"><small>${p.fecha}</small><br><span class="badge ${isPend?'bg-warning text-dark':'bg-success'}">${p.estado}</span></div>
           </div>
           ${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}
           ${controls}
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
    var d = {
        id: pedEditId,
        prod: document.getElementById('ed-ped-prod').value,
        prov: document.getElementById('ed-ped-prov').value,
        costoEst: document.getElementById('ed-ped-costo').value,
        notas: document.getElementById('ed-ped-nota').value
    };
    document.getElementById('loader').style.display='flex';
    callAPI('editarPedido', d).then(r => {
        if(r.exito) location.reload();
        else { alert(r.error); document.getElementById('loader').style.display='none'; }
    });
}

function delPed(id) {
    Swal.fire({
        title: '¿Eliminar Pedido?',
        text: "No podrás deshacer esta acción.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('loader').style.display='flex';
            callAPI('eliminarPedido', id).then(r => {
                if(r.exito) location.reload();
                else { alert(r.error); document.getElementById('loader').style.display='none'; }
            });
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
