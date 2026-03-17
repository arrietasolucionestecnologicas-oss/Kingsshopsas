/* ARCHIVO: js/ui/finance.js - Motor Financiero KING'S SHOP */

function renderFin(){ 
  var s=document.getElementById('ab-cli'); s.innerHTML='<option value="">Seleccione...</option>'; 
  (window.D.deudores || []).filter(d => d.estado !== 'Castigado').forEach(d=>{ s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${window.COP.format(d.saldo)})</option>`; });
  
  var elFecha = document.getElementById('ab-fecha');
  if(elFecha) elFecha.value = new Date().toISOString().split('T')[0];

  var q = document.getElementById('hist-search') ? document.getElementById('hist-search').value.toLowerCase() : "";
  var h=document.getElementById('hist-list'); 
  if(!h) return;
  h.innerHTML=''; 
  var dataHist = window.D.historial || []; 
  dataHist.forEach((x, i) => x._originalIndex = i);
  if(q) dataHist = dataHist.filter(x => (x.desc && x.desc.toLowerCase().includes(q)) || (x.monto && x.monto.toString().includes(q)));

  if(dataHist.length === 0) { h.innerHTML = '<div class="text-center text-muted p-3">Sin movimientos registrados.</div>'; } 
  else { 
    dataHist.forEach(x => { 
        var i=(x.tipo.includes('ingreso')||x.tipo.includes('abono')); 
        var saldoMoment = (x.saldo !== undefined) ? `<small class="text-muted d-block" style="font-size:0.7rem;">Saldo: ${window.COP.format(x.saldo)}</small>` : '';
        h.innerHTML+=`<div class="mov-item d-flex align-items-center mb-2 p-2 border-bottom"><div class="mov-icon me-3 ${i?'text-success':'text-danger'}"><i class="fas fa-${i?'arrow-down':'arrow-up'}"></i></div><div class="flex-grow-1 lh-1"><div class="fw-bold small">${x.desc}</div><small class="text-muted" style="font-size:0.75rem">${x.fecha}</small></div><div class="text-end"><div class="fw-bold ${i?'text-success':'text-danger'}">${i?'+':'-'} ${window.COP.format(x.monto)}</div>${saldoMoment}</div><button class="btn btn-sm btn-light border-0 text-muted ms-2" onclick='window.abrirEditMov(${x._originalIndex})'>✏️</button></div>`; 
    }); 
  }
}

function abrirEditMov(index) {
    if (!window.D.historial[index]) return;
    window.movEditObj = window.D.historial[index]; 
    document.getElementById('ed-mov-desc').value = window.movEditObj.desc;
    document.getElementById('ed-mov-monto').value = window.movEditObj.monto;
    var elJust = document.getElementById('ed-mov-justificacion');
    if(elJust) elJust.value = ""; 
    var fechaRaw = window.movEditObj.fecha;
    document.getElementById('ed-mov-fecha').value = fechaRaw.includes('/') ? `${fechaRaw.split('/')[2]}-${fechaRaw.split('/')[1]}-${fechaRaw.split('/')[0]}` : fechaRaw.split(' ')[0];
    if(window.myModalEditMov) window.myModalEditMov.show();
}

function guardarEdicionMovimiento() {
    if(!window.movEditObj) return;
    var nuevaFecha = document.getElementById('ed-mov-fecha').value;
    var nuevoMonto = document.getElementById('ed-mov-monto').value;
    var justificacion = document.getElementById('ed-mov-justificacion') ? document.getElementById('ed-mov-justificacion').value.trim() : "Corrección";
    
    if(!nuevaFecha || !nuevoMonto) return alert("Fecha y monto requeridos");
    if(document.getElementById('ed-mov-justificacion') && justificacion.length < 5) return alert("⚠️ Justificación inválida.");
    
    var payload = { original: Object.assign({}, window.movEditObj), fecha: nuevaFecha, monto: nuevoMonto, justificacion: justificacion };
    window.movEditObj.fecha = nuevaFecha; window.movEditObj.monto = nuevoMonto;
    
    if(window.myModalEditMov) window.myModalEditMov.hide();
    renderFin();
    if(window.showToast) window.showToast("Actualizando...", "success");
    window.callAPI('editarMovimiento', payload).then(r => { if(!r.exito) { alert(r.error); if(window.loadData) window.loadData(true); } });
}

function doIngresoExtra() {
    var desc = document.getElementById('inc-desc').value;
    var cat = document.getElementById('inc-cat').value;
    var monto = document.getElementById('inc-monto').value;
    if(!desc || !monto) return alert("Falta descripción o monto");
    
    var acreedor = "", fechaLimite = "";
    if (cat === 'Prestamo') {
        acreedor = document.getElementById('inc-acreedor').value;
        fechaLimite = document.getElementById('inc-fecha-limite').value;
        if(!acreedor || !fechaLimite) return alert("Acreedor y Fecha obligatorios");
    }
    
    var ingresoNum = parseFloat(monto) || 0;
    if(window.D.metricas) window.D.metricas.saldo += ingresoNum;
    window.D.historial.unshift({ desc: "Ingreso Extra: " + desc, tipo: "ingresos", monto: ingresoNum, fecha: new Date().toISOString().split('T')[0], _originalIndex: window.D.historial.length, saldo: window.D.metricas.saldo });
    
    if (cat === 'Prestamo') {
         window.D.pasivos.push({ id: "PAS-" + Date.now(), acreedor: acreedor, monto: ingresoNum, saldo: ingresoNum, fechaLimite: fechaLimite });
         if(window.renderPasivos) window.renderPasivos();
    }
    
    document.getElementById('inc-desc').value = ''; document.getElementById('inc-monto').value = '';
    if(document.getElementById('inc-acreedor')) document.getElementById('inc-acreedor').value = '';
    if(document.getElementById('inc-fecha-limite')) document.getElementById('inc-fecha-limite').value = '';
    if(document.getElementById('box-prestamo')) document.getElementById('box-prestamo').style.display = 'none';
    document.getElementById('inc-cat').value = 'Venta Externa';
    
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Ingreso registrado", "success");
    window.callAPI('registrarIngresoExtra', { desc: desc, cat: cat, monto: monto, acreedor: acreedor, fechaLimite: fechaLimite });
}

function doGasto() {
    var desc = document.getElementById('g-desc').value;
    var monto = document.getElementById('g-monto').value;
    var vinculoRaw = document.getElementById('g-vinculo').value; 
    if(!desc || !monto) return alert("Falta descripción o monto");

    var match = vinculoRaw.match(/\[(.*?)\]$/); 
    var vinculoClean = match ? match[1] : vinculoRaw;

    var gastoNum = parseFloat(monto) || 0;
    if(window.D.metricas) window.D.metricas.saldo -= gastoNum;
    window.D.historial.unshift({ desc: "Gasto: " + desc, tipo: "egreso", monto: gastoNum, fecha: new Date().toISOString().split('T')[0], _originalIndex: window.D.historial.length, saldo: window.D.metricas.saldo });

    document.getElementById('g-desc').value = ''; document.getElementById('g-monto').value = ''; document.getElementById('g-vinculo').value = '';
    renderFin();
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Gasto registrado", "success");
    window.callAPI('registrarGasto', { desc: desc, cat: document.getElementById('g-cat').value, monto: monto, vinculo: vinculoClean });
}

function updateGastosSelect() {
    var dl = document.getElementById('g-vinculo-list');
    if(dl) {
        dl.innerHTML = ''; 
        if (window.D.ultimasVentas && window.D.ultimasVentas.length > 0) {
            window.D.ultimasVentas.forEach(v => { dl.innerHTML += `<option value="${v.desc} [${v.id}]"></option>`; });
        }
        if (window.D.inv && window.D.inv.length > 0) {
            [...window.D.inv].sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => { dl.innerHTML += `<option value="Stock: ${p.nombre} [${p.id}]"></option>`; });
        }
    }
}

function verificarBanco() {
    var real = parseFloat(document.getElementById('audit-banco').value) || 0;
    var sys = (window.D.metricas && window.D.metricas.saldo) ? window.D.metricas.saldo : 0;
    var el = document.getElementById('audit-res');
    el.innerHTML = Math.abs(sys - real) < 1 ? '<span class="badge bg-success">✅ Perfecto</span>' : `<span class="badge bg-danger">❌ Desfase: ${window.COP.format(sys - real)}</span>`; 
}

function renderCartera() {
    var c = document.getElementById('cartera-list');
    var bal = document.getElementById('bal-cartera');
    if(!c) return;
    c.innerHTML = '';
    
    var activos = (window.D.deudores || []).filter(d => d.estado !== 'Castigado');
    var castigados = (window.D.deudores || []).filter(d => d.estado === 'Castigado');
    
    if(activos.length === 0) {
        c.innerHTML = '<div class="text-center text-muted p-5">👏 Excelente, no hay deudas pendientes.</div>';
    } else {
        activos.forEach(d => {
            var fechaTxt = d.fechaLimite ? `<small class="text-muted"><i class="far fa-calendar-alt"></i> Vence: ${d.fechaLimite}</small>` : '<small class="text-muted">Sin fecha</small>';
            var planDetalle = "", badgeAdelanto = "";
            
            if (d.fechaLimiteRaw && (d.deudaInicial || 0) <= 0 && d.saldo > 0 && Math.ceil((new Date(d.fechaLimiteRaw).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) > 30) {
                badgeAdelanto = `<span class="badge bg-success mt-1"><i class="fas fa-check-circle"></i> Adelantado</span>`;
            }

            if ((d.deudaInicial || 0) > 0) {
                planDetalle = `<div class="mt-2 p-2 bg-warning border rounded text-dark" style="font-size:0.85rem;"><div class="d-flex justify-content-between fw-bold"><span><i class="fas fa-exclamation-triangle"></i> Faltante Inicial:</span><span>${window.COP.format(d.deudaInicial)}</span></div></div>`;
            } else {
                var valCuotaReal = parseFloat(d.valCuota) || 0;
                var numCuotas = parseInt(d.cuotas) || 1;
                if(valCuotaReal > 0) {
                    var cuotasRestantes = (d.saldo / valCuotaReal).toFixed(1);
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between"><span>Cuota Fija:</span><strong>${window.COP.format(valCuotaReal)}</strong></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Restan:</span><span>${cuotasRestantes.endsWith('.0') ? parseInt(cuotasRestantes) : cuotasRestantes} Cuotas</span></div></div>`;
                } else if (numCuotas > 1 && d.saldo > 0) {
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between text-muted"><span>Plan Original:</span><span>${numCuotas} Cuotas</span></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Cuota Aprox:</span><span>${window.COP.format(d.saldo / numCuotas)} (Est)</span></div></div>`;
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
                        <h5 class="fw-bold text-danger m-0">${window.COP.format(d.saldo)}</h5>
                        <span class="badge-debt d-inline-block mt-1">Pendiente</span>
                        <button class="btn btn-sm text-muted p-0 ms-1" onclick="window.castigarDeuda('${d.idVenta}', '${d.cliente.replace(/'/g, "\\'")}')" title="Castigar Cartera"><i class="fas fa-skull-crossbones"></i></button>
                        <br>${badgeAdelanto}
                    </div>
                </div>
                <div class="mt-2 d-flex gap-2 flex-wrap justify-content-end border-top pt-2">
                    <button class="btn btn-xs btn-outline-success flex-fill" onclick="window.notificarCobroWA('${d.idVenta}')" title="Cobrar Cuota"><i class="fab fa-whatsapp"></i> Cobrar</button>
                    <button class="btn btn-xs btn-outline-info flex-fill fw-bold" onclick="window.compartirBalanceWA('${d.idVenta}')" title="Enviar Extracto"><i class="fas fa-file-invoice-dollar"></i> Balance</button>
                    <button class="btn btn-xs btn-outline-primary flex-fill" onclick="window.abrirModalRefinanciar('${d.idVenta}', '${d.cliente.replace(/'/g, "\\'")}', ${d.saldo})" title="Refinanciar Deuda">🔄 Refinanc.</button>
                </div>
                ${planDetalle}
            </div>`;
        });
    }
    
    if (castigados.length > 0) {
        c.innerHTML += `<hr class="my-4"><h6 class="text-muted mb-3"><i class="fas fa-skull-crossbones"></i> Cartera Castigada (${castigados.length})</h6>`;
        castigados.forEach(d => {
             c.innerHTML += `<div class="card-k bg-light opacity-75"><div class="d-flex justify-content-between"><div><strong>${d.cliente}</strong><br><small>${d.producto}</small></div><div class="text-end text-muted fw-bold">${window.COP.format(d.saldo)}<br><small class="badge bg-secondary">Castigado</small></div></div></div>`;
        });
    }
    if(bal) bal.innerText = window.COP.format(activos.reduce((acc, d) => acc + d.saldo, 0));
}

function notificarCobroWA(idVenta) {
    var d = window.D.deudores.find(x => x.idVenta === idVenta);
    if (!d) return alert("Error: Deuda no encontrada en memoria.");
    
    var msg = `👑 *KING'S SHOP* 👑\n\nHola 👋 espero que estés muy bien! 🌟\n\n`;
    if ((d.deudaInicial || 0) > 0) {
        msg += `Pasamos por aquí para recordarte el saldo pendiente de la *Cuota Inicial* de tu compra:\n\n📦 *Producto:* ${d.producto}\n⚠️ *Faltante Inicial:* ${window.COP.format(d.deudaInicial)}\n\nQuedamos muy atentos a tu comprobante de pago para formalizar tu plan. ¡Gracias por tu confianza! 🤝`;
    } else {
        msg += `Pasamos por aquí para recordarte el pago de tu *${d.producto}* 📦.\n\n💳 *${(parseFloat(d.valCuota)||0) > 0 ? "Cuota" : "Saldo Total"}:* ${window.COP.format((parseFloat(d.valCuota)||0) > 0 ? parseFloat(d.valCuota) : d.saldo)}\n📅 *Fecha:* ${d.fechaLimite || "Pago Inmediato"}\n\nQuedamos muy atentos a tus comprobantes. ¡Gracias por tu confianza! 🤝`;
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), '_blank');
}

function compartirBalanceWA(idVenta) {
    var d = window.D.deudores.find(x => x.idVenta === idVenta);
    if (!d) return alert("Error: Deuda no encontrada en memoria.");
    
    var msg = `👑 *KING'S SHOP* 👑\n\nHola 👋.\n\nTe compartimos el estado de tu crédito por el *${d.producto}* 📦:\n\n`;
    if ((d.deudaInicial || 0) > 0) {
        msg += `⚠️ *Aviso:* Aún tienes un saldo pendiente de ${window.COP.format(d.deudaInicial)} correspondiente a la Cuota Inicial.\n\n⏳ *Saldo Total Pendiente:* ${window.COP.format(d.saldo)}\n\nUna vez cubiertas las iniciales, te enviaremos el extracto de tus cuotas. 🤝`;
    } else {
        var valCuotaReal = parseFloat(d.valCuota) || 0;
        var numCuotas = parseInt(d.cuotas) || 1;
        if (valCuotaReal > 0 && numCuotas > 1) {
            var deudaOriginal = Math.max(valCuotaReal * numCuotas, d.saldo);
            var totalAbonado = Math.max(0, deudaOriginal - d.saldo);
            var cuotasCubiertas = (totalAbonado / valCuotaReal).toFixed(1);
            msg += `💰 *Financiado:* ${window.COP.format(deudaOriginal)} (${numCuotas} Cuotas)\n✅ *Total Abonado:* ${window.COP.format(totalAbonado)} (Aprox. ${cuotasCubiertas.endsWith('.0') ? parseInt(cuotasCubiertas) : cuotasCubiertas} cuotas cubiertas)\n⏳ *Saldo Pendiente:* ${window.COP.format(d.saldo)}\n\n`;
        } else {
            msg += `⏳ *Saldo Pendiente:* ${window.COP.format(d.saldo)}\n\n`;
        }
        msg += `Cualquier duda estamos a tu disposición. 🤝`;
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), '_blank');
}

function abrirModalRefinanciar(id, cliente, saldo) {
    window.refEditId = id; window.refSaldoActual = parseFloat(saldo) || 0;
    document.getElementById('ref-cliente').value = cliente;
    document.getElementById('ref-saldo-actual').value = window.COP.format(window.refSaldoActual);
    document.getElementById('ref-cargo').value = "0"; document.getElementById('ref-cuotas').value = "1";
    var t = new Date(); t.setMonth(t.getMonth() + 1);
    document.getElementById('ref-fecha').value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    calcRefinanciamiento();
    if(window.myModalRefinanciar) window.myModalRefinanciar.show();
}

function calcRefinanciamiento() {
    var nuevoSaldo = window.refSaldoActual + (parseFloat(document.getElementById('ref-cargo').value) || 0);
    document.getElementById('ref-nuevo-saldo').innerText = window.COP.format(nuevoSaldo);
    document.getElementById('ref-nueva-cuota').innerText = window.COP.format(nuevoSaldo / (parseInt(document.getElementById('ref-cuotas').value) || 1)) + " / mes";
}

function procesarRefinanciamiento() {
    if(!window.refEditId) return;
    var cargo = parseFloat(document.getElementById('ref-cargo').value) || 0;
    var cuotas = parseInt(document.getElementById('ref-cuotas').value) || 1;
    var fecha = document.getElementById('ref-fecha').value;
    if(!fecha || cuotas < 1) return alert("Verifica las cuotas y la fecha");
    
    var dIdx = window.D.deudores.findIndex(x => x.idVenta === window.refEditId);
    if(dIdx > -1) {
        window.D.deudores[dIdx].saldo += cargo;
        window.D.deudores[dIdx].valCuota = window.D.deudores[dIdx].saldo / cuotas;
        window.D.deudores[dIdx].cuotas = cuotas;
        window.D.deudores[dIdx].fechaLimite = fecha;
    }
    if(window.myModalRefinanciar) window.myModalRefinanciar.hide();
    renderCartera();
    if(window.showToast) window.showToast("Refinanciando...", "success");
    window.callAPI('refinanciarDeuda', { idVenta: window.refEditId, cargoAdicional: cargo, nuevasCuotas: cuotas, nuevaFecha: fecha }).then(r => { if(!r.exito && window.loadData) window.loadData(true); });
}

function castigarDeuda(id, nombre) {
    Swal.fire({ title: '¿Castigar Cartera?', text: `Vas a enviar a "${nombre}" a pérdida.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, Castigar', confirmButtonColor: '#000', cancelButtonColor: '#d33' }).then((result) => {
        if (result.isConfirmed) {
            var d = window.D.deudores.find(x => x.idVenta === id);
            if(d) d.estado = 'Castigado';
            renderCartera();
            if(window.showToast) window.showToast("Cartera castigada", "success");
            window.callAPI('castigarCartera', {idVenta: id}).then(r => { if(!r.exito && window.loadData) window.loadData(true); });
        }
    });
}

function doAbono(){
    var id=document.getElementById('ab-cli').value; if(!id)return alert("Seleccione un cliente");
    var cli=document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text.split(' - ')[0].trim();
    var monto = document.getElementById('ab-monto').value;
    var abonoNum = parseFloat(monto) || 0;
    
    if(window.D.metricas) window.D.metricas.saldo += abonoNum;
    var dIndex = window.D.deudores.findIndex(x => x.idVenta === id);
    if(dIndex > -1) {
        window.D.deudores[dIndex].saldo = Math.max(0, window.D.deudores[dIndex].saldo - abonoNum);
        if(window.D.deudores[dIndex].saldo <= 100) window.D.deudores[dIndex].estado = 'Pagado';
    }
    
    window.D.historial.unshift({ desc: "Abono: " + cli, tipo: "abono", monto: abonoNum, fecha: document.getElementById('ab-fecha').value || new Date().toISOString().split('T')[0], _originalIndex: window.D.historial.length, saldo: window.D.metricas.saldo });
    document.getElementById('ab-monto').value = '';
    renderCartera(); renderFin();
    if(document.getElementById('bal-caja') && window.D.metricas) document.getElementById('bal-caja').innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Abono registrado", "success");
    window.callAPI('registrarAbono', {idVenta:id, monto:monto, cliente:cli, fecha: document.getElementById('ab-fecha').value});
}

function renderPasivos() {
    var el = document.getElementById('bal-pasivos');
    if(el) el.innerText = window.COP.format(window.D.pasivos.reduce((sum, p) => sum + (Number(p.saldo)||0), 0));
}

function abrirModalPasivos() {
    var sel = document.getElementById('pas-select'); if(!sel) return;
    sel.innerHTML = '<option value="">Seleccione...</option>';
    if (window.D.pasivos.length === 0) { sel.innerHTML += `<option value="" disabled>Sin obligaciones</option>`; } 
    else { window.D.pasivos.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.acreedor} (Debes: ${window.COP.format(p.saldo)})</option>`; }); }
    if(document.getElementById('pas-monto')) document.getElementById('pas-monto').value = '';
    if(window.myModalAbonarPasivo) window.myModalAbonarPasivo.show();
}

function seleccionarPasivo() {
    var p = window.D.pasivos.find(x => x.id === document.getElementById('pas-select').value);
    if(p && document.getElementById('pas-monto')) document.getElementById('pas-monto').value = p.saldo;
}

function doAbonoPasivo() {
    var id = document.getElementById('pas-select').value;
    var monto = parseFloat(document.getElementById('pas-monto').value) || 0;
    if(!id || monto <= 0) return alert("Monto inválido.");
    
    var pIdx = window.D.pasivos.findIndex(x => x.id === id);
    var acreedorName = "Desconocido";
    if(pIdx > -1) {
        acreedorName = window.D.pasivos[pIdx].acreedor;
        window.D.pasivos[pIdx].saldo -= monto;
        if(window.D.pasivos[pIdx].saldo <= 0) window.D.pasivos.splice(pIdx, 1);
    }
    
    if(window.D.metricas) window.D.metricas.saldo -= monto;
    window.D.historial.unshift({ desc: "Pago a Deuda: " + acreedorName, tipo: "egreso", monto: monto, fecha: new Date().toISOString().split('T')[0], _originalIndex: window.D.historial.length, saldo: window.D.metricas.saldo });
    
    if(window.myModalAbonarPasivo) window.myModalAbonarPasivo.hide();
    renderPasivos(); renderFin();
    if(document.getElementById('bal-caja') && window.D.metricas) document.getElementById('bal-caja').innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Pago registrado", "success");
    window.callAPI('abonarPasivo', {idPasivo: id, monto: monto, acreedor: acreedorName});
}

function renderPed(){ 
    var c=document.getElementById('ped-list'); if(!c) return; c.innerHTML=''; 
    (window.D.ped || []).forEach(p=>{ 
        var isPend = p.estado === 'Pendiente'; 
        var badge = isPend ? `<span class="badge bg-warning text-dark">${p.estado}</span>` : `<span class="badge bg-success">${p.estado}</span>`; 
        var controls = `<div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-outline-secondary flex-fill" onclick='window.openEditPed(${JSON.stringify(p)})'>✏️</button><button class="btn btn-sm btn-outline-danger flex-fill" onclick="window.delPed('${p.id}')">🗑️</button>${isPend ? `<button class="btn btn-sm btn-outline-success flex-fill" onclick="window.comprarPedido('${p.id}', '${p.prod.replace(/'/g, "\\'")}')">✅</button>` : ''}</div>`; 
        c.innerHTML+=`<div class="card-k border-start border-4 ${isPend?'border-warning':'border-success'}"><div class="d-flex justify-content-between"><div><strong>${p.prod}</strong><br><small class="text-muted">${p.prov || 'Sin Prov.'}</small></div><div class="text-end"><small>${p.fecha}</small><br>${badge}</div></div>${p.notas ? `<div class="small text-muted mt-1 fst-italic">"${p.notas}"</div>` : ''}${controls}</div>`; 
    }); 
}

function abrirModalPed() { if(window.myModalPed) window.myModalPed.show(); }

function savePed(){ 
    var p=document.getElementById('pe-prod').value; if(!p) return alert("Escribe producto"); 
    window.callAPI('guardarPedido', { user: window.currentUserAlias, prod: p, prov: document.getElementById('pe-prov').value, costoEst: document.getElementById('pe-costo').value, notas: document.getElementById('pe-nota').value }).then(()=>{ if(window.loadData) window.loadData(true); }); 
    if(window.showToast) window.showToast("Pedido guardado", "success"); 
}

function openEditPed(p) { 
    window.pedEditId = p.id; 
    document.getElementById('ed-ped-prod').value = p.prod; document.getElementById('ed-ped-prov').value = p.prov; 
    document.getElementById('ed-ped-costo').value = p.costo; document.getElementById('ed-ped-nota').value = p.notas; 
    if(window.myModalEditPed) window.myModalEditPed.show(); 
}

function guardarEdicionPed() { 
    if(!window.pedEditId) return; 
    if(window.myModalEditPed) window.myModalEditPed.hide(); 
    if(window.showToast) window.showToast("Editando pedido...", "info"); 
    window.callAPI('editarPedido', { id: window.pedEditId, prod: document.getElementById('ed-ped-prod').value, prov: document.getElementById('ed-ped-prov').value, costoEst: document.getElementById('ed-ped-costo').value, notas: document.getElementById('ed-ped-nota').value }).then(r => { if(r.exito) { if(window.loadData) window.loadData(true); } else alert(r.error); }); 
}

function delPed(id) { 
    Swal.fire({ title: '¿Eliminar Pedido?', input: 'text', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí', preConfirm: (j) => { if (!j || j.length < 4) Swal.showValidationMessage('Justifica'); return j; } }).then((result) => { 
        if (result.isConfirmed) { 
            if(window.showToast) window.showToast("Eliminando...", "info"); 
            window.callAPI('eliminarPedido', {id: id, justificacion: result.value}).then(r => { if(r.exito) { if(window.loadData) window.loadData(true); } else alert(r.error); }); 
        } 
    }); 
}

function comprarPedido(id, nombreProd) { 
    Swal.fire({ title: 'Confirmar Compra', text: `Costo REAL final de "${nombreProd}".`, input: 'number', showCancelButton: true, confirmButtonText: 'Registrar', inputValidator: (v) => { if (!v || v <= 0) return 'Costo inválido.'; } }).then((result) => { 
        if (result.isConfirmed) { 
            if(window.showToast) window.showToast("Procesando...", "info"); 
            window.callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => { if(r.exito) Swal.fire('¡Éxito!', '', 'success').then(() => { if(window.loadData) window.loadData(true); }); else alert(r.error); }); 
        } 
    }); 
}

// Exportaciones Globales
window.renderFin = renderFin;
window.abrirEditMov = abrirEditMov;
window.guardarEdicionMovimiento = guardarEdicionMovimiento;
window.doIngresoExtra = doIngresoExtra;
window.doGasto = doGasto;
window.updateGastosSelect = updateGastosSelect;
window.verificarBanco = verificarBanco;
window.renderCartera = renderCartera;
window.notificarCobroWA = notificarCobroWA;
window.compartirBalanceWA = compartirBalanceWA;
window.abrirModalRefinanciar = abrirModalRefinanciar;
window.calcRefinanciamiento = calcRefinanciamiento;
window.procesarRefinanciamiento = procesarRefinanciamiento;
window.castigarDeuda = castigarDeuda;
window.doAbono = doAbono;
window.renderPasivos = renderPasivos;
window.abrirModalPasivos = abrirModalPasivos;
window.seleccionarPasivo = seleccionarPasivo;
window.doAbonoPasivo = doAbonoPasivo;
window.renderPed = renderPed;
window.abrirModalPed = abrirModalPed;
window.savePed = savePed;
window.openEditPed = openEditPed;
window.guardarEdicionPed = guardarEdicionPed;
window.delPed = delPed;
window.comprarPedido = comprarPedido;
