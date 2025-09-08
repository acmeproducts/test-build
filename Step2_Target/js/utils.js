const Utils = {
    qs(selector, context = document) { return context.querySelector(selector); },
    qsa(selector, context = document) { return Array.from(context.querySelectorAll(selector)); },
    
    showScreen(screenId) {
        this.qsa('.screen, .app-container').forEach(el => {
            el.classList.toggle('hidden', el.id !== screenId);
        });
    },
    
    showModal(id) { 
        const el = this.qs(`#${id}`);
        if (el) el.classList.remove('hidden'); 
    },
    
    hideModal(id) { 
        const el = this.qs(`#${id}`);
        if (el) el.classList.add('hidden'); 
    },
    
    showToast(message, type = 'success', important = false) {
        if (!important && Math.random() < 0.7 && type !== 'error') return;
        const toast = this.qs('#toast');
        if(!toast) return;
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    updateLoadingProgress(current, total, message = '') {
        const counter = this.qs('#loading-counter');
        const msg = this.qs('#loading-message');
        const bar = this.qs('#loading-progress-bar');

        if(counter) counter.textContent = current;
        if(msg) msg.textContent = message || (total ? 
            `Processing ${current} of ${total} items...` : 
            `Found ${current} items`);
        
        if (total > 0 && bar) {
            const percentage = (current / total) * 100;
            bar.style.width = `${percentage}%`;
        }
    }
};
