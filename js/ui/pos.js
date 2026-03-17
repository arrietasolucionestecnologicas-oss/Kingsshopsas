/*
================================================================================
MODO 2 — MODIFICACIÓN ESTRUCTURAL 
ARCHIVO: js/ui/pos.js (Motor de Venta, Carrito, y Cotizaciones) - CORREGIDO (KING'S SHOP)
================================================================================
*/

function renderPos(){
  var searchEl = document.getElementById('pos-search');
  var placeholder = document.getElementById('pos-placeholder');
  var c = document.getElementById('pos-list'); 
  if(!searchEl || !placeholder || !c) return;
  
  var q = searchEl.value.toLowerCase().trim();
  c.innerHTML='';
  
  if(!q) { placeholder.style.display = 'block'; return; }
  placeholder.style.display = 'none';

  var lista = window.D.inv || [];
  var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
  
  if(res.length === 0) { c.innerHTML = '<div class="text-center text-muted py-3">No encontrado</div>'; return; }

  res.slice(0,20).forEach(p => {
    var active = window.CART.some(x=>x.id===p.id) ? 'active' : '';
    var precioDisplay = p.publico > 0 ? window.COP.format(p.publico) : `<span class="text-muted small">Costo: ${window.COP.format(p.costo)}</span>`;
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
   var idx = window.CART.findIndex(x=>x.id===p.id);
   if(idx > -1) { 
       window.CART.splice(idx,1); 
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
       
       window.CART.push(item); 
       if(el) el.classList.add('active'); 
   }
   updateCartUI();
}

function agregarAlCarritoDesdeInv(id) {
    var p = window.D.inv.find(x => x.id === id);
    if (!p) {
        if(window.showToast) window.showToast("Producto no encontrado", "danger");
        return;
    }
    
    var idx = window.CART.findIndex(x => x.id === p.id);
    if (idx > -1) { 
        window.CART[idx].cantidad++; 
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
        window.CART.push(item); 
    }
    
    updateCartUI();
    if(window.showToast) window.showToast("🛍️ Agregado al carrito: " + p.nombre, "success");
}

function abrirEditorItem(id) {
    var item = window.CART.find(x => x.id === id);
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
    if(window.myModalEditItem) window.myModalEditItem.show();
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
    
    document.getElementById('edit-item-total').innerText = window.COP.format(Math.round(precioNeto));
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
    var item = window.CART.find(x => x.id === id);
    if (item) {
        item.nombre = document.getElementById('edit-item-nombre').value;
        item.margenIndividual = parseFloat(document.getElementById('edit-item-margen').value) || 0;
        item.descuentoIndividual = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
        item.conIva = document.getElementById('edit-item-iva').checked;
        item.modificadoManualmente = true; 
    }
    if(window.myModalEditItem) window.myModalEditItem.hide();
    updateCartUI(true);
}

function toggleItemIva(id) {
    var item = window.CART.find(x => x.id === id);
    if (item) {
        item.conIva = !item.conIva;
        updateCartUI();
    }
}

function changeQty(id, delta) {
    var item = window.CART.find(x => x.id === id);
    if (item) {
        item.cantidad += delta;
        if (item.cantidad <= 0) {
            var idx = window.CART.findIndex(x => x.id === id);
            window.CART.splice(idx, 1);
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

    window.CART.push({
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
   var count = window.CART.reduce((acc, item) => acc + (item.cantidad || 1), 0);
   
   var btnFloat = document.getElementById('btn-float-cart');
   if(btnFloat) {
       btnFloat.style.display = count > 0 ? 'block' : 'none';
       btnFloat.innerText = "🛒 " + count;
   }
   
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart') && document.getElementById('mobile-cart').classList.contains('visible');
   var activeParent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!activeParent) activeParent = document.getElementById('desktop-cart-container'); 
   var isEximir = activeParent && activeParent.querySelector('#c-vip') ? activeParent.querySelector('#c-vip').checked : false;

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
       
       if(window.CART.length === 0) {
           if(inputConcepto) inputConcepto.style.display = 'block';
           parent.querySelectorAll('#cart-items-list').forEach(e => e.style.display = 'none');
       } else {
           if(inputConcepto) { inputConcepto.style.display = 'none'; inputConcepto.value = ''; }
           parent.querySelectorAll('#cart-items-list').forEach(e => e.style.display = 'block');
       }
       
       var metodoLocal = parent.querySelector('#c-metodo') ? parent.querySelector('#c-metodo').value : 'Contado';
       var boxVip = parent.querySelector('#box-vip');
       if(metodoLocal === "Crédito") {
           if(boxVip) boxVip.style.display = 'block';
       } else {
           if(boxVip) boxVip.style.display = 'none';
       }
   });

   if(window.CART.length === 0 && !keepOpen) {
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
   var isEximir = activeParent.querySelector('#c-vip') ? activeParent.querySelector('#c-vip').checked : false;
   
   var baseParaCalculo = 0;
   var totalFinal = 0;
   var descuentoDineroTotal = 0; 

   if (window.CART.length > 0) {
       window.CART.forEach(item => {
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
       
       if (window.CART.length > 0) {
           let totalPrevio = window.CART.reduce((acc, b) => acc + ((b.precioUnitarioFinal||0) * b.cantidad), 0);
           window.CART.forEach(item => {
               let peso = totalPrevio > 0 ? ((item.precioUnitarioFinal||0) * item.cantidad) / totalPrevio : 1 / window.CART.length;
               item.precioUnitarioFinal = (targetVal * peso) / item.cantidad;
           });
       }
   }

   var inpInicial = activeParent.querySelector('#c-inicial');
   var activeEl = document.activeElement;
   var isTypingInicial = (activeEl && activeEl.id === 'c-inicial' && activeParent.contains(activeEl));
   var inicial = 0;
   
   if (isTypingInicial) {
       if (inpInicial && inpInicial.value === "") {
           window.usuarioForzoInicial = false;
           inicial = isEximir ? 0 : Math.round(totalFinal * 0.30);
       } else if (inpInicial) {
           window.usuarioForzoInicial = true;
           inicial = parseFloat(inpInicial.value);
           if(isNaN(inicial)) inicial = 0;
       }
   } else if (window.usuarioForzoInicial && inpInicial && inpInicial.value !== "") {
       inicial = parseFloat(inpInicial.value);
       if(isNaN(inicial)) inicial = 0;
   } else {
       window.usuarioForzoInicial = false;
       inicial = isEximir ? 0 : Math.round(totalFinal * 0.30);
   }
   
   window.calculatedValues.inicial = inicial;
   
   if (!tieneTarget && metodo === "Crédito") {
       var saldoTemp = totalFinal - inicial;
       if(saldoTemp < 0) saldoTemp = 0;
       var interesTotal = saldoTemp * (tasaMensual/100) * cuotas;
       totalFinal = totalFinal + interesTotal;
   }
   
   window.calculatedValues.base = baseParaCalculo; 
   window.calculatedValues.total = totalFinal;
   window.calculatedValues.descuento = descuentoDineroTotal;

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
           if(parent.querySelector('#c-vip') && document.activeElement !== parent.querySelector('#c-vip')) parent.querySelector('#c-vip').checked = isEximir;
       }

       if (window.CART.length > 0) {
           var listContainer = parent.querySelector('#cart-items-list');
           if (listContainer) {
               var html = '';
               window.CART.forEach(x => {
                   var px = x.precioUnitarioFinal || 0;
                   var isLocked = x.modificadoManualmente ? `<i class="fas fa-lock" style="font-size:0.6rem; color:var(--gold);"></i>` : '';
                   html += `
                   <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom">
                       <div class="lh-1" style="flex:1;">
                           <small class="fw-bold" style="color:var(--primary);">${isLocked} ${x.nombre}</small><br>
                           <small class="text-muted">${window.COP.format(Math.round(px))} c/u</small>
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
           if(rowDesc) { rowDesc.style.display = 'block'; if(resDescVal) resDescVal.innerText = "- " + window.COP.format(descuentoDineroTotal); }
       } else {
           if(rowDesc) rowDesc.style.display = 'none';
       }

       var pInpInicial = parent.querySelector('#c-inicial');
       if (parent !== activeParent || !isTypingInicial) {
           if(pInpInicial && pInpInicial.value !== String(inicial)) {
               pInpInicial.value = inicial; 
           }
       }

       var rowCred = parent.querySelectorAll('#row-cred'); 
       var totalText = parent.querySelectorAll('#res-cont');
       var inputTotal = parent.querySelector('#res-cont-input');

       if(metodo === "Crédito") {
           totalText.forEach(e => { e.innerText = window.COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
           if(window.CART.length === 0) { if(inputTotal) inputTotal.style.display = 'inline-block'; } else { if(inputTotal) inputTotal.style.display = 'none'; }

           rowCred.forEach(e => { 
               e.style.display = 'block'; 
               if(e.querySelector('#res-ini')) e.querySelector('#res-ini').innerText = window.COP.format(Math.round(inicial)); 
               if(e.querySelector('#res-cuota-val')) e.querySelector('#res-cuota-val').innerText = window.COP.format(Math.round(valorCuota)); 
               if(e.querySelector('#res-cuota-txt')) e.querySelector('#res-cuota-txt').innerText = `x ${cuotas} mes(es)`; 
           });
           
           if (pInpInicial) {
               pInpInicial.style.display='block'; 
               pInpInicial.disabled = false;
               pInpInicial.style.background = '#fff';
           }
       } else { 
           totalText.forEach(e => { e.innerText = window.COP.format(Math.round(totalFinal)); e.style.display = 'block'; });
           if (window.CART.length === 0) {
               if(inputTotal) inputTotal.style.display = 'inline-block';
               if(isManual) totalText.forEach(e => e.style.display = 'none');
           } else { if(inputTotal) inputTotal.style.display = 'none'; }
           
           rowCred.forEach(e => e.style.display = 'none'); 
           if(pInpInicial) pInpInicial.style.display='none'; 
       }
   });
}

function toggleIni() { 
    var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart') && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    if(!parent) return;
    var metodo = parent.querySelector('#c-metodo').value;
    var boxVip = parent.querySelector('#box-vip');
    
    if(metodo !== "Crédito") { 
        window.usuarioForzoInicial = false; 
        if(boxVip) boxVip.style.display = 'none';
        var elEx = parent.querySelector('#c-vip');
        if(elEx) elEx.checked = false;
    } else {
        if(boxVip) boxVip.style.display = 'block';
    }
    calcCart(); 
}

function clearCart() { 
    window.CART=[]; 
    window.usuarioForzoInicial = false;
    
    var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
    panels.forEach(parent => {
        if(!parent) return;
        var inpInicial = parent.querySelector('#c-inicial');
        if(inpInicial) inpInicial.value = '';
        var inpDesc = parent.querySelector('#c-desc');
        if(inpDesc) inpDesc.value = '0';
        var inpConcepto = parent.querySelector('#c-concepto');
        if(inpConcepto) inpConcepto.value = '';
        var inpEximir = parent.querySelector('#c-vip');
        if(inpEximir) inpEximir.checked = false;
        
        parent.removeAttribute('data-cotizacion-id');
    });
    
    renderPos(); 
    updateCartUI(); 
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
    if(window.CART.length === 0 && !parent.querySelector('#c-concepto').value && window.calculatedValues.total <= 0) return alert("El carrito está vacío");

    var idGenerado = parent.getAttribute('data-cotizacion-id') || ('COT-' + Date.now());
    var isEximir = parent.querySelector('#c-vip') ? parent.querySelector('#c-vip').checked : false;

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
        eximir: isEximir,
        inicialPersonalizada: window.usuarioForzoInicial,
        cart: JSON.parse(JSON.stringify(window.CART)),
        total: window.calculatedValues.total
    };

    var idx = window.D.cotizaciones.findIndex(x => x.id === idGenerado);
    if(idx > -1) { window.D.cotizaciones[idx] = paquete; } 
    else { window.D.cotizaciones.unshift(paquete); }

    if(window.showToast) window.showToast("Cotización guardada exitosamente", "success");
    clearCart();
    window.callAPI('guardarCotizacion', paquete);
}

function abrirModalCotizaciones() {
    renderCotizaciones();
    if(window.myModalCotizaciones) window.myModalCotizaciones.show();
}

function renderCotizaciones() {
    var c = document.getElementById('cotizaciones-list');
    if(!c) return;
    c.innerHTML = '';
    var activas = window.D.cotizaciones.filter(x => x.estado !== 'Facturada');
    
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
                    <small class="text-muted d-block">${cot.fecha} | Total: <strong class="text-dark">${window.COP.format(cot.total)}</strong></small>
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
    var cot = window.D.cotizaciones.find(x => x.id === id);
    if(!cot) return;
    
    window.CART = JSON.parse(JSON.stringify(cot.cart));
    window.usuarioForzoInicial = cot.inicialPersonalizada || false;
    
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
        if(parent.querySelector('#c-vip')) parent.querySelector('#c-vip').checked = cot.eximir || false;
        
        parent.setAttribute('data-cotizacion-id', id);
    });
    
    if(window.myModalCotizaciones) window.myModalCotizaciones.hide();
    if(window.showToast) window.showToast("Cotización cargada al carrito", "info");
    updateCartUI(true);
}

function eliminarCotizacion(id) {
    if(!confirm("¿Eliminar esta cotización permanentemente?")) return;
    window.D.cotizaciones = window.D.cotizaciones.filter(x => x.id !== id);
    renderCotizaciones();
    window.callAPI('eliminarCotizacion', id);
}

function toggleMobileCart() { 
    var mc = document.getElementById('mobile-cart');
    if(mc) {
        mc.classList.toggle('visible'); 
        updateCartUI(true);
    }
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
   var isEximir = parent.querySelector('#c-vip') ? parent.querySelector('#c-vip').checked : false;
   
   if(window.calculatedValues.total <= 0) return alert("Precio 0 no permitido");
   
   var itemsData = [];
   if(window.CART.length > 0) {
       window.CART.forEach(p => {
           var qty = p.cantidad || 1;
           var unitPrice = p.precioUnitarioFinal || 0;

           for (var i = 0; i < qty; i++) {
               itemsData.push({ nombre: p.nombre, cat: p.cat, costo: p.costo, precioVenta: unitPrice });
           }
       });
   } else {
       var nombreManual = parent.querySelector('#c-concepto').value || "Venta Manual";
       var costoManual = window.calculatedValues.base;
       if(costoManual === 0 && window.calculatedValues.total > 0) {
           costoManual = Math.round(window.calculatedValues.total / 1.3);
       }
       itemsData.push({ nombre: nombreManual, cat: "General", costo: costoManual, precioVenta: window.calculatedValues.total });
   }

   // DISTRIBUCIÓN DE INTERESES (Sin fraccionar fila extra)
   if (metodo === "Crédito" && window.calculatedValues.total > 0) {
       var sumaItemsBase = itemsData.reduce((a, b) => a + b.precioVenta, 0);
       var difInteres = window.calculatedValues.total - sumaItemsBase;
       if (difInteres > 0.01 && itemsData.length > 0) {
           itemsData.forEach(item => {
               var peso = sumaItemsBase > 0 ? (item.precioVenta / sumaItemsBase) : (1 / itemsData.length);
               item.precioVenta = Math.round(item.precioVenta + (difInteres * peso));
           });
       }
   }
   
   var idCotiz = parent.getAttribute('data-cotizacion-id');
   var d = { items: itemsData, cliente: cli, metodo: metodo, inicial: (metodo === 'Crédito') ? window.calculatedValues.inicial : 0, inicialPersonalizada: window.usuarioForzoInicial, eximirInicial: isEximir, vendedor: window.currentUserAlias, fechaPersonalizada: fechaVal, cuotas: cuotasVal, idCotizacion: idCotiz };
   
   var btn = parent.querySelector('#btn-vender-main');
   if(btn) { btn.innerText = "Procesando..."; btn.disabled = true; }
   
   window.callAPI('procesarVentaCarrito', d).then(r => { 
       if(btn) { btn.innerText = "✅ VENDER / FACTURAR"; btn.disabled = false; }
       if(r.exito) { 
           if(r.offline) { 
               alert("Venta guardada OFFLINE. Se subirá cuando haya internet."); 
               clearCart(); 
           } else { 
               if(window.showToast) window.showToast("¡Venta Registrada con Éxito!", "success");
               clearCart();
               if(window.loadData) window.loadData(true); 
           } 
       } else { 
           alert(r.error); 
       } 
   });
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
    
    var total = window.calculatedValues.total;
    var metodo = parent.querySelector('#c-metodo').value;
    
    var msg = `👑 *KING'S SHOP SAS*\n\n`;
    msg += `Hola *${cli.trim()}*, esta es tu cotización:\n\n`;
    
    var fileToShare = null;
    var hasImage = false;
    var firstImgUrl = "";

    if (incDesc && window.CART.length > 0) {
        window.CART.forEach(x => {
            var p = window.D.inv.find(inv => inv.id === x.id); 
            var desc = p ? p.desc : (x.desc || "");
            var foto = p ? p.foto : (x.foto || "");
            var fixedUrl = window.fixDriveLink ? window.fixDriveLink(foto) : foto;
            
            if (fixedUrl && fixedUrl.length > 10 && !firstImgUrl) {
                firstImgUrl = fixedUrl;
            }
            
            msg += `🛍️ *Producto:* ${x.cantidad}x ${x.nombre.toUpperCase()}\n`;
            var descBonita = window.embellecerDescripcion ? window.embellecerDescripcion(desc) : desc;
            if (descBonita) {
                msg += `📋 *Detalles:*\n${descBonita}\n\n`;
            } else {
                msg += `\n`;
            }
        });
        msg += `────────────────\n\n`;

        if (firstImgUrl && window.getFileFromUrlAsync) {
            var loader = document.getElementById('loader');
            if(loader) loader.style.display = 'flex';
            try {
                fileToShare = await window.getFileFromUrlAsync(firstImgUrl, 'cotizacion_kingshop');
                if (fileToShare) hasImage = true;
            } catch(e) {
                console.error("Error descargando imagen para cotización", e);
            }
            if(loader) loader.style.display = 'none';
        }
    } else {
        if(window.CART.length > 0) { 
            concepto = window.CART.map(x=> `${x.cantidad}x ${x.nombre}`).join(', '); 
        } else { 
            concepto = parent.querySelector('#c-concepto').value || "Varios"; 
        }
        msg += `📦 *Producto(s):* ${concepto}\n\n`;
    }
    
    if(metodo === "Crédito") {
        var inicial = window.calculatedValues.inicial;
        var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
        var resCuotaVal = parent.querySelector('#res-cuota-val');
        var valorCuota = resCuotaVal ? resCuotaVal.innerText : 0;
        msg += `💳 *Método:* Crédito\n`;
        msg += `💰 *Valor Total (Financiado):* ${window.COP.format(total)}\n`;
        msg += `• *Inicial:* ${window.COP.format(inicial)}\n`;
        msg += `📅 *Plan:* ${cuotas} cuotas de *${valorCuota}*\n\n`;
    } else {
        msg += `💵 *Método:* Contado\n`;
        msg += `💰 *Total a Pagar:* ${window.COP.format(total)}\n\n`;
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
                if(window.showToast) window.showToast("¡Cotización compartida con éxito!", "success");
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
   var isEximir = parent.querySelector('#c-vip') ? parent.querySelector('#c-vip').checked : false;
   
   if(window.calculatedValues.total <= 0 && window.calculatedValues.base <= 0) return alert("El precio total no puede ser 0");
   
   var itemsData = [];
   var ivaTotalCotizacion = 0;
   var subtotalBaseCotizacion = 0;
   var descuentoTotalCotizacion = 0; 

   if(window.CART.length > 0) {
       window.CART.forEach(p => {
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
       var iniTemp = isEximir ? 0 : (preTotal * 0.30);
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
   window.callAPI('generarCotizacionPDF', d).then(r => { 
       document.getElementById('loader').style.display='none';
       if(r.exito) { 
           window.open(r.url, '_blank');
       } else { 
           alert("Error generando PDF: " + r.error); 
       } 
   });
}

// Exportación al objeto Global
window.renderPos = renderPos;
window.toggleCart = toggleCart;
window.agregarAlCarritoDesdeInv = agregarAlCarritoDesdeInv;
window.abrirEditorItem = abrirEditorItem;
window.calcEditorItem = calcEditorItem;
window.aplicarPrecioPactado = aplicarPrecioPactado;
window.guardarEditorItem = guardarEditorItem;
window.toggleItemIva = toggleItemIva;
window.changeQty = changeQty;
window.agregarItemManual = agregarItemManual;
window.updateCartUI = updateCartUI;
window.toggleManual = toggleManual;
window.calcCart = calcCart;
window.toggleIni = toggleIni;
window.clearCart = clearCart;
window.guardarCotizacionActual = guardarCotizacionActual;
window.abrirModalCotizaciones = abrirModalCotizaciones;
window.renderCotizaciones = renderCotizaciones;
window.cargarCotizacion = cargarCotizacion;
window.eliminarCotizacion = eliminarCotizacion;
window.toggleMobileCart = toggleMobileCart;
window.toggleDatosFormales = toggleDatosFormales;
window.finalizarVenta = finalizarVenta;
window.shareQuote = shareQuote;
window.generarCotizacionPDF = generarCotizacionPDF;
