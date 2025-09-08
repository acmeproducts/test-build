const Utils = {
    elements: {},
    
    init() {
        this.elements = {
            providerScreen: document.getElementById('provider-screen'),
            gdriveAuthScreen: document.getElementById('gdrive-auth-screen'),
            onedriveAuthScreen: document.getElementById('onedrive-auth-screen'),
            gdriveFolderScreen: document.getElementById('gdrive-folder-screen'),
            onedriveFolderScreen: document.getElementById('onedrive-folder-screen'),
            loadingScreen: document.getElementById('loading-screen'),
            appContainer: document.getElementById('app-container'),
            
            googleDriveBtn: document.getElementById('google-drive-btn'),
            onedriveBtn: document.getElementById('onedrive-btn'),
            providerStatus: document.getElementById('provider-status'),
            
            gdriveClientSecret: document.getElementById('gdrive-client-secret'),
            gdriveAuthButton: document.getElementById('gdrive-auth-button'),
            gdriveBackButton: document.getElementById('gdrive-back-button'),
            gdriveAuthStatus: document.getElementById('gdrive-auth-status'),
            gdriveFolderList: document.getElementById('gdrive-folder-list'),
            gdriveRefreshFolders: document.getElementById('gdrive-refresh-folders'),
            gdriveBackToProvider: document.getElementById('gdrive-back-to-provider'),
            gdriveLogout: document.getElementById('gdrive-logout'),
            
            onedriveAuthButton: document.getElementById('onedrive-auth-button'),
            onedriveBackButton: document.getElementById('onedrive-back-button'),
            onedriveAuthStatus: document.getElementById('onedrive-auth-status'),
            onedriveFolderList: document.getElementById('onedrive-folder-list'),
            onedriveFolderSubtitle: document.getElementById('onedrive-folder-subtitle'),
            onedriveRefreshFolders: document.getElementById('onedrive-refresh-folders'),
            onedriveBackToProvider: document.getElementById('onedrive-back-to-provider'),
            onedriveLogout: document.getElementById('onedrive-logout'),
            
            backButton: document.getElementById('back-button'),
            backButtonSpinner: document.getElementById('back-button-spinner'),
            detailsButton: document.getElementById('details-button'),
            imageViewport: document.getElementById('image-viewport'),
            centerImage: document.getElementById('center-image'),
            emptyState: document.getElementById('empty-state'),
            selectAnotherStackBtn: document.getElementById('select-another-stack-btn'),
            selectAnotherFolderBtn: document.getElementById('select-another-folder-btn'),
            toast: document.getElementById('toast'),
            filenameOverlay: document.getElementById('filename-overlay'),
            
            focusStackName: document.getElementById('focus-stack-name'),
            focusImageCount: document.getElementById('focus-image-count'),
            normalImageCount: document.getElementById('normal-image-count'),
            focusDeleteBtn: document.getElementById('focus-delete-btn'),

            loadingCounter: document.getElementById('loading-counter'),
            loadingMessage: document.getElementById('loading-message'),
            loadingProgressBar: document.getElementById('loading-progress-bar'),
            cancelLoading: document.getElementById('cancel-loading'),
            
            edgeTop: document.getElementById('edge-top'),
            edgeBottom: document.getElementById('edge-bottom'),
            edgeLeft: document.getElementById('edge-left'),
            edgeRight: document.getElementById('edge-right'),
            
            pillPriority: document.getElementById('pill-priority'),
            pillTrash: document.getElementById('pill-trash'),
            pillIn: document.getElementById('pill-in'),
            pillOut: document.getElementById('pill-out'),
            
            gridModal: document.getElementById('grid-modal'),
            gridContent: document.getElementById('grid-content'),
            gridTitle: document.getElementById('grid-title'),
            gridContainer: document.getElementById('grid-container'),
            selectAllBtn: document.getElementById('select-all-btn'),
            deselectAllBtn: document.getElementById('deselect-all-btn'),
            selectionText: document.getElementById('selection-text'),
            closeGrid: document.getElementById('close-grid'),
            gridSize: document.getElementById('grid-size'),
            gridSizeValue: document.getElementById('grid-size-value'),
            
            omniSearch: document.getElementById('omni-search'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            
            tagSelected: document.getElementById('tag-selected'),
            moveSelected: document.getElementById('move-selected'),
            deleteSelected: document.getElementById('delete-selected'),
            exportSelected: document.getElementById('export-selected'),
            folderSelected: document.getElementById('folder-selected'),
            
            actionModal: document.getElementById('action-modal'),
            actionTitle: document.getElementById('action-title'),
            actionContent: document.getElementById('action-content'),
            actionCancel: document.getElementById('action-cancel'),
            actionConfirm: document.getElementById('action-confirm'),
            
            detailsModal: document.getElementById('details-modal'),
            detailsClose: document.getElementById('details-close'),
            detailFilename: document.getElementById('detail-filename'),
            detailFilenameLink: document.getElementById('detail-filename-link'),
            detailDate: document.getElementById('detail-date'),
            detailSize: document.getElementById('detail-size'),
            detailTags: document.getElementById('detail-tags'),
            detailNotes: document.getElementById('detail-notes'),
            qualityRating: document.getElementById('quality-rating'),
            contentRating: document.getElementById('content-rating'),
            metadataTable: document.getElementById('metadata-table')
        };
    },
    
    showScreen(screenId) {
        const screens = ['provider-screen', 'gdrive-auth-screen', 'onedrive-auth-screen', 
                       'gdrive-folder-screen', 'onedrive-folder-screen', 'loading-screen', 'app-container'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== screenId);
        });
    },
    
    showModal(id) { 
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden'); 
    },
    hideModal(id) { 
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden'); 
    },
    
    showToast(message, type = 'success', important = false) {
        if (!important && Math.random() < 0.7) return;
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
        
        if (important && state.haptic) {
            const hapticType = type === 'error' ? 'error' : 'buttonPress';
            state.haptic.triggerFeedback(hapticType);
        }
    },
    
    async setImageSrc(img, file) {
        const loadId = file.id + '_' + Date.now();
        state.currentImageLoadId = loadId;

        // New logic from plan 1.4: Prioritize authenticated thumbnail URLs
        let imageUrl = this.getPreferredImageUrl(file);
        
        return new Promise((resolve) => {
            img.onload = () => {
                if (state.currentImageLoadId !== loadId) return;
                resolve();
            };
            img.onerror = () => {
                if (state.currentImageLoadId !== loadId) return;

                // Fallback to full content URL
                let fallbackUrl = this.getFallbackImageUrl(file);
                
                img.onerror = () => {
                    if (state.currentImageLoadId !== loadId) return;
                    // Final fallback to placeholder SVG
                    img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 150 150\' fill=\'none\'%3E%3Crect width=\'150\' height=\'150\' fill=\'%23E5E7EB\'/%3E%3Cpath d=\'M65 60H85V90H65V60Z\' fill=\'%239CA3AF\'/%3E%3Ccircle cx=\'75\' cy=\'45\' r=\'10\' fill=\'%239CA3AF\'/%3E%3C/svg%3E';
                    resolve();
                };
                img.src = fallbackUrl;
            };
            img.src = imageUrl;
            img.alt = file.name || 'Image';
        });
    },
    
    getPreferredImageUrl(file) {
        if (state.providerType === 'googledrive') {
            if (file.thumbnailLink) {
                return file.thumbnailLink.replace('=s220', '=s1000');
            }
            return `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
        } else { // OneDrive
            if (file.thumbnails && file.thumbnails.large) {
                return file.thumbnails.large.url;
            }
            // If no thumbnail, go straight to full content
            return file.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`;
        }
    },

    getFallbackImageUrl(file) {
         if (state.providerType === 'googledrive') {
            return file.downloadUrl || `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        } else { // OneDrive
            return file.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`;
        }
    },
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    updateLoadingProgress(current, total, message = '') {
        state.loadingProgress = { current, total };
        this.elements.loadingCounter.textContent = current;
        this.elements.loadingMessage.textContent = message || (total ? 
            `Processing ${current} of ${total} items...` : 
            `Found ${current} items`);
        
        if (total > 0) {
            const percentage = (current / total) * 100;
            this.elements.loadingProgressBar.style.width = `${percentage}%`;
        }
    }
};
