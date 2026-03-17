/* ARCHIVO: js/ui/inventory.js - Motor de Catálogo KING'S SHOP */

function abrirModalProv() { 
    if(window.renderProvs) window.renderProvs(); 
    if(window.myModalProv) window.myModalProv.show(); 
}

function abrirModalNuevo() { 
    document.getElementById('new-id').value = ''; 
    document.getElementById('new-file-foto').value = ""; 
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-categoria').value = '';
    document.getElementById('new-proveedor').value = '';
    document.getElementById('new-costo').value = '';
    document.getElementById('new-publico').value = '';
    document.getElementById('new-margen').value = '30';
    document.getElementById('new-desc').value = '';
    document.getElementById('new-web').checked = false;
    document.getElementById('new-cat-web').value = 'tecnologia';
    if(window.myModalNuevo) window.myModalNuevo.show(); 
}

function abrirModalWA() { 
    if(window.myModalWA) window.myModalWA.show(); 
}

function calcGain(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var margen = idMargen ? (parseFloat(document.getElementById(idMargen).value) || 0) : 30;
    if(costo > 0) { 
        var ganancia = costo * (1 + (margen / 100)); 
        document.getElementById(idPublico).value = Math.round(ganancia); 
    }
}

function calcMargen(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var publico = parseFloat(document.getElementById(idPublico).value) || 0;
    if(costo > 0 && publico > 0) { 
        var margen = ((publico / costo) - 1) * 100; 
        document.getElementById(idMargen).value = margen.toFixed(1); 
    }
}

function prepararEdicion(id) {
    var p = window.D.inv.find(x => x.id === id);
    if (p) { 
        openEdit(p); 
    } else { 
        alert("Producto no encontrado en memoria"); 
    }
}

function openEdit(p) { 
    window.prodEdit = p; 
    document.getElementById('inp-edit-nombre').value = p.nombre; 
    document.getElementById('inp-edit-categoria').value = p.cat; 
    document.getElementById('inp-edit-costo').value = p.costo; 
    document.getElementById('inp-edit-publico').value = p.publico || 0; 
    
    var m = 30;
    if(p.costo > 0 && p.publico > 0) {
        m = ((p.publico / p.costo) - 1) * 100;
    }
    if(document.getElementById('inp-edit-margen')) {
        document.getElementById('inp-edit-margen').value = m.toFixed(1);
    }

    document.getElementById('inp-edit-proveedor').value = p.prov; 
    document.getElementById('inp-edit-desc').value = p.desc; 
    document.getElementById('inp-edit-web').checked = p.enWeb || false;
    document.getElementById('inp-edit-cat-web').value = p.catWeb || 'tecnologia';
    document.getElementById('inp-file-foto').value = "";
    document.getElementById('img-preview-box').style.display = 'none'; 
    
    var fixedUrl = fixDriveLink(p.foto);
    if(fixedUrl) { 
        document.getElementById('img-preview-box').src = fixedUrl; 
        document.getElementById('img-preview-box').style.display = 'block';
    } 
    
    if(window.myModalEdit) window.myModalEdit.show(); 
}

function renderProvs() {
    var c = document.getElementById('list-provs'); 
    if(!c) return;
    
    c.innerHTML = '';
    
    (window.D.proveedores || []).forEach(p => {
        var waLink = p.tel ? `https://wa.me/57${p.tel.replace(/\D/g,'')}` : '#';
        var btn = p.tel ? `<a href="${waLink}" target="_blank" class="btn-wa-mini"><i class="fab fa-whatsapp"></i></a>` : '<span class="text-muted">-</span>';
        c.innerHTML += `
        <div class="prov-item">
            <div>
                <strong>${p.nombre}</strong><br>
                <small class="text-muted">${p.tel || 'Sin numero'}</small>
            </div>
            <div class="d-flex gap-2">
                ${btn}
                <button class="btn btn-sm btn-light border" onclick="window.editarProv('${p.nombre}')">✏️</button>
            </div>
        </div>`;
    });
}

function guardarProvManual() { 
    var n = document.getElementById('new-prov-name').value; 
    var t = document.getElementById('new-prov-tel').value; 
    
    if(!n) return; 
    
    window.callAPI('registrarProveedor', {nombre: n, tel: t}).then(r => { 
        document.getElementById('new-prov-name').value = ''; 
        document.getElementById('new-prov-tel').value = ''; 
        if(window.loadData) window.loadData(true); 
    }); 
}

function editarProv(nombre) { 
    var t = prompt("Nuevo teléfono para " + nombre + ":"); 
    if(t) { 
        window.callAPI('registrarProveedor', {nombre: nombre, tel: t}).then(() => {
            if(window.loadData) window.loadData(true);
        }); 
    } 
}

function renderWeb() {
    var q = document.getElementById('web-search').value.toLowerCase().trim();
    var c = document.getElementById('web-list');
    if(!c) return;
    
    c.innerHTML = '';
    var lista = (window.D.inv || []).filter(p => p.enWeb === true);
    
    if(q) { 
        lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q)); 
    }
    
    if(lista.length === 0) { 
        c.innerHTML = `<div class="text-center text-muted p-5"><div style="font-size:2rem">🌐</div><p>No hay productos en Web.<br>Actívalos desde Inventario.</p></div>`; 
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
                        <small class="text-muted">| ${window.COP.format(p.publico)}</small>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="window.toggleWebStatus('${p.id}')">Desactivar</button>
            </div>
        </div>`;
    });
}

function toggleWebStatus(id) {
    var idx = window.D.inv.findIndex(x => x.id === id);
    if(idx > -1) {
        var p = window.D.inv[idx];
        p.enWeb = !p.enWeb; 
        
        renderWeb(); 
        if(window.renderInv) window.renderInv(); 
        if(window.showToast) window.showToast("Producto actualizado", "info");
        
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
        
        window.callAPI('guardarProductoAvanzado', payload);
    }
}

function renderInv() { 
    var searchEl = document.getElementById('inv-search');
    var filterEl = document.getElementById('filter-prov');
    var c = document.getElementById('inv-list');
    if(!c) return;

    var q = searchEl ? searchEl.value.toLowerCase().trim() : "";
    var filterProv = filterEl ? filterEl.value : "";
    
    c.innerHTML = ''; 
    var lista = window.D.inv || [];
    
    if(q) { 
        lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)); 
    }
    
    if(filterProv) { 
        var fClean = filterProv.trim().toLowerCase(); 
        lista = lista.filter(p => p.prov && String(p.prov).trim().toLowerCase().includes(fClean)); 
    }

    lista.slice(0, 50).forEach(p => {
        var fixedUrl = fixDriveLink(p.foto);
        var imgHtml = fixedUrl ? `<img src="${fixedUrl}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? window.COP.format(p.publico) : 'N/A';
        
        var btnAddCart = `<div class="btn-copy-mini text-white" style="background:var(--primary); border-color:var(--primary);" onclick="window.agregarAlCarritoDesdeInv('${p.id}')" title="Agregar al Carrito"><i class="fas fa-cart-plus"></i></div>`;
        var btnShareNative = `<div class="btn-copy-mini text-white" style="background:#25D366; border-color:#25D366;" onclick="window.shareProductNative('${p.id}')" title="Compartir Tarjeta Web"><i class="fas fa-share-nodes"></i></div>`;

        var div = document.createElement('div');
        div.className = 'card-catalog';
        div.innerHTML = `
        <div class="cat-img-box">
            ${imgHtml}
            <div class="btn-edit-float" onclick="window.prepararEdicion('${p.id}')"><i class="fas fa-pencil-alt"></i></div>
        </div>
        <div class="cat-body">
            <div class="cat-title text-truncate" style="white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.nombre}</div>
            <div class="cat-price">${precioDisplay}</div>
            <small class="text-muted" style="font-size:0.7rem;">Costo: ${window.COP.format(p.costo)}</small>
        </div>
        <div class="cat-actions">
            <div class="btn-copy-mini" onclick="window.copyingDato('${p.id}')" title="Copiar ID">ID</div>
            <div class="btn-copy-mini" onclick="window.copyingDato('${p.nombre.replace(/'/g, "\\'")}')" title="Copiar Nombre">Nom</div>
            <div class="btn-copy-mini" onclick="window.copyingDato('${p.publico}')" title="Copiar Precio">$$</div>
            ${btnAddCart}
            ${btnShareNative}
        </div>`;
        
        c.appendChild(div);
    }); 
}

function copyingDato(txt) {
    if(!txt || txt === 'undefined' || txt === '0') return alert("Dato vacío o no disponible");
    navigator.clipboard.writeText(txt).then(() => { 
        if(window.showToast) window.showToast("Copiado: " + txt.substring(0,10) + "..."); 
    });
}

function previewFile() { 
    var f = document.getElementById('inp-file-foto').files[0]; 
    if(f) {
        var r = new FileReader();
        r.onload = e => {
            document.getElementById('img-preview-box').src = e.target.result;
            document.getElementById('img-preview-box').style.display = 'block';
        };
        r.readAsDataURL(f);
    } 
}

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

function guardarCambiosAvanzado() {
    if(!window.prodEdit) return; 
   
    var newVal = { 
        id: window.prodEdit.id, 
        nombre: document.getElementById('inp-edit-nombre').value, 
        cat: document.getElementById('inp-edit-categoria').value, 
        prov: document.getElementById('inp-edit-proveedor').value.toUpperCase().trim(), 
        costo: parseFloat(document.getElementById('inp-edit-costo').value), 
        publico: parseFloat(document.getElementById('inp-edit-publico').value), 
        desc: document.getElementById('inp-edit-desc').value, 
        foto: window.prodEdit.foto || "", 
        enWeb: document.getElementById('inp-edit-web').checked, 
        catWeb: document.getElementById('inp-edit-cat-web').value 
    };
   
    var f = document.getElementById('inp-file-foto').files[0];
    var promise = Promise.resolve(null);
   
    if(f) { 
        promise = compressImage(f); 
    }
   
    promise.then(b64 => {
        var idx = window.D.inv.findIndex(x => x.id === window.prodEdit.id);
        if(idx > -1) { 
            if(b64) { newVal.foto = b64; } 
            window.D.inv[idx] = newVal; 
        }
        
        renderInv(); 
        if(window.renderPos) window.renderPos(); 
        if(window.myModalEdit) window.myModalEdit.hide(); 
        if(window.showToast) window.showToast("Guardando cambios...", "info");
       
        var payload = { 
            id: newVal.id, 
            nombre: newVal.nombre, 
            categoria: newVal.cat, 
            proveedor: newVal.prov, 
            costo: newVal.costo, 
            publico: newVal.publico, 
            descripcion: newVal.desc, 
            urlExistente: window.prodEdit.foto || "", 
            enWeb: newVal.enWeb, 
            catWeb: newVal.catWeb 
        };
        
        if(b64) { 
            payload.imagenBase64 = b64.split(',')[1]; 
            payload.mimeType = f.type; 
            payload.nombreArchivo = f.name; 
        }
       
        window.callAPI('guardarProductoAvanzado', payload).then(r => { 
            if(r.exito) { 
                if(window.showToast) window.showToast("¡Guardado exitoso!", "success"); 
            } else { 
                if(window.showToast) window.showToast("Error guardando: " + r.error, "danger"); 
            } 
        });
    });
}

function eliminarProductoActual() { 
    if(confirm("Eliminar?")) { 
        window.callAPI('eliminarProductoBackend', {id: window.prodEdit.id}).then(r => {
            if(r.exito) location.reload();
        }); 
    } 
}

function generarIDAuto() { 
    var c = document.getElementById('new-categoria').value; 
    if(c) {
        document.getElementById('new-id').value = c.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 9999); 
    }
}

function crearProducto() { 
    var d = { 
        nombre: document.getElementById('new-nombre').value, 
        categoria: document.getElementById('new-categoria').value, 
        proveedor: document.getElementById('new-proveedor').value.toUpperCase().trim(), 
        costo: parseFloat(document.getElementById('new-costo').value), 
        publico: parseFloat(document.getElementById('new-publico').value), 
        descripcion: document.getElementById('new-desc').value, 
        enWeb: document.getElementById('new-web').checked, 
        catWeb: document.getElementById('new-cat-web').value, 
        id: document.getElementById('new-id').value || 'GEN-' + Math.random() 
    }; 
    
    var f = document.getElementById('new-file-foto').files[0];
    var promise = Promise.resolve(null);
    if(f) { 
        promise = compressImage(f); 
    }
    
    promise.then(b64 => {
        var localProd = { 
            id: d.id, 
            nombre: d.nombre, 
            cat: d.categoria, 
            prov: d.proveedor, 
            costo: d.costo, 
            publico: d.publico, 
            desc: d.descripcion, 
            foto: b64 || "", 
            enWeb: d.enWeb, 
            catWeb: d.catWeb 
        };
        
        window.D.inv.unshift(localProd); 
        renderInv(); 
        
        if(window.myModalNuevo) window.myModalNuevo.hide(); 
        if(window.showToast) window.showToast("Creando producto...", "info");
        
        if(b64) { 
            d.imagenBase64 = b64.split(',')[1]; 
            d.mimeType = f.type; 
            d.nombreArchivo = f.name; 
        }
        
        window.callAPI('crearProductoManual', d).then(r => { 
            if(r.exito){ 
                if(window.showToast) window.showToast("Producto sincronizado", "success"); 
            } else { 
                if(window.showToast) window.showToast("Error al crear en servidor", "danger"); 
            } 
        });
    });
}

function procesarWA() { 
    var p = document.getElementById('wa-prov').value;
    var c = document.getElementById('wa-cat').value;
    var t = document.getElementById('wa-text').value; 
    
    if(!c || !t) return alert("Falta datos"); 
    
    var btn = document.querySelector('#modalWA .btn-success'); 
    btn.innerText = "Procesando..."; 
    btn.disabled = true; 
    
    window.callAPI('procesarImportacionDirecta', {prov: p, cat: c, txt: t}).then(r => {
        alert(r.mensaje || r.error);
        location.reload();
    }); 
}

function fixDriveLink(url) {
    if (!url) return "";
    try { 
        url = decodeURIComponent(url).trim(); 
    } catch(e) {}
    
    var match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    if (match && match[1]) {
        return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";
    }
    return url.split(' ')[0];
}

function embellecerDescripcion(texto) {
    if (!texto) return "";
    var lineas = texto.split('\n');
    var bonitas = lineas.map(l => {
        var tl = l.trim();
        if(!tl) return "";
        if(tl.startsWith('-') || tl.startsWith('🔹') || tl.startsWith('•') || tl.startsWith('*')) {
            return "• " + tl.replace(/^[-•*🔹]\s*/, '');
        }
        return "• " + tl;
    }).filter(l => l !== "").join('\n');
    return bonitas;
}

async function getFileFromUrlAsync(url, defaultName) {
    try {
        if (url.startsWith('data:image')) {
            var arr = url.split(',');
            var mime = arr[0].match(/:(.*?);/)[1];
            var bstr = atob(arr[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while(n--) { 
                u8arr[n] = bstr.charCodeAt(n); 
            }
            return new File([u8arr], defaultName + ".jpg", {type: mime});
        } else {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            return new File([blob], defaultName + ".jpg", {type: blob.type || "image/jpeg"});
        }
    } catch(e) {
        console.error("Fallo al convertir URL a File:", e);
        return null;
    }
}

function shareProdWhatsApp(id) {
    var p = window.D.inv.find(x => x.id === id);
    if (!p) return alert("Producto no encontrado");
    
    var nombre = p.nombre.toUpperCase();
    var precio = p.publico > 0 ? window.COP.format(p.publico) : 'Consultar';
    var descripcionBonita = embellecerDescripcion(p.desc);
    var linkFoto = fixDriveLink(p.foto); 
    
    var msg = `👑 *KING'S SHOP SAS*\n\n`;
    if(linkFoto && linkFoto.length > 10) { 
        msg += `🖼️ *Imagen:* ${linkFoto}\n\n`; 
    }
    
    msg += `🛍️ *Producto:* ${nombre}\n`;
    msg += `💳 *Inversión:* ${precio}\n\n`;
    
    if (descripcionBonita) { 
        msg += `📋 *Detalles:*\n${descripcionBonita}\n\n`; 
    }
    
    msg += `🤝 _Quedamos a su entera disposición._`; 
    
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
}

async function shareProductNative(id) {
    var loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';
    
    try {
        var p = window.D.inv.find(x => x.id === id);
        if (!p) {
            if(loader) loader.style.display = 'none';
            return alert("Producto no encontrado");
        }
        
        var nombre = p.nombre.toUpperCase();
        var precio = p.publico > 0 ? window.COP.format(p.publico) : 'Consultar';
        var desc = embellecerDescripcion(p.desc);
        
        var shareText = `👑 *KING'S SHOP SAS*\n\n🛍️ *Producto:* ${nombre}\n💳 *Inversión:* ${precio}\n\n`;
        if (desc) { 
            shareText += `📋 *Detalles:*\n${desc}\n\n`; 
        }
        shareText += `🤝 _Quedamos a su entera disposición._`;
        
        var shareData = { 
            title: nombre, 
            text: shareText 
        };

        var hasImage = false;
        var fixedUrl = fixDriveLink(p.foto);
        
        if (fixedUrl && fixedUrl.length > 5) {
            var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            var file = await getFileFromUrlAsync(fixedUrl, cleanName);
            if (file) {
                shareData.files = [file];
                hasImage = true;
            }
        }
        
        if(loader) loader.style.display = 'none';

        if (navigator.canShare && navigator.share) {
            if (hasImage && !navigator.canShare({ files: shareData.files })) {
                console.warn("El dispositivo no soporta compartir archivos, se enviará solo texto.");
                delete shareData.files;
            }
            
            await navigator.share(shareData);
            if(window.showToast) window.showToast("¡Compartido con éxito!", "success");
        } else {
            alert("Tu navegador no soporta compartir nativamente. Abriendo WhatsApp clásico.");
            shareProdWhatsApp(id);
        }
    } catch(error) {
        if(loader) loader.style.display = 'none';
        
        if (error.name !== 'AbortError') {
            alert("No se pudo compartir el archivo nativamente. Abriendo texto clásico.");
            shareProdWhatsApp(id); 
        } else {
            if(window.showToast) window.showToast("Compartir cancelado por el usuario", "info");
        }
    }
}

// Exportaciones Globales
window.abrirModalProv = abrirModalProv;
window.abrirModalNuevo = abrirModalNuevo;
window.abrirModalWA = abrirModalWA;
window.calcGain = calcGain;
window.calcMargen = calcMargen;
window.prepararEdicion = prepararEdicion;
window.openEdit = openEdit;
window.renderProvs = renderProvs;
window.guardarProvManual = guardarProvManual;
window.editarProv = editarProv;
window.renderWeb = renderWeb;
window.toggleWebStatus = toggleWebStatus;
window.renderInv = renderInv;
window.copyingDato = copyingDato;
window.previewFile = previewFile;
window.compressImage = compressImage;
window.guardarCambiosAvanzado = guardarCambiosAvanzado;
window.eliminarProductoActual = eliminarProductoActual;
window.generarIDAuto = generarIDAuto;
window.crearProducto = crearProducto;
window.procesarWA = procesarWA;
window.fixDriveLink = fixDriveLink;
window.embellecerDescripcion = embellecerDescripcion;
window.getFileFromUrlAsync = getFileFromUrlAsync;
window.shareProdWhatsApp = shareProdWhatsApp;
window.shareProductNative = shareProductNative;
