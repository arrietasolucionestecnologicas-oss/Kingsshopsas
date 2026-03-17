/* ARCHIVO: js/ui/finance.js - Motor Financiero KING'S SHOP */

function renderFin() { 
    var s = document.getElementById('ab-cli'); 
    s.innerHTML = '<option value="">Seleccione...</option>'; 
    
    (window.D.deudores || []).filter(d => d.estado !== 'Castigado').forEach(d => { 
        s.innerHTML += `<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${window.COP.format(d.saldo)})</option>`; 
    });
  
    var elFecha = document.getElementById('ab-fecha');
    if(elFecha) elFecha.value = new Date().toISOString().split('T')[0];

    var elSearch = document.getElementById('hist-search');
    var q = elSearch ? elSearch.value.toLowerCase() : "";
    var h = document.getElementById('hist-list'); 
    if(!h) return;
    
    h.innerHTML = ''; 
    var dataHist = window.D.historial || []; 
    
    dataHist.forEach((x, originalIndex) => {
        x._originalIndex = originalIndex;
    });

    if(q) {
        dataHist = dataHist.filter(x => (x.desc && x.desc.toLowerCase().includes(q)) || (x.monto && x.monto.toString().includes(q)));
    }

    if(dataHist.length === 0) { 
        h.innerHTML = '<div class="text-center text-muted p-3">Sin movimientos registrados.</div>'; 
    } else { 
        dataHist.forEach((x) => { 
            var i = (x.tipo.includes('ingreso') || x.tipo.includes('abono')); 
            var btnEdit = `<button class="btn btn-sm btn-light border-0 text-muted ms-2" onclick='window.abrirEditMov(${x._originalIndex})'><i class="fas fa-pencil-alt"></i></button>`;
            var saldoMoment = (x.saldo !== undefined) ? `<small class="text-muted d-block" style="font-size:0.7rem;">Saldo: ${window.COP.format(x.saldo)}</small>` : '';
            
            h.innerHTML += `
            <div class="mov-item d-flex align-items-center mb-2 p-2 border-bottom">
                <div class="mov-icon me-3 ${i ? 'text-success' : 'text-danger'}">
                    <i class="fas fa-${i ? 'arrow-down' : 'arrow-up'}"></i>
                </div>
                <div class="flex-grow-1 lh-1">
                    <div class="fw-bold small">${x.desc}</div>
                    <small class="text-muted" style="font-size:0.75rem">${x.fecha}</small>
                </div>
                <div class="text-end">
                    <div class="fw-bold ${i ? 'text-success' : 'text-danger'}">${i ? '+' : '-'} ${window.COP.format(x.monto)}</div>
                    ${saldoMoment}
                </div>
                ${btnEdit}
            </div>`; 
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
    var fechaIso = "";
    if(fechaRaw.includes('/')) { 
        var parts = fechaRaw.split('/'); 
        if(parts.length === 3) fechaIso = `${parts[2]}-${parts[1]}-${parts[0]}`; 
    } else { 
        fechaIso = fechaRaw.split(' ')[0]; 
    }
    
    document.getElementById('ed-mov-fecha').value = fechaIso;
    
    if(window.myModalEditMov) window.myModalEditMov.show();
}

function guardarEdicionMovimiento() {
    if(!window.movEditObj) return;
    
    var nuevaFecha = document.getElementById('ed-mov-fecha').value;
    var nuevoMonto = document.getElementById('ed-mov-monto').value;
    var elJust = document.getElementById('ed-mov-justificacion');
    var justificacion = elJust ? elJust.value.trim() : "Corrección";
    
    if(!nuevaFecha || !nuevoMonto) return alert("Fecha y monto requeridos");
    if(elJust && justificacion.length < 5) return alert("⚠️ Debe escribir una justificación válida para alterar la caja.");
    
    var originalClone = Object.assign({}, window.movEditObj);
    var payload = { original: originalClone, fecha: nuevaFecha, monto: nuevoMonto, justificacion: justificacion };
    
    window.movEditObj.fecha = nuevaFecha;
    window.movEditObj.monto = nuevoMonto;
    
    if(window.myModalEditMov) window.myModalEditMov.hide();
    
    renderFin();
    if(window.showToast) window.showToast("Movimiento actualizado (Guardando...)", "success");
    
    window.callAPI('editarMovimiento', payload).then(r => { 
        if(!r.exito) { 
            alert("Error al editar: " + r.error); 
            if(window.loadData) window.loadData(true); 
        } 
    });
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
    if(window.D.metricas) window.D.metricas.saldo += ingresoNum;
    
    window.D.historial.unshift({ 
        desc: "Ingreso Extra: " + desc, 
        tipo: "ingresos", 
        monto: ingresoNum, 
        fecha: new Date().toISOString().split('T')[0], 
        _originalIndex: window.D.historial.length, 
        saldo: window.D.metricas.saldo 
    });
    
    if (cat === 'Prestamo') {
         window.D.pasivos.push({
             id: "PAS-" + Date.now(), 
             acreedor: acreedor, 
             monto: ingresoNum, 
             saldo: ingresoNum, 
             fechaLimite: fechaLimite
         });
         if(window.renderPasivos) window.renderPasivos();
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
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Ingreso registrado", "success");
    
    window.callAPI('registrarIngresoExtra', { desc: desc, cat: cat, monto: monto, acreedor: acreedor, fechaLimite: fechaLimite });
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
    if(window.D.metricas) window.D.metricas.saldo -= gastoNum;
    
    window.D.historial.unshift({ 
        desc: "Gasto: " + desc, 
        tipo: "egreso", 
        monto: gastoNum, 
        fecha: new Date().toISOString().split('T')[0], 
        _originalIndex: window.D.historial.length, 
        saldo: window.D.metricas.saldo 
    });

    document.getElementById('g-desc').value = '';
    document.getElementById('g-monto').value = '';
    document.getElementById('g-vinculo').value = '';
    
    renderFin();
    
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    if(window.showToast) window.showToast("Gasto registrado", "success");

    window.callAPI('registrarGasto', d);
}

function updateGastosSelect() {
    var dl = document.getElementById('g-vinculo-list');
    if(dl) {
        dl.innerHTML = ''; 
        if (window.D.ultimasVentas && window.D.ultimasVentas.length > 0) {
            window.D.ultimasVentas.forEach(v => { 
                var o = document.createElement('option'); 
                o.value = `${v.desc} [${v.id}]`; 
                dl.appendChild(o); 
            });
        }
        if (window.D.inv && window.D.inv.length > 0) {
            var invSorted = [...window.D.inv].sort((a,b) => a.nombre.localeCompare(b.nombre));
            invSorted.forEach(p => {
                var o = document.createElement('option');
                o.value = `Stock: ${p.nombre} [${p.id}]`;
                dl.appendChild(o);
            });
        }
    }
}

function verificarBanco() {
    var real = parseFloat(document.getElementById('audit-banco').value) || 0;
    var sys = (window.D.metricas && window.D.metricas.saldo) ? window.D.metricas.saldo : 0;
    var diff = sys - real;
    var el = document.getElementById('audit-res');
    
    if(Math.abs(diff) < 1) { 
        el.innerHTML = '<span class="badge bg-success">✅ Perfecto</span>'; 
    } else { 
        el.innerHTML = `<span class="badge bg-danger">❌ Desfase: ${window.COP.format(diff)}</span>`; 
    }
}

function renderCartera() {
    var c = document.getElementById('cartera-list');
    var bal = document.getElementById('bal-cartera');
    if(!c) return;
    
    c.innerHTML = '';
    
    var activos = (window.D.deudores || []).filter(d => d.estado !== 'Castigado');
    var castigados = (window.D.deudores || []).filter(d => d.estado === 'Castigado');
    
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
                planDetalle = `<div class="mt-2 p-2 bg-warning border rounded text-dark" style="font-size:0.85rem;"><div class="d-flex justify-content-between fw-bold"><span><i class="fas fa-exclamation-triangle"></i> Faltante Inicial:</span><span>${window.COP.format(d.deudaInicial)}</span></div></div>`;
            } else {
                var valCuotaReal = parseFloat(d.valCuota) || 0;
                var numCuotas = parseInt(d.cuotas) || 1;
                
                if(valCuotaReal > 0) {
                    var cuotasRestantes = (d.saldo / valCuotaReal).toFixed(1);
                    if(cuotasRestantes.endsWith('.0')) cuotasRestantes = parseInt(cuotasRestantes);
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between"><span>Cuota Fija:</span><strong>${window.COP.format(valCuotaReal)}</strong></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Restan:</span><span>${cuotasRestantes} Cuotas</span></div></div>`;
                } else if (numCuotas > 1 && d.saldo > 0) {
                    var cuotaEstimada = d.saldo / numCuotas; 
                    planDetalle = `<div class="mt-2 p-2 bg-light border rounded" style="font-size:0.85rem;"><div class="d-flex justify-content-between text-muted"><span>Plan Original:</span><span>${numCuotas} Cuotas</span></div><div class="d-flex justify-content-between text-danger fw-bold"><span>Cuota Aprox:</span><span>${window.COP.format(cuotaEstimada)} (Est)</span></div></div>`;
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
                    <button class="btn btn-xs btn-outline-dark flex-fill fw-bold" onclick="window.abrirRadiografia('${d.idVenta}')" title="Ver Radiografía Financiera"><i class="fas fa-microscope"></i> Detalles</button>
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
             c.innerHTML += `
             <div class="card-k bg-light opacity-75">
                <div class="d-flex justify-content-between">
                    <div><strong>${d.cliente}</strong><br><small>${d.producto}</small></div>
                    <div class="text-end text-muted fw-bold">${window.COP.format(d.saldo)}<br><small class="badge bg-secondary">Castigado</small></div>
                </div>
             </div>`;
        });
    }
    
    if(bal) bal.innerText = window.COP.format(totalDeuda);
}

function notificarCobroWA(idVenta) {
    var d = window.D.deudores.find(x => x.idVenta === idVenta);
    if (!d) return alert("Error: Deuda no encontrada en memoria.");
    
    var msg = `👑 *KING'S SHOP* 👑\n\n`;
    msg += `Hola 👋 espero que estés muy bien! 🌟\n\n`;
    
    if ((d.deudaInicial || 0) > 0) {
        msg += `Pasamos por aquí para recordarte el saldo pendiente de la *Cuota Inicial* de tu compra:\n\n`;
        msg += `📦 *Producto:* ${d.producto}\n`;
        msg += `⚠️ *Faltante Inicial:* ${window.COP.format(d.deudaInicial)}\n\n`;
        msg += `Quedamos muy atentos a tu comprobante de pago para formalizar tu plan. ¡Gracias por tu confianza! 🤝`;
    } else {
        var valCuotaReal = parseFloat(d.valCuota) || 0;
        var fechaTxt = d.fechaLimite || "Pago Inmediato";
        
        msg += `Pasamos por aquí para recordarte el pago de tu *${d.producto}* 📦.\n\n`;
        
        if (valCuotaReal > 0) {
            msg += `💳 *Cuota:* ${window.COP.format(valCuotaReal)}\n`;
        } else {
            msg += `💳 *Saldo Total:* ${window.COP.format(d.saldo)}\n`;
        }
        
        msg += `📅 *Fecha:* ${fechaTxt}\n\n`;
        msg += `Quedamos muy atentos a tus comprobantes. ¡Gracias por tu confianza! 🤝`;
    }
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

function compartirBalanceWA(idVenta) {
    var d = window.D.deudores.find(x => x.idVenta === idVenta);
    if (!d) return alert("Error: Deuda no encontrada en memoria.");
    
    var msg = `👑 *KING'S SHOP* 👑\n\n`;
    msg += `Hola 👋.\n\n`;
    msg += `Te compartimos el estado de tu crédito por el *${d.producto}* 📦:\n\n`;
    
    if ((d.deudaInicial || 0) > 0) {
        msg += `⚠️ *Aviso:* Aún tienes un saldo pendiente de ${window.COP.format(d.deudaInicial)} correspondiente a la Cuota Inicial.\n\n`;
        msg += `⏳ *Saldo Total Pendiente:* ${window.COP.format(d.saldo)}\n\n`;
        msg += `Una vez cubiertas las iniciales, te enviaremos el extracto de tus cuotas. 🤝`;
    } else {
        var valCuotaReal = parseFloat(d.valCuota) || 0;
        var numCuotas = parseInt(d.cuotas) || 1;
        
        if (valCuotaReal > 0 && numCuotas > 1) {
            var deudaOriginal = valCuotaReal * numCuotas;
            if (deudaOriginal < d.saldo) deudaOriginal = d.saldo; 
            
            var totalAbonado = deudaOriginal - d.saldo;
            if (totalAbonado < 0) totalAbonado = 0;
            
            var cuotasCubiertas = (totalAbonado / valCuotaReal).toFixed(1);
            if (cuotasCubiertas.endsWith('.0')) cuotasCubiertas = parseInt(cuotasCubiertas);

            msg += `💰 *Financiado:* ${window.COP.format(deudaOriginal)} (${numCuotas} Cuotas)\n`;
            msg += `✅ *Total Abonado:* ${window.COP.format(totalAbonado)} (Aprox. ${cuotasCubiertas} cuotas cubiertas)\n`;
            msg += `⏳ *Saldo Pendiente:* ${window.COP.format(d.saldo)}\n\n`;
        } else {
            msg += `⏳ *Saldo Pendiente:* ${window.COP.format(d.saldo)}\n\n`;
        }
        msg += `Cualquier duda estamos a tu disposición. 🤝`;
    }
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

function abrirModalRefinanciar(id, cliente, saldo) {
    window.refEditId = id;
    window.refSaldoActual = parseFloat(saldo) || 0;
    
    document.getElementById('ref-cliente').value = cliente;
    document.getElementById('ref-saldo-actual').value = window.COP.format(window.refSaldoActual);
    document.getElementById('ref-cargo').value = "0";
    document.getElementById('ref-cuotas').value = "1";
    
    var today = new Date();
    today.setMonth(today.getMonth() + 1);
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('ref-fecha').value = `${yyyy}-${mm}-${dd}`;
    
    calcRefinanciamiento();
    if(window.myModalRefinanciar) window.myModalRefinanciar.show();
}

function calcRefinanciamiento() {
    var cargo = parseFloat(document.getElementById('ref-cargo').value) || 0;
    var cuotas = parseInt(document.getElementById('ref-cuotas').value) || 1;
    var nuevoSaldo = window.refSaldoActual + cargo;
    var nuevaCuota = nuevoSaldo / cuotas;
    
    document.getElementById('ref-nuevo-saldo').innerText = window.COP.format(nuevoSaldo);
    document.getElementById('ref-nueva-cuota').innerText = window.COP.format(nuevaCuota) + " / mes";
}

function procesarRefinanciamiento() {
    if(!window.refEditId) return;
    
    var cargo = parseFloat(document.getElementById('ref-cargo').value) || 0;
    var cuotas = parseInt(document.getElementById('ref-cuotas').value) || 1;
    var fecha = document.getElementById('ref-fecha').value;
    
    if(!fecha || cuotas < 1) return alert("Verifica las cuotas y la fecha");
    
    var d = {
        idVenta: window.refEditId,
        cargoAdicional: cargo,
        nuevasCuotas: cuotas,
        nuevaFecha: fecha
    };
    
    var dIdx = window.D.deudores.findIndex(x => x.idVenta === window.refEditId);
    if(dIdx > -1) {
        window.D.deudores[dIdx].saldo += cargo;
        window.D.deudores[dIdx].valCuota = (window.D.deudores[dIdx].saldo) / cuotas;
        window.D.deudores[dIdx].cuotas = cuotas;
        window.D.deudores[dIdx].fechaLimite = fecha;
    }
    
    if(window.myModalRefinanciar) window.myModalRefinanciar.hide();
    
    renderCartera();
    if(window.showToast) window.showToast("Cartera refinanciada (Guardando...)", "success");
    
    window.callAPI('refinanciarDeuda', d).then(r => { 
        if(!r.exito) { 
            if(window.loadData) window.loadData(true); 
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
            var d = window.D.deudores.find(x => x.idVenta === id);
            if(d) d.estado = 'Castigado';
            
            renderCartera();
            if(window.showToast) window.showToast("Cartera castigada (Guardando...)", "success");
            
            window.callAPI('castigarCartera', {idVenta: id}).then(r => { 
                if(!r.exito) { 
                    if(window.loadData) window.loadData(true); 
                } 
            });
        }
    });
}

function doAbono() {
    var id = document.getElementById('ab-cli').value;
    if(!id) return alert("Seleccione un cliente");
    
    var txt = document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text;
    var cli = txt.split(' - ')[0].trim();
    var monto = document.getElementById('ab-monto').value;
    var fechaVal = document.getElementById('ab-fecha').value;
    
    var abonoNum = parseFloat(monto) || 0;
    if(window.D.metricas) window.D.metricas.saldo += abonoNum;
    
    var dIndex = window.D.deudores.findIndex(x => x.idVenta === id);
    if(dIndex > -1) {
        window.D.deudores[dIndex].saldo -= abonoNum;
        if(window.D.deudores[dIndex].saldo < 0) window.D.deudores[dIndex].saldo = 0;
        if(window.D.deudores[dIndex].saldo <= 100) {
            window.D.deudores[dIndex].estado = 'Pagado';
        }
    }
    
    window.D.historial.unshift({ 
        desc: "Abono: " + cli, 
        tipo: "abono", 
        monto: abonoNum, 
        fecha: fechaVal || new Date().toISOString().split('T')[0], 
        _originalIndex: window.D.historial.length, 
        saldo: window.D.metricas.saldo 
    });
    
    document.getElementById('ab-monto').value = '';
    renderCartera();
    renderFin();
    
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    
    if(window.showToast) window.showToast("Abono registrado", "success");
    
    window.callAPI('registrarAbono', {idVenta: id, monto: monto, cliente: cli, fecha: fechaVal});
}

function renderPasivos() {
    var totalPasivos = window.D.pasivos.reduce((sum, p) => sum + (Number(p.saldo)||0), 0);
    var el = document.getElementById('bal-pasivos');
    if(el) el.innerText = window.COP.format(totalPasivos);
}

function abrirModalPasivos() {
    var sel = document.getElementById('pas-select');
    if(!sel) return;
    
    sel.innerHTML = '<option value="">Seleccione...</option>';
    if (window.D.pasivos.length === 0) {
        sel.innerHTML += `<option value="" disabled>No tienes obligaciones pendientes</option>`;
    } else {
        window.D.pasivos.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.acreedor} (Debes: ${window.COP.format(p.saldo)})</option>`;
        });
    }
    
    var m = document.getElementById('pas-monto');
    if(m) m.value = '';
    if(window.myModalAbonarPasivo) window.myModalAbonarPasivo.show();
}

function seleccionarPasivo() {
    var id = document.getElementById('pas-select').value;
    var p = window.D.pasivos.find(x => x.id === id);
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
    
    var pIdx = window.D.pasivos.findIndex(x => x.id === id);
    var acreedorName = "Desconocido";
    
    if(pIdx > -1) {
        acreedorName = window.D.pasivos[pIdx].acreedor;
        window.D.pasivos[pIdx].saldo -= monto;
        if(window.D.pasivos[pIdx].saldo <= 0) {
            window.D.pasivos.splice(pIdx, 1);
        }
    }
    
    if(window.D.metricas) window.D.metricas.saldo -= monto;
    window.D.historial.unshift({ 
        desc: "Pago a Deuda: " + acreedorName, 
        tipo: "egreso", 
        monto: monto, 
        fecha: new Date().toISOString().split('T')[0], 
        _originalIndex: window.D.historial.length, 
        saldo: window.D.metricas.saldo 
    });
    
    if(window.myModalAbonarPasivo) window.myModalAbonarPasivo.hide();
    
    renderPasivos();
    renderFin();
    
    var bCaja = document.getElementById('bal-caja');
    if(bCaja && window.D.metricas) bCaja.innerText = window.COP.format(window.D.metricas.saldo||0);
    
    if(window.showToast) window.showToast("Pago de obligación registrado", "success");
    
    window.callAPI('abonarPasivo', {idPasivo: id, monto: monto, acreedor: acreedorName});
}

function renderPed() { 
    var c = document.getElementById('ped-list'); 
    if(!c) return; 
    
    c.innerHTML = ''; 
    (window.D.ped || []).forEach(p => { 
        var isPend = p.estado === 'Pendiente'; 
        var badge = isPend ? `<span class="badge bg-warning text-dark">${p.estado}</span>` : `<span class="badge bg-success">${p.estado}</span>`; 
        var controls = `
        <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill" onclick='window.openEditPed(${JSON.stringify(p)})'>✏️</button>
            <button class="btn btn-sm btn-outline-danger flex-fill" onclick="window.delPed('${p.id}')">🗑️</button>
            ${isPend ? `<button class="btn btn-sm btn-outline-success flex-fill" onclick="window.comprarPedido('${p.id}', '${p.prod.replace(/'/g, "\\'")}')">✅</button>` : ''}
        </div>`; 
        
        c.innerHTML += `
        <div class="card-k border-start border-4 ${isPend ? 'border-warning' : 'border-success'}">
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

function abrirModalPed() { 
    if(window.myModalPed) window.myModalPed.show(); 
}

function savePed() { 
    var p = document.getElementById('pe-prod').value; 
    if(!p) return alert("Escribe un producto"); 
    
    var d = { 
        user: window.currentUserAlias, 
        prod: p, 
        prov: document.getElementById('pe-prov').value, 
        costoEst: document.getElementById('pe-costo').value, 
        notas: document.getElementById('pe-nota').value 
    }; 
    
    window.callAPI('guardarPedido', d).then(() => { 
        if(window.loadData) window.loadData(true); 
    }); 
    
    if(window.showToast) window.showToast("Pedido guardado", "success"); 
}

function openEditPed(p) { 
    window.pedEditId = p.id; 
    document.getElementById('ed-ped-prod').value = p.prod; 
    document.getElementById('ed-ped-prov').value = p.prov; 
    document.getElementById('ed-ped-costo').value = p.costo; 
    document.getElementById('ed-ped-nota').value = p.notas; 
    
    if(window.myModalEditPed) window.myModalEditPed.show(); 
}

function guardarEdicionPed() { 
    if(!window.pedEditId) return; 
    
    var d = { 
        id: window.pedEditId, 
        prod: document.getElementById('ed-ped-prod').value, 
        prov: document.getElementById('ed-ped-prov').value, 
        costoEst: document.getElementById('ed-ped-costo').value, 
        notas: document.getElementById('ed-ped-nota').value 
    }; 
    
    if(window.myModalEditPed) window.myModalEditPed.hide(); 
    if(window.showToast) window.showToast("Editando pedido...", "info"); 
    
    window.callAPI('editarPedido', d).then(r => { 
        if(r.exito) {
            if(window.loadData) window.loadData(true); 
        } else { 
            alert(r.error); 
        } 
    }); 
}

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
            if(window.showToast) window.showToast("Eliminando...", "info"); 
            window.callAPI('eliminarPedido', {id: id, justificacion: result.value}).then(r => { 
                if(r.exito) {
                    if(window.loadData) window.loadData(true); 
                } else { 
                    alert(r.error); 
                } 
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
            if (!value || value <= 0) return 'Debes ingresar un costo válido.'; 
        } 
    }).then((result) => { 
        if (result.isConfirmed) { 
            if(window.showToast) window.showToast("Procesando compra...", "info"); 
            window.callAPI('procesarCompraPedido', { idPedido: id, costoReal: result.value }).then(r => { 
                if(r.exito) { 
                    Swal.fire('¡Éxito!', 'Gasto registrado e inventario actualizado.', 'success').then(() => { 
                        if(window.loadData) window.loadData(true); 
                    }); 
                } else { 
                    alert(r.error); 
                } 
            }); 
        } 
    }); 
}

function abrirRadiografia(idVenta) {
    var v = window.D.deudores.find(x => x.idVenta === idVenta);
    if(!v) return;
    
    // Filtro de Saneamiento Extremo: Previene "NaN" si el servidor no envía el dato
    var safeNum = function(val) {
        if (val === undefined || val === null) return 0;
        var parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    };
    
    document.getElementById('rad-id').innerText = v.idVenta;
    document.getElementById('rad-fecha').innerText = v.fechaStr || "Sin fecha";
    document.getElementById('rad-cliente').innerText = v.cliente;
    document.getElementById('rad-prod').innerText = v.producto;
    
    // Datos formateados de manera ultra-segura
    document.getElementById('rad-total').innerText = window.COP.format(safeNum(v.total));
    document.getElementById('rad-metodo').innerText = (v.metodo || "Crédito").toUpperCase();
    document.getElementById('rad-costo').innerText = window.COP.format(safeNum(v.costo));
    document.getElementById('rad-ganancia').innerText = window.COP.format(safeNum(v.ganancia));
    
    document.querySelectorAll('.rad-secret').forEach(e => e.classList.remove('revealed'));
    document.getElementById('rad-vendedor').innerText = v.vendedor || "Sistema";
    
    var boxDeuda = document.getElementById('box-deuda');
    if (v.estado === 'Pagado') {
        boxDeuda.style.borderColor = '#2ecc71';
        document.getElementById('rad-saldo').innerText = 'PAZ Y SALVO';
        document.getElementById('rad-saldo').className = 'rad-val text-success';
        document.getElementById('rad-plan').innerText = `Inicial: ${window.COP.format(safeNum(v.inicial))}`;
    } else {
        boxDeuda.style.borderColor = '#e74c3c';
        document.getElementById('rad-saldo').innerText = window.COP.format(safeNum(v.saldo));
        document.getElementById('rad-saldo').className = 'rad-val text-danger';
        var cuotas = parseInt(v.cuotas) || 1;
        var cuotaTxt = cuotas > 1 ? `${cuotas} cuotas de ${window.COP.format(safeNum(v.valCuota))}` : `Pago único pendiente`;
        document.getElementById('rad-plan').innerText = `Inicial: ${window.COP.format(safeNum(v.inicial))} | ${cuotaTxt}`;
    }
    
    if(window.myModalRadiografia) window.myModalRadiografia.show();
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
window.abrirRadiografia = abrirRadiografia;
window.revelarSecretos = revelarSecretos;
