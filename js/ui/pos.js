/* ARCHIVO: js/ui/pos.js - Motor POS KING'S SHOP SAS */
// ── FIX MEDIO 1: Mutex para prevenir doble-submit de venta ────
var _procesandoVenta = false;
window.ACTIVE_PANEL = 'desktop';

// ════════════════════════════════════════════════════════════════════════
// ESTADO ÚNICO DEL CARRITO (Single Source of Truth)
// Antes, cada acción del carrito (togglear método, cargar cotización,
// limpiar, calcular) recorría manualmente los DOS árboles DOM
// (#desktop-cart-container y #mobile-cart) copiando ~18 campos entre ellos
// uno por uno. Ahora existe un único objeto de estado (window.cartState):
// las funciones lo modifican UNA sola vez y pushCartState_() lo proyecta
// hacia ambos paneles. window.CART (los ítems del carrito) sigue siendo
// estado aparte, sin cambios. getActiveCartPanel_() reutiliza el
// window.ACTIVE_PANEL que ya mantiene toggleMobileCart() — más confiable
// que detectar el panel activo por foco del DOM.
// ════════════════════════════════════════════════════════════════════════
window.cartState = {
    cliente: '', nit: '', tel: '', fecha: '',
    metodo: 'Contado', cuotas: 1, iva: false, manual: false,
    util: 30, desc: 0, int: 5, target: '', concepto: '',
    vip: false, frecuencia: 'Mensual', primerPago: '', incluirDesc: false,
    incluirPoliticas: false, imei: '',
    cotizacionId: null
};

var CART_STATE_FIELDS_ = [
    ['#c-cliente', 'cliente'], ['#c-nit', 'nit'], ['#c-tel', 'tel'], ['#c-fecha', 'fecha'],
    ['#c-metodo', 'metodo'], ['#c-cuotas', 'cuotas'], ['#c-iva', 'iva'], ['#c-manual', 'manual'],
    ['#c-util', 'util'], ['#c-desc', 'desc'], ['#c-int', 'int'], ['#c-target', 'target'],
    ['#c-concepto', 'concepto'], ['#c-vip', 'vip'], ['#c-frecuencia', 'frecuencia'],
    ['#c-primer-pago', 'primerPago'], ['#c-incluir-desc', 'incluirDesc'],
    ['#c-incluir-politicas', 'incluirPoliticas'], ['#c-imei', 'imei']
];

function getCartPanels_() {
    return [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].filter(Boolean);
}

function getActiveCartPanel_() {
    return document.getElementById(window.ACTIVE_PANEL === 'mobile' ? 'mobile-cart' : 'desktop-cart-container');
}

// Lee el panel donde el usuario está interactuando hacia el estado único.
function pullCartState_() {
    var parent = getActiveCartPanel_();
    if (!parent) return;
    CART_STATE_FIELDS_.forEach(function(pair) {
        var el = parent.querySelector(pair[0]);
        if (!el) return;
        window.cartState[pair[1]] = (el.type === 'checkbox') ? el.checked : el.value;
    });
}

// Proyecta el estado único hacia AMBOS paneles (fuente única → vistas
// reactivas). Nunca pisa el campo que el usuario está escribiendo ahora mismo.
function pushCartState_() {
    getCartPanels_().forEach(function(parent) {
        CART_STATE_FIELDS_.forEach(function(pair) {
            var el = parent.querySelector(pair[0]);
            if (!el || document.activeElement === el) return;
            var val = window.cartState[pair[1]];
            if (el.type === 'checkbox') el.checked = !!val;
            else el.value = (val === undefined || val === null) ? '' : val;
        });
        if (window.cartState.cotizacionId) parent.setAttribute('data-cotizacion-id', window.cartState.cotizacionId);
        else parent.removeAttribute('data-cotizacion-id');
    });
}

// Lee un campo del estado único ya resuelto contra un valor por defecto.
function cartStateVal_(key, defaultVal) {
    var v = window.cartState[key];
    return (v === undefined || v === '' || v === null) ? defaultVal : v;
}
// ─────────────────────────────────────────────────────────────────────────

function renderPos() {
    var searchEl = document.getElementById('pos-search');
    var placeholder = document.getElementById('pos-placeholder');
    var c = document.getElementById('pos-list');
    if(!searchEl || !placeholder || !c) return;

    if(window.D) {
        var clientesUnicos = {};

        if(window.D.deudores) {
            window.D.deudores.forEach(d => {
                if(d.cliente && !clientesUnicos[d.cliente]) {
                    clientesUnicos[d.cliente] = { nit: d.nit || '', tel: d.tel || d.telefono || '' };
                }
            });
        }
        if(window.D.cotizaciones) {
            window.D.cotizaciones.forEach(cot => {
                if(cot.cliente && !clientesUnicos[cot.cliente]) {
                    clientesUnicos[cot.cliente] = { nit: cot.nit || '', tel: cot.tel || '' };
                }
            });
        }

        // Antes esto también llenaba un <datalist> nativo con TODOS los
        // clientes. El autocompletado nativo de <datalist> en el WebView de
        // Android no filtra bien con muchos clientes — aparecía la lista
        // completa tapando la pantalla. Ahora el filtrado progresivo lo hace
        // filtrarClienteSugerido() a mano, leyendo este mismo diccionario.
        window.CLIENTES_DICT = clientesUnicos;
    }

    var q = searchEl.value.toLowerCase().trim();
    c.innerHTML = '';
    
    if(!q) { 
        placeholder.style.display = 'block'; 
        return; 
    }
    placeholder.style.display = 'none';

    var lista = window.D.inv || [];
    var res = lista.filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cat && p.cat.toLowerCase().includes(q)));
    
    if(res.length === 0) { 
        c.innerHTML = '<div class="text-center text-muted py-3">No encontrado</div>'; 
        return; 
    }

    res.slice(0, 20).forEach(p => {
        var active = window.CART.some(x => x.id === p.id) ? 'active' : '';
        var precioDisplay = p.publico > 0 ? window.COP.format(p.publico) : `<span class="text-muted small">Costo: ${window.COP.format(p.costo)}</span>`;
        var descCorto = p.cat + (p.prov ? `<br><span style="color: var(--primary); font-weight: bold; font-size: 0.75rem;">Prov: ${p.prov}</span>` : '');

        var div = document.createElement('div');
        div.className = `pos-row-lite ${active}`;
        div.onclick = function() { window.toggleCart(p, div); };
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

function autocompletarCliente(nombre) {
    if(!nombre || !window.CLIENTES_DICT) return;
    var data = window.CLIENTES_DICT[nombre];
    if(!data) return;

    pullCartState_();
    if (data.nit && !window.cartState.nit) window.cartState.nit = data.nit;
    if (data.tel && !window.cartState.tel) window.cartState.tel = data.tel;
    pushCartState_();

    if (window.cartState.nit || window.cartState.tel) {
        getCartPanels_().forEach(function(parent) {
            var box = parent.querySelector('#box-datos-formales');
            if(box) box.style.display = 'block';
        });
    }
    updateCartUI(true);
}

// Autocompletado progresivo de cliente — reemplaza el <datalist> nativo
// (que en el WebView de Android mostraba TODOS los clientes tapando la
// pantalla en vez de filtrar). Se actualiza a medida que se escribe.
function filtrarClienteSugerido(inputEl) {
    var box = inputEl.parentElement ? inputEl.parentElement.querySelector('.cliente-sugerencias') : null;
    if (!box) return;

    var q = inputEl.value.trim().toLowerCase();
    if (!q || !window.CLIENTES_DICT) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    var coincidencias = Object.keys(window.CLIENTES_DICT)
        .filter(function(nombre) { return nombre.toLowerCase().includes(q); })
        .slice(0, 6);

    if (coincidencias.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    box.innerHTML = coincidencias.map(function(nombre) {
        var nombreEscapado = window.escHtml ? window.escHtml(nombre) : nombre;
        return '<div class="item" onclick="window.seleccionarClienteSugerido(this, &quot;' + nombreEscapado.replace(/"/g, '&quot;') + '&quot;)">' + nombreEscapado + '</div>';
    }).join('');
    box.style.display = 'block';
}

function seleccionarClienteSugerido(itemEl, nombre) {
    var box = itemEl.closest('.cliente-sugerencias');
    var input = box ? box.previousElementSibling : null;
    if (input) input.value = nombre;
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    window.autocompletarCliente(nombre);
}

// Oculta la lista al perder el foco, con un pequeño margen para que el click
// sobre una sugerencia alcance a registrarse antes de que desaparezca.
function ocultarSugerenciasCliente(inputEl) {
    setTimeout(function() {
        var box = inputEl.parentElement ? inputEl.parentElement.querySelector('.cliente-sugerencias') : null;
        if (box) box.style.display = 'none';
    }, 200);
}

function toggleCart(p, el) {
    var idx = window.CART.findIndex(x => x.id === p.id);
    if(idx > -1) { 
        window.CART.splice(idx, 1); 
        if(el) el.classList.remove('active'); 
    } else { 
        var item = Object.assign({}, p);
        item.cantidad = 1;
        item.conIva = false;
        item.modificadoManualmente = false; 
        
        if (item.publico > 0) {
            item.precioUnitarioFinal = item.publico; 
            item.margenIndividual = item.costo > 0 ? ((item.publico / item.costo) - 1) * 100 : 100;
            item.modificadoManualmente = true; 
        } else {
            var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30;
            item.margenIndividual = globalUtil; 
            item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil / 100);
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
            item.margenIndividual = item.costo > 0 ? ((item.publico / item.costo) - 1) * 100 : 100;
            item.modificadoManualmente = true; 
        } else {
            var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30;
            item.margenIndividual = globalUtil; 
            item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil / 100);
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
    
    var precioLista = costo > 0 ? (costo * (1 + margen / 100)) : (parseFloat(document.getElementById('edit-item-precio-pactado').value) || parseFloat(document.getElementById('edit-item-total').innerText.replace(/\D/g,'')) || 0);
    
    var descuentoMonto = precioLista * (descPrc / 100);
    var precioNeto = Math.max(0, precioLista - descuentoMonto);
    
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
    var precioLista = costo > 0 ? (costo * (1 + margen / 100)) : precioObjetivoBase;
    
    if (precioLista > 0) {
        var descuentoRequeridoMonto = precioLista - precioObjetivoBase;
        var descuentoRequeridoPrc = (descuentoRequeridoMonto / precioLista) * 100;
        if (descuentoRequeridoPrc < 0) {
             descuentoRequeridoPrc = 0;
             if (costo > 0) {
                 var nuevoMargen = ((precioObjetivoBase / costo) - 1) * 100;
                 document.getElementById('edit-item-margen').value = nuevoMargen.toFixed(1);
             }
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
    document.getElementById('manual-item-nombre').value = '';
    document.getElementById('manual-item-costo').value = '';
    var elMargen = document.getElementById('manual-item-margen');
    if (elMargen) elMargen.value = '';
    document.getElementById('manual-item-precio').value = '';
    if(window.myModalItemManual) window.myModalItemManual.show();
}

// Reactivo: costo + margen → precio final. Si el margen está vacío, no toca
// el precio (permite seguir escribiendo el precio directamente a mano).
function calcularItemManual() {
    var elMargen = document.getElementById('manual-item-margen');
    if (!elMargen) return;
    var costo = parseFloat(document.getElementById('manual-item-costo').value) || 0;
    var margen = parseFloat(elMargen.value);
    if (isNaN(margen)) return;
    var precio = Math.round(costo * (1 + margen / 100));
    document.getElementById('manual-item-precio').value = precio;
}

function confirmarItemManual() {
    var nombre = document.getElementById('manual-item-nombre').value.trim();
    if (!nombre) return alert("El nombre del ítem es obligatorio");

    var precioStr = document.getElementById('manual-item-precio').value;
    var precio = parseFloat(precioStr);
    if (isNaN(precio) || precio < 0) return alert("Precio de venta inválido");

    var costoStr = document.getElementById('manual-item-costo').value;
    var costo = parseFloat(costoStr) || 0;

    // Si el usuario escribió un margen explícito, se respeta tal cual (aunque
    // el precio final haya sido ajustado a mano después); si no, se deriva
    // del costo/precio como antes.
    var elMargen = document.getElementById('manual-item-margen');
    var margenTipeado = elMargen ? parseFloat(elMargen.value) : NaN;
    var margenFinal = !isNaN(margenTipeado) ? margenTipeado : (costo > 0 ? ((precio / costo) - 1) * 100 : 0);

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
        margenIndividual: margenFinal,
        descuentoIndividual: 0,
        precioUnitarioFinal: precio
    });

    // updateCartUI() -> calcCart() somete este ítem a las MISMAS reglas de
    // interés/crédito que los ítems de catálogo: calcCart() itera
    // window.CART sin distinguir origen (manual vs. inventario).
    if(window.myModalItemManual) window.myModalItemManual.hide();
    updateCartUI(true);
    if(window.showToast) window.showToast("Ítem libre agregado", "success");
}

function updatePrimerPago() {
    try {
        pullCartState_();
        var frec = window.cartState.frecuencia || 'Mensual';
        var baseDate = new Date();
        if (window.cartState.fecha) {
            var parsed = new Date(window.cartState.fecha + "T12:00:00");
            if (!isNaN(parsed.getTime())) baseDate = parsed;
        }

        if (frec === 'Quincenal') {
            baseDate.setDate(baseDate.getDate() + 15);
        } else {
            baseDate.setMonth(baseDate.getMonth() + 1);
        }

        window.cartState.primerPago = baseDate.toISOString().split('T')[0];
        pushCartState_();
    } catch(e) {
        console.error("Error validando fecha:", e);
    }
}

function toggleManual() {
    var activeParent = getActiveCartPanel_();
    if(!activeParent) return;
    
    var isManual = activeParent.querySelector('#c-manual') ? activeParent.querySelector('#c-manual').checked : false;
    var inpTotal = activeParent.querySelector('#res-cont-input');
    var inpUtil = activeParent.querySelector('#c-util');

    if(isManual) { 
        if(inpUtil) inpUtil.disabled = true; 
        setTimeout(() => { 
            if(inpTotal) inpTotal.focus(); 
        }, 100); 
    } else { 
        if(inpUtil) inpUtil.disabled = false; 
    }
    
    window.calcCart();
}

function toggleIni() {
    pullCartState_();
    var masterMethod = window.cartState.metodo || "Contado";

    if (masterMethod !== "Crédito") {
        window.usuarioForzoInicial = false;
        window.cartState.vip = false;
        getCartPanels_().forEach(function(parent) {
            var inpInicial = parent.querySelector('#c-inicial');
            if (inpInicial) inpInicial.value = "";
        });
    }

    pushCartState_();
    updateCartUI(true);
}

function clearCart() {
    window.CART = [];
    window.usuarioForzoInicial = false;

    window.cartState.metodo = 'Contado';
    window.cartState.desc = '0';
    window.cartState.concepto = '';
    window.cartState.vip = false;
    window.cartState.frecuencia = 'Mensual';
    window.cartState.primerPago = '';
    window.cartState.incluirPoliticas = false;
    window.cartState.imei = '';
    window.cartState.cotizacionId = null;
    pushCartState_();

    getCartPanels_().forEach(function(parent) {
        var inpInicial = parent.querySelector('#c-inicial');
        if (inpInicial) {
            inpInicial.value = '';
            inpInicial.style.background = '#fff';
            inpInicial.placeholder = 'Monto Inicial Personalizado';
        }
    });

    renderPos();
    updateCartUI();
}

function guardarCotizacionActual() {
    pullCartState_();
    var cli = window.cartState.cliente;
    if(!cli) return alert("Falta Cliente");

    if(window.CART.length === 0 && !window.cartState.concepto && window.calculatedValues.total <= 0) return alert("El carrito está vacío");

    var paquete = {
        id       : window.cartState.cotizacionId || ('COT-' + Date.now()),
        fecha    : window.cartState.fecha || new Date().toISOString().split('T')[0],
        cliente  : cli,
        nit      : window.cartState.nit || '',
        tel      : window.cartState.tel || '',
        metodo   : window.cartState.metodo,
        cuotas   : window.cartState.cuotas,
        iva      : !!window.cartState.iva,
        manual   : !!window.cartState.manual,
        util     : window.cartState.util,
        desc     : window.cartState.desc,
        int      : window.cartState.int,
        target   : window.cartState.target,
        concepto : window.cartState.concepto,
        eximir   : !!window.cartState.vip,
        politicas: !!window.cartState.incluirPoliticas,
        inicialPersonalizada : window.usuarioForzoInicial,
        inicialValor  : window.calculatedValues.inicial,
        valorCuota    : window.calculatedValues.valorCuota,
        ultimaCuota   : window.calculatedValues.ultimaCuota,
        frecuencia    : window.cartState.frecuencia || "Mensual",
        primerPago    : window.cartState.primerPago || "",
        imei          : (window.cartState.imei || "").trim(),
        cart  : JSON.parse(JSON.stringify(window.CART)),
        total : window.calculatedValues.total
    };

    var idx = window.D.cotizaciones.findIndex(x => x.id === paquete.id);
    if(idx > -1) {
        window.D.cotizaciones[idx] = paquete;
    } else {
        window.D.cotizaciones.unshift(paquete);
    }

    if(window.showToast) window.showToast("Cotización guardada", "success");
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
        c.innerHTML += `
        <div class="card-k mb-2 border-start border-4 border-info bg-white shadow-sm p-3">
            <div class="d-flex justify-content-between align-items-center">
                <div style="flex:1; min-width:0;">
                    <strong class="text-primary text-truncate d-block">${cot.cliente}</strong>
                    <small class="text-muted d-block">${cot.fecha} | Total: <strong class="text-dark">${window.COP.format(cot.total)}</strong></small>
                    <small class="text-secondary">${cot.cart.length} Item(s) | ${cot.metodo}</small>
                </div>
                <div class="d-flex flex-column gap-2 ms-2">
                    <button class="btn btn-sm btn-primary fw-bold" onclick="window.cargarCotizacion('${cot.id}')">✏️ Retomar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.eliminarCotizacion('${cot.id}')">🗑️ Eliminar</button>
                </div>
            </div>
        </div>`;
    });
}

function cargarCotizacion(id) {
    var cot = window.D.cotizaciones.find(x => x.id === id);
    if(!cot) return;

    window.CART = JSON.parse(JSON.stringify(cot.cart));
    window.usuarioForzoInicial = cot.inicialPersonalizada || false;

    Object.assign(window.cartState, {
        cliente: cot.cliente || '', nit: cot.nit || '', tel: cot.tel || '', fecha: cot.fecha || '',
        metodo: cot.metodo || 'Contado', cuotas: cot.cuotas || 1, iva: cot.iva || false,
        manual: cot.manual || false, util: cot.util || 30, desc: cot.desc || 0, int: cot.int || 5,
        target: cot.target || '', concepto: cot.concepto || '', vip: cot.eximir || false,
        incluirPoliticas: cot.politicas || false,
        frecuencia: cot.frecuencia || 'Mensual', primerPago: cot.primerPago || '',
        imei: cot.imei || '',
        cotizacionId: id
    });
    pushCartState_();

    if (window.usuarioForzoInicial) {
        getCartPanels_().forEach(function(parent) {
            var inp = parent.querySelector('#c-inicial');
            if (inp) inp.value = cot.inicialValor || 0;
        });
    }

    if(window.myModalCotizaciones) window.myModalCotizaciones.hide();
    if(window.showToast) window.showToast("Cotización cargada", "info");

    updateCartUI(true);
}

function eliminarCotizacion(id) {
    if(!confirm("¿Eliminar permanentemente?")) return;
    window.D.cotizaciones = window.D.cotizaciones.filter(x => x.id !== id); 
    renderCotizaciones(); 
    window.callAPI('eliminarCotizacion', id);
}

function toggleMobileCart() { 
    var mc = document.getElementById('mobile-cart'); 
    if(mc) { 
        var isVis = mc.classList.toggle('visible'); 
        window.ACTIVE_PANEL = isVis ? 'mobile' : 'desktop';
        updateCartUI(true); 
    } 
}

function toggleDatosFormales() {
    getCartPanels_().forEach(function(parent) {
        var box = parent.querySelector('#box-datos-formales');
        if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
}

function finalizarVenta() {
   if (_procesandoVenta) return;
   _procesandoVenta = true;
   // FIX FUGA DE MUTEX: los `return alert(...)` de las validaciones de abajo
   // salían de la función SIN liberar _procesandoVenta (solo se liberaba
   // dentro del .then() de callAPI) — si al cajero le faltaba el cliente o el
   // total daba $0, el botón de vender quedaba muerto para siempre hasta
   // recargar la página. Este wrapper libera el mutex en cualquier salida.
   var salir = function(mensaje) {
       _procesandoVenta = false;
       if (mensaje) alert(mensaje);
   };

   pullCartState_();
   var parent = getActiveCartPanel_();
   if(!parent) { _procesandoVenta = false; return; }

   var cli = window.cartState.cliente;
   if(!cli) return salir("Falta Cliente");

   if(window.calculatedValues.total <= 0) return salir("Precio 0 no permitido");

   var nit      = window.cartState.nit;
   var tel      = window.cartState.tel;
   var concepto = window.cartState.concepto;
   var fechaVal = window.cartState.fecha;
   var imei     = (window.cartState.imei || "").trim();

   var itemsData = [];
   if(window.CART.length > 0) {
       window.CART.forEach(p => {
           for (var i = 0; i < (p.cantidad || 1); i++) {
               itemsData.push({
                   nombre: p.nombre,
                   cat: p.cat,
                   costo: p.costo,
                   precioVenta: p.precioUnitarioFinal || 0
               });
           }
       });
   } else {
       var costoManual = window.calculatedValues.base === 0
         ? Math.round(window.calculatedValues.total / 1.3)
         : window.calculatedValues.base;
       itemsData.push({
           nombre: concepto || "Venta Manual",
           cat: "General",
           costo: costoManual,
           precioVenta: window.calculatedValues.total
       });
   }

   var metodo = window.cartState.metodo;
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

   var isEximir = !!window.cartState.vip;
   var cotId    = window.cartState.cotizacionId;

   var d = {
       items            : itemsData,
       cliente          : cli,
       nit              : nit,
       telefono         : tel,
       metodo           : metodo,
       inicial          : (metodo === 'Crédito') ? window.calculatedValues.inicial : 0,
       inicialPersonalizada : window.usuarioForzoInicial,
       eximirInicial    : isEximir,
       vendedor         : window.currentUserAlias,
       fechaPersonalizada : fechaVal,
       cuotas           : parseInt(window.cartState.cuotas) || 1,
       idCotizacion     : cotId,
       frecuencia       : window.cartState.frecuencia || "Mensual",
       primerPago       : window.cartState.primerPago || "",
       imei             : imei
   };

   var btn = parent.querySelector('#btn-vender-main');
   if(btn) { btn.innerText = "Procesando..."; btn.disabled = true; }

  window.callAPI('procesarVentaCarrito', d).then(r => {
       _procesandoVenta = false;
       if(btn) {
           btn.innerText = "✅ VENDER / FACTURAR";
           btn.disabled = false;
       }
       if(r.exito) {
           if(r.offline) {
               alert("Venta guardada OFFLINE. Se subirá cuando haya internet.");
           } else {
               if(window.showToast) window.showToast("¡Venta Registrada con Éxito!", "success");
           }
           if(cotId) {
               window.D.cotizaciones = window.D.cotizaciones.filter(x => x.id !== cotId);
           }
           clearCart();
           if(window.loadData && !r.offline) window.loadData(true);
       } else {
           alert(r.error);
       }
   }).catch(() => {
       // Defensivo: callAPI() está diseñado para nunca rechazar, pero si
       // alguna vez lo hiciera, esto evita que el mutex quede trabado.
       _procesandoVenta = false;
       if(btn) { btn.innerText = "✅ VENDER / FACTURAR"; btn.disabled = false; }
       alert("Error de red al procesar la venta.");
   });
}

async function shareQuote() {
    var parent = getActiveCartPanel_();
    if(!parent) return;

    const getVal = (id) => {
        var el = parent.querySelector(id);
        return el ? el.value : "";
    };

    var cli = getVal('#c-cliente') || "Cliente";
    var concepto = getVal('#c-concepto') || "Varios";

    var msg = `👑 *KING'S SHOP SAS*\n\nHola *${cli.trim()}*, esta es tu cotización:\n\n`;
    
    var fileToShare = null; 
    var hasImage = false; 
    var firstImgUrl = "";
    
    var incDesc = parent.querySelector('#c-incluir-desc') ? parent.querySelector('#c-incluir-desc').checked : false;
    var incPoliticas = parent.querySelector('#c-incluir-politicas') ? parent.querySelector('#c-incluir-politicas').checked : false;

    if (incDesc && window.CART.length > 0) {
        window.CART.forEach(x => {
            var p = window.D.inv.find(inv => inv.id === x.id); 
            var fixedUrl = window.fixDriveLink ? window.fixDriveLink(p ? p.foto : x.foto) : (p ? p.foto : x.foto);
            if (fixedUrl && fixedUrl.length > 10 && !firstImgUrl) {
                firstImgUrl = fixedUrl;
            }
            
            msg += `🛍️ *Producto:* ${x.cantidad}x ${x.nombre.toUpperCase()}\n`;
            var descBonita = window.embellecerDescripcion ? window.embellecerDescripcion(p ? p.desc : x.desc) : (p ? p.desc : x.desc);
            if (descBonita) {
                msg += `📋 *Detalles:*\n${descBonita}\n\n`;
            } else {
                msg += `\n`;
            }
        });
        msg += `────────────────\n\n`;
        
        if (firstImgUrl && window.getFileFromUrlAsync) {
            try { 
                fileToShare = await window.getFileFromUrlAsync(firstImgUrl, 'cotizacion_kingshop'); 
                if (fileToShare) hasImage = true; 
            } catch(e) {}
        }
    } else {
        if(window.CART.length > 0) { 
            concepto = window.CART.map(x => `${x.cantidad}x ${x.nombre}`).join(', '); 
        }
        msg += `📦 *Producto(s):* ${concepto}\n\n`;
    }
    
    var metodo = parent.querySelector('#c-metodo').value;
    if(metodo === "Crédito") {
        var cuotas = parseInt(parent.querySelector('#c-cuotas').value) || 1;
        var frecTexto = parent.querySelector('#c-frecuencia') ? parent.querySelector('#c-frecuencia').value : "Mensual";
        var valCuota = window.calculatedValues.valorCuota || 0;
        var ultCuota = window.calculatedValues.ultimaCuota || 0;
        
        msg += `💳 *Método:* Crédito\n`;
        msg += `💰 *Valor Total (Financiado):* ${window.COP.format(window.calculatedValues.total)}\n`;
        msg += `• *Inicial:* ${window.COP.format(window.calculatedValues.inicial)}\n`;
        
        if (cuotas > 1 && Math.abs(ultCuota - valCuota) > 1 && ultCuota > 0) {
            msg += `📅 *Plan:* ${cuotas - 1} cuotas de *${window.COP.format(valCuota)}* y 1 cuota final de *${window.COP.format(ultCuota)}* (${frecTexto})\n\n`;
        } else {
            msg += `📅 *Plan:* ${cuotas} cuotas de *${window.COP.format(valCuota)}* (${frecTexto})\n\n`;
        }

        if (incPoliticas) {
            msg += `────────────────\n`;
            msg += `📜 *Políticas de Crédito:*\n`;
            msg += `¡Hola! En King's Shop nuestra prioridad es entregarte lo mejor en tecnología con el respaldo y la calidad que mereces. 🚀\n\n`;
            msg += `Para brindarte un servicio de excelencia, te recordamos amablemente:\n`;
            msg += `📌 *Cuota Inicial:* Su pago puntual es el requisito indispensable para formalizar la entrega de tu equipo.\n`;
            msg += `⏰ *Fechas de Pago:* Cumplir con el día estipulado garantiza que tu beneficio se mantenga activo y sin interrupciones.\n\n`;
        }

    } else {
        msg += `💵 *Método:* Contado\n`;
        msg += `💰 *Total a Pagar:* ${window.COP.format(window.calculatedValues.total)}\n\n`;
    }
    
    msg += `🤝 _Quedamos a su entera disposición._`;
    
    // navigator.share/navigator.canShare (Web Share API) NO están implementados
    // en el WebView nativo de Android que usa Capacitor. window.compartirNativoCapacitor_
    // (definido en utils.js) usa el plugin @capacitor/share, que sí funciona empaquetado.
    if (hasImage && window.esPlataformaNativa_ && window.esPlataformaNativa_()) {
        var okNativo = await window.compartirNativoCapacitor_("Cotización King's Shop", msg, fileToShare);
        if (okNativo) {
            if(window.showToast) window.showToast("¡Cotización compartida con éxito!", "success");
            return;
        }
    } else if (hasImage && navigator.canShare) {
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
            } catch (err) {}
        }
    }
    
    if (firstImgUrl) {
        msg = msg.replace(`Hola *${cli.trim()}*, esta es tu cotización:\n\n`, `Hola *${cli.trim()}*, esta es tu cotización:\n\n🖼️ *Imagen:* ${firstImgUrl}\n\n`);
    }
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

window.calcCart = function() {
    var activeParent = getActiveCartPanel_();
    if (!activeParent) return;

    pullCartState_();
    // getVal ahora lee del estado único (ya sincronizado desde el panel
    // activo por pullCartState_) en vez de volver a consultar el DOM.
    const getVal = (selector, defaultVal) => {
        var pair = CART_STATE_FIELDS_.find(function(p) { return p[0] === selector; });
        if (!pair) return defaultVal;
        return cartStateVal_(pair[1], defaultVal);
    };

    var cuotas             = parseInt(getVal('#c-cuotas', 1)) || 1;
    var metodo             = getVal('#c-metodo', 'Contado');
    var conIvaGlobal       = !!window.cartState.iva;
    var isManual           = !!window.cartState.manual;
    var utilGlobal         = parseFloat(getVal('#c-util', 30)) || 0;
    var descuentoGlobalPrc = parseFloat(getVal('#c-desc', 0)) || 0;
    var tasaMensual        = parseFloat(getVal('#c-int', 5)) || 0;
    var targetValStr       = getVal('#c-target', "");
    var targetVal          = parseFloat(targetValStr);
    var tieneTarget        = !isNaN(targetVal) && targetVal > 0;
    var isEximir           = !!window.cartState.vip;

    var baseParaCalculo    = 0;
    var totalFinal         = 0;
    var descuentoDineroTotal = 0;

    if (window.CART && window.CART.length > 0) {
        window.CART.forEach(item => {
            let c = item.costo || 0;
            let q = item.cantidad || 1;
            let precioLista = 0;

            if (c > 0) {
                let m = item.modificadoManualmente ? item.margenIndividual : utilGlobal;
                precioLista = c * (1 + m / 100);
            } else {
                precioLista = item.publico || item.precioUnitarioFinal || 0;
            }

            let dPrc = descuentoGlobalPrc > 0 ? descuentoGlobalPrc : (item.descuentoIndividual || 0);
            let descuentoDinero = tieneTarget ? 0 : precioLista * (dPrc / 100);

            descuentoDineroTotal += (descuentoDinero * q);

            let px = Math.max(0, precioLista - descuentoDinero);
            if (item.conIva || conIvaGlobal) px *= 1.19;

            item.precioUnitarioFinal = px;

            let baseCostoEstimado = c > 0 ? c : (precioLista / 1.3);
            baseParaCalculo += (baseCostoEstimado * q);
            totalFinal      += (px * q);
        });
    } else {
        var resContInput = activeParent.querySelector('#res-cont-input');
        var manualVal    = resContInput ? parseFloat(resContInput.value) : 0;
        baseParaCalculo  = isNaN(manualVal) ? 0 : manualVal;

        let precioListaBruto = baseParaCalculo * (1 + utilGlobal / 100);
        descuentoDineroTotal = tieneTarget ? 0 : precioListaBruto * (descuentoGlobalPrc / 100);

        totalFinal = Math.max(0, precioListaBruto - descuentoDineroTotal);
        if (conIvaGlobal) totalFinal *= 1.19;
    }

    if (tieneTarget) {
        totalFinal           = targetVal;
        descuentoDineroTotal = 0;
        window.cartState.desc = 0;

        if (window.CART && window.CART.length > 0) {
            let totalPrevio = window.CART.reduce((acc, b) => acc + ((b.precioUnitarioFinal || 0) * b.cantidad), 0);
            window.CART.forEach(item => {
                let peso = totalPrevio > 0
                    ? ((item.precioUnitarioFinal || 0) * item.cantidad) / totalPrevio
                    : 1 / window.CART.length;
                item.precioUnitarioFinal = (targetVal * peso) / item.cantidad;
            });
        }
    }

    totalFinal = Math.round(totalFinal / 100) * 100;

    // ── FIX BASE CIRCULAR: antes, el interés se calculaba con una inicial
    // estimada sobre el total NETO (sin interés) — pero la inicial que
    // realmente se cobraba (metaInicial) se recalculaba después sobre el
    // total YA CON interés, un número distinto. Resultado: el saldo que se
    // financiaba a cuotas nunca coincidía con el saldo sobre el que se había
    // calculado el interés. Ahora la inicial se calcula UNA sola vez, sobre
    // el mismo total neto, y esa misma base se reutiliza tanto para el
    // interés como para la inicial sugerida real. ──────────────────────────
    var metaInicial = isEximir ? 0 : Math.round((totalFinal * 0.30) / 100) * 100;

    if (metodo === "Crédito") {
        var saldoBaseInteres = Math.max(0, totalFinal - metaInicial);

        // ── FIX QUINCENAL: tasa por periodo ──────────────────────────
        // Quincenal = 15 días = medio mes.
        // Usar la misma tasa mensual inflaría el costo al doble.
        // Se divide entre 2 para que el costo financiero sea proporcional
        // al tiempo real de cada periodo de pago.
        var frecuenciaActual = getVal('#c-frecuencia') || "Mensual";
        var tasaPorPeriodo   = frecuenciaActual === "Quincenal"
            ? (tasaMensual / 2) / 100
            : tasaMensual / 100;
        // ─────────────────────────────────────────────────────────────

        var interesTotal = saldoBaseInteres * tasaPorPeriodo * cuotas;
        totalFinal = totalFinal + interesTotal;
        totalFinal = Math.round(totalFinal / 100) * 100;
    }
    // ─────────────────────────────────────────────────────────────────────

    var inpInicial   = activeParent.querySelector('#c-inicial');
    var isTypingInicial = (document.activeElement && document.activeElement === inpInicial);

    var inicial = 0;
    if (isTypingInicial) {
        if (inpInicial && inpInicial.value === "") {
            window.usuarioForzoInicial = false;
            inicial = isEximir ? 0 : metaInicial;
        } else if (inpInicial) {
            window.usuarioForzoInicial = true;
            inicial = parseFloat(inpInicial.value) || 0;
        }
    } else if (window.usuarioForzoInicial && inpInicial && inpInicial.value !== "") {
        inicial = parseFloat(inpInicial.value) || 0;
    } else {
        window.usuarioForzoInicial = false;
        inicial = isEximir ? 0 : metaInicial;
    }

    var faltanteInicial = Math.max(0, metaInicial - inicial);

    var valorCuota  = 0;
    var ultimaCuota = 0;

    if (metodo === "Crédito") {
        var saldo = Math.max(0, totalFinal - inicial);

        if (cuotas === 1) {
            valorCuota  = saldo;
            ultimaCuota = saldo;
        } else {
            valorCuota  = Math.round((saldo / cuotas) / 100) * 100;
            ultimaCuota = saldo - (valorCuota * (cuotas - 1));

            while (ultimaCuota <= 0 && valorCuota >= 100) {
                valorCuota -= 100;
                ultimaCuota = saldo - (valorCuota * (cuotas - 1));
            }
        }
    }

    if (!window.calculatedValues) window.calculatedValues = {};
    window.calculatedValues.inicial    = inicial;
    window.calculatedValues.base       = baseParaCalculo;
    window.calculatedValues.total      = totalFinal;
    window.calculatedValues.descuento  = descuentoDineroTotal;
    window.calculatedValues.valorCuota = valorCuota;
    window.calculatedValues.ultimaCuota = ultimaCuota;

    pushCartState_();

    // El HTML del listado de ítems se genera UNA sola vez (antes se
    // reconstruía por separado en cada uno de los dos paneles).
    var cartItemsHtml = '';
    if (window.CART && window.CART.length > 0) {
        window.CART.forEach(x => {
            var isLocked = x.modificadoManualmente
                ? `<i class="fas fa-lock" style="font-size:0.6rem; color:var(--gold);"></i>`
                : '';
            cartItemsHtml += `
            <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom">
                <div class="lh-1" style="flex:1;">
                    <small class="fw-bold" style="color:var(--primary);">${isLocked} ${x.nombre}</small><br>
                    <small class="text-muted">${window.COP.format(Math.round((x.precioUnitarioFinal || 0)/100)*100)} c/u</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm ${x.modificadoManualmente ? 'btn-dark' : 'btn-light border'} py-0 px-2 text-primary" onclick="window.abrirEditorItem('${x.id}')" title="Editar precio/descuento">✏️</button>
                    <button class="btn btn-sm ${x.conIva ? 'btn-success' : 'btn-outline-secondary'} py-0 px-2 fw-bold" onclick="window.toggleItemIva('${x.id}')"><small>IVA</small></button>
                    <button class="btn btn-sm btn-light border py-0 px-2" onclick="window.changeQty('${x.id}', -1)">-</button>
                    <span class="fw-bold small">${x.cantidad || 1}</span>
                    <button class="btn btn-sm btn-light border py-0 px-2" onclick="window.changeQty('${x.id}', 1)">+</button>
                </div>
            </div>`;
        });
    }

    var panels = getCartPanels_();

    panels.forEach(parent => {
        if (window.CART && window.CART.length > 0) {
            var listContainer = parent.querySelector('#cart-items-list');
            if (listContainer) listContainer.innerHTML = cartItemsHtml;
        }

        var rowDesc    = parent.querySelector('#row-descuento');
        var resDescVal = parent.querySelector('#res-desc-val');

        if (descuentoDineroTotal > 0 && !tieneTarget) {
            if (rowDesc) {
                rowDesc.style.display = 'block';
                if (resDescVal) resDescVal.innerText = "- " + window.COP.format(descuentoDineroTotal);
            }
        } else {
            if (rowDesc) rowDesc.style.display = 'none';
        }

        var pInpInicial = parent.querySelector('#c-inicial');
        if (pInpInicial && (!isTypingInicial || parent !== activeParent)) {
            if (window.usuarioForzoInicial) {
                pInpInicial.value = inicial;
            } else {
                pInpInicial.value = "";
                pInpInicial.placeholder = `Sugerido (30%): ${window.COP.format(inicial)}`;
            }
        }

        var rowCred      = parent.querySelectorAll('#row-cred');
        var totalText    = parent.querySelectorAll('#res-cont');
        var inputTotal   = parent.querySelector('#res-cont-input');
        var boxPoliticas = parent.querySelector('#box-politicas');

        if (metodo === "Crédito") {
            totalText.forEach(e => { e.innerText = window.COP.format(totalFinal); e.style.display = 'block'; });

            if (window.CART && window.CART.length === 0) {
                if (inputTotal) inputTotal.style.display = 'inline-block';
            } else {
                if (inputTotal) inputTotal.style.display = 'none';
            }

            var alertaFaltante = faltanteInicial > 0
                ? `<br><small class="text-danger fw-bold"><i class="fas fa-exclamation-triangle"></i> Faltante: ${window.COP.format(faltanteInicial)}</small>`
                : "";

            rowCred.forEach(e => {
                e.style.display = 'block';
                if (e.querySelector('#res-ini'))
                    e.querySelector('#res-ini').innerHTML = `${window.COP.format(inicial)} ${alertaFaltante}`;
                if (e.querySelector('#res-cuota-val'))
                    e.querySelector('#res-cuota-val').innerText = window.COP.format(valorCuota);

                var fTexto = window.cartState.frecuencia || "Mensual";

                var txtCuotas = "";
                // ── FIX UMBRAL: >= 1 en lugar de > 1 ─────────────────────
                if (cuotas > 1 && Math.abs(ultimaCuota - valorCuota) >= 1 && ultimaCuota > 0) {
                    txtCuotas = `x ${cuotas - 1} de ${window.COP.format(valorCuota)} y 1 de ${window.COP.format(ultimaCuota)} (${fTexto})`;
                } else {
                    txtCuotas = `x ${cuotas} Cuota(s) (${fTexto})`;
                }
                // ─────────────────────────────────────────────────────────

                if (e.querySelector('#res-cuota-txt'))
                    e.querySelector('#res-cuota-txt').innerText = txtCuotas;
            });

            if (pInpInicial) {
                pInpInicial.style.display = 'block';
                pInpInicial.disabled      = false;
                pInpInicial.style.background = faltanteInicial > 0 ? '#fff3cd' : '#fff';
            }
            if (boxPoliticas) boxPoliticas.style.display = 'block';

        } else {
            totalText.forEach(e => { e.innerText = window.COP.format(totalFinal); e.style.display = 'block'; });

            if (window.CART && window.CART.length === 0) {
                if (inputTotal) inputTotal.style.display = 'inline-block';
                if (isManual) totalText.forEach(e => e.style.display = 'none');
            } else {
                if (inputTotal) inputTotal.style.display = 'none';
            }

            rowCred.forEach(e => e.style.display = 'none');
            if (pInpInicial) pInpInicial.style.display = 'none';
            if (boxPoliticas) boxPoliticas.style.display = 'none';
        }
    });
};

function updateCartUI(keepOpen = false) {
    var count = window.CART.reduce((acc, item) => acc + (item.cantidad || 1), 0);
    var btnFloat = document.getElementById('btn-float-cart');

    if(btnFloat) {
        btnFloat.style.display = count > 0 ? 'block' : 'none';
        btnFloat.innerText = "🛒 " + count;
    }

    pullCartState_();
    if (window.CART.length > 0) window.cartState.concepto = '';
    var masterMethod = window.cartState.metodo || "Contado";
    pushCartState_();

    getCartPanels_().forEach(function(parent) {
        var dateInput = parent.querySelector('#c-fecha');
        if(dateInput && !dateInput.value) {
            var today = new Date();
            var todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            dateInput.value = todayStr;
            window.cartState.fecha = todayStr;
        }

        var inputConcepto = parent.querySelector('#c-concepto');
        if (inputConcepto) inputConcepto.style.display = (window.CART.length === 0) ? 'block' : 'none';
        parent.querySelectorAll('#cart-items-list').forEach(e => e.style.display = (window.CART.length === 0) ? 'none' : 'block');

        var boxVip = parent.querySelector('#box-vip');
        var boxCred = parent.querySelector('#box-credito-detalles');
        var boxPoliticas = parent.querySelector('#box-politicas');
        var mostrarCredito = masterMethod === "Crédito";
        if(boxVip) boxVip.style.display = mostrarCredito ? 'block' : 'none';
        if(boxCred) boxCred.style.display = mostrarCredito ? 'block' : 'none';
        if(boxPoliticas) boxPoliticas.style.display = mostrarCredito ? 'block' : 'none';
    });

    if (masterMethod === "Crédito" && window.updatePrimerPago) {
        window.updatePrimerPago();
    }

    if(window.CART.length === 0 && !keepOpen) {
        var mobCart = document.getElementById('mobile-cart');
        if(mobCart) mobCart.classList.remove('visible');
    }

    window.calcCart();
}

window.generarCotizacionPDF = function() {
   var parent = getActiveCartPanel_();
   if(!parent) return;

   const getVal = (id) => {
       var el = parent.querySelector(id);
       return el ? el.value : "";
   };

   var cli = getVal('#c-cliente');
   if(!cli) return alert("Falta el Nombre del Cliente para la cotización");
   
   if(window.calculatedValues.total <= 0 && window.calculatedValues.base <= 0) return alert("El precio total no puede ser 0");
   
   var nit = getVal('#c-nit');
   var tel = getVal('#c-tel');
   var concepto = getVal('#c-concepto');
   var fechaVal = getVal('#c-fecha');

   var conIvaGlobal = parent.querySelector('#c-iva') ? parent.querySelector('#c-iva').checked : false;
   var utilGlobal = parseFloat(parent.querySelector('#c-util') ? parent.querySelector('#c-util').value : 0) || 0; 
   var descuentoGlobalPrc = parseFloat(parent.querySelector('#c-desc') ? parent.querySelector('#c-desc').value : 0) || 0; 
   var targetVal = parseFloat(parent.querySelector('#c-target') ? parent.querySelector('#c-target').value : 0);
   var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   var metodo = parent.querySelector('#c-metodo') ? parent.querySelector('#c-metodo').value : 'Contado';
   var tasaMensual = parseFloat(parent.querySelector('#c-int') ? parent.querySelector('#c-int').value : 0) || 0;
   var cuotas = parseInt(parent.querySelector('#c-cuotas') ? parent.querySelector('#c-cuotas').value : 1) || 1;

   var btnPDF = parent.querySelector('button[onclick="window.generarCotizacionPDF()"]');
   var prevHtml = "";
   if(btnPDF) {
       prevHtml = btnPDF.innerHTML;
       btnPDF.innerHTML = "⏳ Generando...";
       btnPDF.disabled = true;
   }
   var unlockBtn = () => {
       if(btnPDF) {
           btnPDF.innerHTML = prevHtml;
           btnPDF.disabled = false;
       }
   };
   
   var itemsData = []; 
   var ivaTotalCotizacion = 0; 
   var subtotalBaseCotizacion = 0; 
   var descuentoTotalCotizacion = 0; 

   if(window.CART && window.CART.length > 0) {
       window.CART.forEach(p => {
           var qty = p.cantidad || 1;
           
           if (tieneTarget) {
               var unitPrice = Math.round((p.precioUnitarioFinal || 0) / 100) * 100;
               var totalItem = unitPrice * qty;
               subtotalBaseCotizacion += totalItem;
               
               itemsData.push({ 
                   nombre: p.nombre, 
                   descripcion: p.manual ? "Servicio / Ítem Manual" : (p.desc || p.cat),
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
               var unitBase = 0;
               
               if (c > 0) {
                   var m = p.modificadoManualmente ? p.margenIndividual : utilGlobal;
                   unitBase = c * (1 + m / 100);
               } else {
                   unitBase = p.publico || p.precioUnitarioFinal || 0;
               }
               
               var dPrc = descuentoGlobalPrc > 0 ? descuentoGlobalPrc : (p.descuentoIndividual || 0);
               var descUnitario = unitBase * (dPrc / 100);
               var totalDescItem = descUnitario * qty;
               
               subtotalBaseCotizacion += (unitBase * qty);
               descuentoTotalCotizacion += totalDescItem;
               
               var postDesc = Math.max(0, (unitBase * qty) - totalDescItem);
               
               var itemIva = 0;
               if (p.conIva || conIvaGlobal) {
                   itemIva = postDesc * 0.19; 
               }
               ivaTotalCotizacion += itemIva;
               
               itemsData.push({ 
                   nombre: p.nombre, 
                   descripcion: p.manual ? "Servicio / Ítem Manual" : (p.desc || p.cat),
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
       var manualVal = tieneTarget ? targetVal : (resContInput ? parseFloat(resContInput.value) : 0) || 0;
       
       var dPrc = tieneTarget ? 0 : descuentoGlobalPrc;
       var descuentoDinero = manualVal * (dPrc / 100);
       
       descuentoTotalCotizacion = descuentoDinero;
       subtotalBaseCotizacion = manualVal;
       
       var postDesc = Math.max(0, manualVal - descuentoDinero);
       
       if (conIvaGlobal && !tieneTarget) {
           ivaTotalCotizacion = postDesc * 0.19;
       }
       
       itemsData.push({ 
           nombre: concepto || "Venta Manual", 
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
   var totalFormateadoPDF = subtotalBaseCotizacion - descuentoTotalCotizacion + ivaTotalCotizacion;
   totalFormateadoPDF = Math.round(totalFormateadoPDF / 100) * 100;

   if (metodo === "Crédito") {
       // ── FIX BASE CIRCULAR (mismo criterio que calcCart): se reutiliza la
       // inicial YA CALCULADA por calcCart (window.calculatedValues.inicial)
       // en vez de re-estimar una inicial propia aquí — así el interés que
       // se imprime en la cotización PDF queda calculado sobre el mismo
       // saldo que realmente se financiará, y el total del PDF coincide con
       // el total que procesará la venta. ─────────────────────────────────
       var saldoBaseInteresPDF = Math.max(0, totalFormateadoPDF - (window.calculatedValues.inicial || 0));
       interesAplicado = saldoBaseInteresPDF * (tasaMensual / 100) * cuotas;
       interesAplicado = Math.round(interesAplicado / 100) * 100;
       
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
           totalFormateadoPDF += interesAplicado; 
       }
   }

   var d = {
       cliente: { nombre: cli, nit: nit, telefono: tel },
       items: itemsData,
       totales: { 
           subtotal: subtotalBaseCotizacion, 
           descuento: descuentoTotalCotizacion,
           iva: ivaTotalCotizacion,
           total: totalFormateadoPDF,
           inicial: window.calculatedValues.inicial,
           valorCuota: window.calculatedValues.valorCuota,
           ultimaCuota: window.calculatedValues.ultimaCuota
       },
       fecha: fechaVal
   };
   
   var loader = document.getElementById('loader');
   if(loader) loader.style.display = 'flex';
   
   window.callAPI('generarCotizacionPDF', d).then(r => { 
       if(loader) loader.style.display = 'none';
       unlockBtn();
       if(r.exito) { 
           window.open(r.url, '_blank');
           if(window.showToast) window.showToast("Cotización guardada y PDF generado", "success");
       } else { 
           alert("Error generando PDF: " + r.error); 
       } 
   }).catch(err => {
       if(loader) loader.style.display = 'none';
       unlockBtn();
       alert("Error de red al generar PDF.");
   });
}

// Exportaciones Globales
window.renderPos = renderPos;
window.autocompletarCliente = autocompletarCliente;
window.toggleCart = toggleCart;
window.agregarAlCarritoDesdeInv = agregarAlCarritoDesdeInv;
window.abrirEditorItem = abrirEditorItem;
window.calcEditorItem = calcEditorItem;
window.aplicarPrecioPactado = aplicarPrecioPactado;
window.guardarEditorItem = guardarEditorItem;
window.toggleItemIva = toggleItemIva;
window.changeQty = changeQty;
window.agregarItemManual = agregarItemManual;
window.calcularItemManual = calcularItemManual;
window.confirmarItemManual = confirmarItemManual;
window.filtrarClienteSugerido = filtrarClienteSugerido;
window.seleccionarClienteSugerido = seleccionarClienteSugerido;
window.ocultarSugerenciasCliente = ocultarSugerenciasCliente;
window.updatePrimerPago = updatePrimerPago;
window.updateCartUI = updateCartUI;
window.toggleManual = toggleManual;
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
// shareProdWhatsApp / getFileFromUrlAsync / shareProductNative viven en
// utils.js y ya se exportan ahí — no son funciones locales de este archivo.
