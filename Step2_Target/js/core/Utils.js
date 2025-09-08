
function Utils(pubSub) {

    function qs(selector, scope = document) {
        return scope.querySelector(selector);
    }

    function qsa(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector));
    }

    function showToast(message, type = 'success', important = false) {
        const toast = qs('#toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);

        if (important) {
            const hapticType = type === 'error' ? 'error' : 'buttonPress';
            pubSub.publish('haptic:trigger', { type: hapticType });
        }
    }

    async function setImageSrc(img, file, provider) {
        const loadId = file.id + '_' + Date.now();
        pubSub.publish('image:load-start', { loadId });

        let imageUrl = getPreferredImageUrl(file, provider.name);
        
        return new Promise((resolve) => {
            img.onload = () => {
                pubSub.publish('image:load-success', { loadId });
                resolve();
            };
            img.onerror = () => {
                let fallbackUrl = getFallbackImageUrl(file, provider.name);
                
                img.onerror = () => {
                    pubSub.publish('image:load-error', { loadId });
                    img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 150 150\' fill=\'none\'%3E%3Crect width=\'150\' height=\'150\' fill=\'%23E5E7EB\'/%3E%3Cpath d=\'M65 60H85V90H65V60Z\' fill=\'%239CA3AF\'/%3E%3Ccircle cx=\'75\' cy=\'45\' r=\'10\' fill=\'%239CA3AF\'/%3E%3C/svg%3E';
                    resolve();
                };
                img.src = fallbackUrl;
            };
            img.src = imageUrl;
            img.alt = file.name || 'Image';
        });
    }

    function getPreferredImageUrl(file, providerType) {
        if (providerType === 'googledrive') {
            if (file.thumbnailLink) {
                return file.thumbnailLink.replace('=s220', '=s1000');
            }
            return `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
        } else { // OneDrive
            if (file.thumbnails && file.thumbnails.large) {
                return file.thumbnails.large.url;
            }
            return file.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`;
        }
    }

    function getFallbackImageUrl(file, providerType) {
         if (providerType === 'googledrive') {
            return file.downloadUrl || `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        } else { // OneDrive
            return file.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`;
        }
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    return {
        qs,
        qsa,
        showToast,
        setImageSrc,
        getPreferredImageUrl,
        formatFileSize
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.Utils = Utils;
