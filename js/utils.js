/* ARCHIVO: js/utils.js - Utilidades Globales KING'S SHOP */

// Solo extrae el ID del archivo de Drive de una URL — no construye ningún
// enlace de visualización directa. Ver [[cargarFotoProducto]] para eso.
window.extraerDriveId_ = function(url) {
    if (!url) return null;
    var clean = url;
    try { clean = decodeURIComponent(url).trim(); } catch(e) {}
    var match = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/) || clean.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};

// FIX FOTOS: enlace CLICABLE normal para insertar en texto (WhatsApp, etc.)
// — cuando alguien lo abre, lo hace desde SU PROPIO navegador/WhatsApp, no
// desde el WebView de esta app, así que el problema de carga intermitente
// que sufre la app instalada no aplica aquí. NO usar esto para pintar
// pixeles dentro de la propia app — para eso existe cargarFotoProducto().
window.fixDriveLink = function(url) {
    if (!url) return "";
    var id = window.extraerDriveId_(url);
    if (id) return "https://drive.google.com/uc?export=view&id=" + id;
    try { return decodeURIComponent(url).trim().split(' ')[0]; } catch(e) { return String(url).split(' ')[0]; }
};

// FIX FOTOS: trae los pixeles reales de la foto de un producto para
// PINTARLOS dentro de la app (inventario, carrito, compartir con imagen
// adjunta). En vez de que el WebView le pida la imagen directo a la CDN
// pública de Drive (lh3.googleusercontent.com / drive.google.com) — que en
// algunos celulares/operadores falla de forma intermitente sin poder
// reproducirse ni diagnosticarse desde afuera — se pide por el MISMO canal
// (script.google.com) que ya usa toda la app para sus datos, comprobado
// confiable. Se cachea en localStorage por fileId: la primera vez cuesta
// una petición, de ahí en adelante es instantánea y funciona sin internet.
window.cargarFotoProducto = function(url) {
    if (!url) return Promise.resolve("");
    if (String(url).indexOf('data:image') === 0) return Promise.resolve(url); // ya viene incrustada

    var fileId = window.extraerDriveId_(url);
    if (!fileId) return Promise.resolve(url); // no es un enlace de Drive reconocible, se usa tal cual

    var cacheKey = 'kingshop_foto_' + fileId;
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) return Promise.resolve(cached);
    } catch(e) {}

    if (!window.callAPI) return Promise.resolve("");

    return window.callAPI('obtenerFotoBase64', { fileId: fileId }).then(function(r) {
        if (!r || !r.exito || !r.data) return "";
        var dataUri = "data:" + (r.mime || "image/jpeg") + ";base64," + r.data;
        try { localStorage.setItem(cacheKey, dataUri); } catch(e) { /* localStorage lleno: se sirve igual, solo no se cachea */ }
        return dataUri;
    }).catch(function() { return ""; });
};

// Busca todos los <img data-foto-src="..."> dentro de un contenedor recién
// pintado y les resuelve la foto real de forma asíncrona (uno por uno, sin
// bloquear el render de la lista). Usar después de inyectar HTML con
// data-foto-src en vez de src directo.
window.hidratarFotos = function(container) {
    if (!container) return;
    var imgs = container.querySelectorAll('img[data-foto-src]');
    imgs.forEach(function(img) {
        var raw = img.getAttribute('data-foto-src');
        img.removeAttribute('data-foto-src');
        window.cargarFotoProducto(raw).then(function(dataUri) {
            if (dataUri) img.src = dataUri;
            else if (img.parentElement) img.parentElement.innerHTML = '<i class="bi bi-box-seam" style="font-size:2rem; color:#eee;"></i>';
        });
    });
};

window.embellecerDescripcion = function(texto) {
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
};

// ── Compartir nativo en Android (Capacitor) ────────────────────────────────
// navigator.share/navigator.canShare (Web Share API) NO están implementados
// en el WebView nativo de Android que usa Capacitor — por eso siempre caía
// en "tu navegador no soporta esto". La forma correcta de compartir archivos
// a WhatsApp desde una app empaquetada es el plugin nativo @capacitor/share
// (+ @capacitor/filesystem para materializar la imagen como archivo real en
// disco antes de compartirla). Este proyecto no usa bundler, así que los
// plugins se consumen vía window.Capacitor.Plugins — el shell nativo lo
// inyecta automáticamente en runtime — en vez de "import '@capacitor/share'"
// (un specifier de módulo "bare" que el navegador no puede resolver sin un
// bundler).
window.esPlataformaNativa_ = function() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
};

window.fileABase64_ = function(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]); // sin el prefijo "data:...;base64,"
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

window.compartirNativoCapacitor_ = async function(title, text, file) {
    var Plugins = window.Capacitor && window.Capacitor.Plugins;
    if (!Plugins || !Plugins.Share) return false;

    var shareOptions = { title: title, text: text, dialogTitle: title };

    if (file) {
        try {
            var base64Data = await window.fileABase64_(file);
            var fileName = 'kingshop_share_' + Date.now() + '.jpg';
            await Plugins.Filesystem.writeFile({ path: fileName, data: base64Data, directory: 'CACHE' });
            var uriResult = await Plugins.Filesystem.getUri({ path: fileName, directory: 'CACHE' });
            shareOptions.files = [uriResult.uri];
        } catch (e) {
            console.warn("No se pudo adjuntar el archivo al compartir nativo, se comparte solo texto:", e);
        }
    }

    await Plugins.Share.share(shareOptions);
    return true;
};
// ─────────────────────────────────────────────────────────────────────────

window.getFileFromUrlAsync = async function(url, defaultName) {
    try {
        // FIX FOTOS: si es un enlace de Drive, se trae por nuestro propio
        // backend (cargarFotoProducto) en vez de hacer fetch() directo a la
        // CDN pública de Google — mismo motivo que el resto de este fix: esa
        // ruta falla de forma intermitente en algunos celulares/operadores.
        if (!url.startsWith('data:image') && window.extraerDriveId_ && window.extraerDriveId_(url)) {
            url = await window.cargarFotoProducto(url);
            if (!url) return null;
        }

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
};

window.shareProdWhatsApp = function(id) {
    var p = window.D.inv.find(x => x.id === id);
    if (!p) return alert("Producto no encontrado");
    
    var nombre = p.nombre.toUpperCase();
    var precio = p.publico > 0 ? window.COP.format(p.publico) : 'Consultar';
    var descripcionBonita = window.embellecerDescripcion(p.desc);
    var linkFoto = window.fixDriveLink(p.foto); 
    
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
};

window.shareProductNative = async function(id) {
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
        var desc = window.embellecerDescripcion(p.desc);
        
        var shareText = `👑 *KING'S SHOP SAS*\n\n🛍️ *Producto:* ${nombre}\n💳 *Inversión:* ${precio}\n\n`;
        if (desc) { 
            shareText += `📋 *Detalles:*\n${desc}\n\n`; 
        }
        shareText += `🤝 _Quedamos a su entera disposición._`;
        
        var fixedUrl = window.fixDriveLink(p.foto);
        var file = null;
        if (fixedUrl && fixedUrl.length > 5) {
            var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            file = await window.getFileFromUrlAsync(fixedUrl, cleanName);
        }

        if(loader) loader.style.display = 'none';

        // 1) App empaquetada en Android/iOS (Capacitor): plugin nativo — el
        // único camino que realmente soporta adjuntar el archivo (la Web
        // Share API no existe en el WebView nativo de Capacitor).
        if (window.esPlataformaNativa_ && window.esPlataformaNativa_()) {
            var okNativo = await window.compartirNativoCapacitor_(nombre, shareText, file);
            if (okNativo) {
                if(window.showToast) window.showToast("¡Compartido con éxito!", "success");
                return;
            }
        }
        // 2) Navegador real (desktop/móvil fuera de Capacitor) con Web Share API.
        else if (navigator.canShare && navigator.share) {
            var shareData = { title: nombre, text: shareText };
            if (file) {
                if (navigator.canShare({ files: [file] })) shareData.files = [file];
                else console.warn("El navegador no soporta compartir archivos, se enviará solo texto.");
            }
            await navigator.share(shareData);
            if(window.showToast) window.showToast("¡Compartido con éxito!", "success");
            return;
        }

        // 3) Último recurso: WhatsApp clásico (solo texto), sin alertas alarmantes.
        window.shareProdWhatsApp(id);
    } catch(error) {
        if(loader) loader.style.display = 'none';

        if (error.name !== 'AbortError') {
            window.shareProdWhatsApp(id);
        } else {
            if(window.showToast) window.showToast("Compartir cancelado por el usuario", "info");
        }
    }
};

window.calcUltimaCuota = function(total, inicial, valCuota, numCuotas) {
    return (total - inicial) - (valCuota * (numCuotas - 1));
};

// DESPUÉS — corregido:
window.lockBtn = function() {
    var btn = document.activeElement;
    if(btn && btn.tagName === 'BUTTON') { 
        var prevHtml = btn.innerHTML; 
        btn.disabled = true; 
        btn.innerText = "Procesando..."; 
        return function() { 
            btn.disabled = false; 
            btn.innerHTML = prevHtml; 
        };
    }
    return function() {};
};  // ← llave de cierre que faltaba

// ── FIX MEDIO 3+10: Escape HTML para prevenir XSS ────────────
window.escHtml = function(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
