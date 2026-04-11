/* ARCHIVO: js/ui/finance.js - Motor Financiero y CRM KING'S SHOP */

function renderFin() { 
    var s = document.getElementById('ab-cli'); 
    if(s) {
        s.innerHTML = '<option value="">Seleccione...</option>'; 
        (window.D.deudores || []).filter(d => d.estado !== 'Castigado').forEach(d => { 
            s.innerHTML += `<option value="${d.idVenta}">${d.cliente} - ${d.producto} (Debe: ${window.COP.format(d.saldo)})</option>`; 
        });
    }
  
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

// ... [Aquí va el resto de funciones de finance.js: abrirEditMov, guardarEdicionMovimiento, doIngresoExtra, doGasto, updateGastosSelect, verificarBanco, renderCartera, notificarCobroWA, compartirBalanceWA, abrirModalRefinanciar, calcRefinanciamiento, procesarRefinanciamiento, castigarDeuda, doAbono, renderPasivos, abrirModalPasivos, seleccionarPasivo, doAbonoPasivo, renderPed, abrirModalPed, savePed, openEditPed, guardarEdicionPed, delPed, comprarPedido, abrirRadiografia, revelarSecretos] ...

// =======================================================
// MÓDULO CRM VISUAL (NUEVO)
// =======================================================

function abrirModalCRM() {
    var modalEl = document.getElementById('modalCRM');
    if (!modalEl) {
        // Inyectar el HTML del modal si no existe
        var modalHtml = `
        <div class="modal fade" id="modalCRM" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow" style="background:#f8f9fa;">
                    <div class="modal-header bg-dark text-white border-0">
                        <h5 class="modal-title"><i class="fas fa-robot text-warning"></i> Panel de Seguimiento CRM</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div id="crm-loader" class="text-center p-5">
                            <div class="spinner-border text-primary" role="status"></div>
                            <div class="mt-2 text-muted fw-bold">Buscando seguimientos pendientes...</div>
                        </div>
                        <div id="crm-list" class="p-3" style="display:none; max-height: 60vh; overflow-y: auto;">
                            </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalEl = document.getElementById('modalCRM');
    }
    
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
    renderCRM();
}

function renderCRM() {
    document.getElementById('crm-loader').style.display = 'block';
    document.getElementById('crm-list').style.display = 'none';

    window.callAPI('obtenerClientesCRM').then(r => {
        document.getElementById('crm-loader').style.display = 'none';
        var crmList = document.getElementById('crm-list');
        crmList.style.display = 'block';
        crmList.innerHTML = '';

        if (!r.exito || !r.datos || r.datos.length === 0) {
            crmList.innerHTML = `<div class="text-center text-muted p-5">
                                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #2ecc71;"></i>
                                    <h5 class="mt-3">¡Todo al día!</h5>
                                    <p>No hay seguimientos pendientes para hoy.</p>
                                 </div>`;
            return;
        }

        window.CLIENTES_CRM_PENDIENTES = r.datos; // Guardar temporalmente para enviar luego

        r.datos.forEach((cli, index) => {
            var telAlerta = cli.telefono ? `<small class="text-muted"><i class="fas fa-phone"></i> ${cli.telefono}</small>` : `<small class="text-danger fw-bold"><i class="fas fa-exclamation-triangle"></i> Sin teléfono guardado</small>`;
            
            // Plantilla de saludo editable
            var saludoBase = `¡Hola ${cli.cliente.split(' ')[0]}!`;

            crmList.innerHTML += `
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="card-title fw-bold text-primary mb-0">${cli.cliente}</h6>
                            <small class="text-muted d-block">Compró: <strong>${cli.producto}</strong> (${cli.dias} días atrás)</small>
                            ${telAlerta}
                        </div>
                        <span class="badge bg-warning text-dark"><i class="fas fa-clock"></i> Pendiente</span>
                    </div>
                    
                    <div class="mt-3">
                        <label class="form-label small fw-bold text-secondary mb-1">Personaliza el saludo:</label>
                        <input type="text" class="form-control form-control-sm border-primary" id="crm-saludo-${index}" value="${saludoBase}" style="background-color: #f0f8ff;">
                    </div>
                    
                    <div class="mt-3 text-end border-top pt-2">
                        <button class="btn btn-sm btn-success fw-bold px-4" onclick="window.enviarSeguimientoWA(${index})">
                            <i class="fab fa-whatsapp"></i> Enviar Mensaje
                        </button>
                    </div>
                </div>
            </div>`;
        });
    }).catch(e => {
        document.getElementById('crm-loader').style.display = 'none';
        document.getElementById('crm-list').style.display = 'block';
        document.getElementById('crm-list').innerHTML = `<div class="alert alert-danger">Error de conexión al cargar CRM.</div>`;
    });
}

function enviarSeguimientoWA(index) {
    var cli = window.CLIENTES_CRM_PENDIENTES[index];
    if(!cli) return;

    var saludoCustom = document.getElementById(`crm-saludo-${index}`).value || `¡Hola!`;
    var enlaceEncuesta = "https://docs.google.com/forms/d/e/1FAIpQLScQ4Of-FuvfrXiYP9MkfwljUi98LwmDocz8E7aR6vN-9gibiQ/viewform";
    var web = "www.kishopsas.com";

    var msg = `${saludoCustom} 👋\n\n`;
    msg += `Hace unos días recibiste tu *${cli.producto}*. Queremos saber cómo te ha ido y asegurarnos de que todo esté perfecto.\n\n`;
    msg += `Tu opinión nos ayuda a atenderte mejor. ¿Nos regalas 1 minuto para calificarnos de forma amigable y anónima? 🌟\n`;
    msg += `👉 ${enlaceEncuesta}\n\n`;
    msg += `P.D. Descubre más tecnología y ofertas en nuestra tienda oficial: ${web} 💻\n\n`;
    msg += `¡Siempre es un placer atenderte! 👑`;

    var urlWa = "";
    if (cli.telefono) {
        var num = cli.telefono.replace(/\D/g, ''); // Limpiar no-números
        if (!num.startsWith('57')) num = '57' + num; // Asumir prefijo Colombia si no lo tiene
        urlWa = `https://wa.me/${num}?text=` + encodeURIComponent(msg);
    } else {
        // Si no hay teléfono, abrir WA Web general para buscar contacto manual
        urlWa = `https://wa.me/?text=` + encodeURIComponent(msg);
    }

    window.open(urlWa, '_blank');
}

// Exportaciones Globales (Añadir a las existentes)
// ...
window.abrirModalCRM = abrirModalCRM;
window.renderCRM = renderCRM;
window.enviarSeguimientoWA = enviarSeguimientoWA;
