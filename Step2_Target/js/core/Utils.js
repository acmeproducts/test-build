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
        getPreferredImageUrl,
        getFallbackImageUrl,
        formatFileSize
    };
}