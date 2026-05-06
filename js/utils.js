/* ARCHIVO: js/utils.js - Utilidades Globales KING'S SHOP */

window.fixDriveLink = function(url) {
    if (!url) return "";
    try { 
        url = decodeURIComponent(url).trim(); 
    } catch(e) {}
    
    var match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    if (match && match[1]) {
        return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";
    }
    return url.split(' ')[0];
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

window.getFileFromUrlAsync = async function(url, defaultName) {
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
        
        var shareData = { 
            title: nombre, 
            text: shareText 
        };

        var hasImage = false;
        var fixedUrl = window.fixDriveLink(p.foto);
        
        if (fixedUrl && fixedUrl.length > 5) {
            var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            var file = await window.getFileFromUrlAsync(fixedUrl, cleanName);
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
            window.shareProdWhatsApp(id);
        }
    } catch(error) {
        if(loader) loader.style.display = 'none';
        
        if (error.name !== 'AbortError') {
            alert("No se pudo compartir el archivo nativamente. Abriendo texto clásico.");
            window.shareProdWhatsApp(id); 
        } else {
            if(window.showToast) window.showToast("Compartir cancelado por el usuario", "info");
        }
    }
};

window.calcUltimaCuota = function(total, inicial, valCuota, numCuotas) {
    return (total - inicial) - (valCuota * (numCuotas - 1));
};

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
};
