const App = {
    selectGoogleDrive() {
        state.providerType = 'googledrive';
        Utils.showScreen('gdrive-auth-screen');
        const provider = new GoogleDriveProvider();
        if (provider.isAuthenticated) {
            state.provider = provider;
            Utils.showScreen('gdrive-folder-screen');
            GoogleDriveFolders.load();
        }
    },
    
    async selectOneDrive() {
        state.providerType = 'onedrive';
        Utils.showScreen('onedrive-auth-screen');
        const provider = new OneDriveProvider();
        try {
            const success = await provider.authenticate();
            if (success) {
                state.provider = provider;
                // Initialize the sync manager for OneDrive
                state.syncManager = new MetadataSyncManager(state.provider);
                Utils.showScreen('onedrive-folder-screen');
                OneDriveFolders.load();
            }
        } catch (error) {
            Utils.elements.onedriveAuthStatus.textContent = 'Click to sign in with your Microsoft account';
        }
    },
    
    backToProviderSelection() {
        // Ensure sync manager is stopped and cleaned up
        if (state.syncManager) {
            state.syncManager.stop();
            state.syncManager = null;
        }
        state.provider = null;
        state.providerType = null;
        Utils.showScreen('provider-screen');
    },

    async initializeWithProvider(providerType, folderId, folderName, providerInstance) {
        state.providerType = providerType;
        state.provider = providerInstance;
        state.currentFolder.id = folderId;
        state.currentFolder.name = folderName;
        
        await this.loadImages();
        this.switchToCommonUI();
    },
    
    async loadImages() {
        Utils.showScreen('loading-screen');
        Utils.updateLoadingProgress(0, 0);
        
        state.provider.onProgressCallback = (count) => {
            Utils.updateLoadingProgress(count, 0, `Found ${count} images...`);
        };
        
        try {
            Utils.elements.loadingMessage.textContent = `Loading from ${state.currentFolder.name}...`;
            
            const result = await state.provider.getFilesAndMetadata(state.currentFolder.id);
            const files = result.files || [];
            
            if (files.length === 0) {
                Utils.showToast('No images found in this folder', 'info', true);
                this.returnToFolderSelection();
                return;
            }
            
            Utils.updateLoadingProgress(0, files.length, 'Processing files...');
            
            state.imageFiles = files.map((file, index) => {
                Utils.updateLoadingProgress(index + 1, files.length, 'Processing files...');
                return this.processFileWithProviderMetadata(file);
            });
            
            const pngCount = files.filter(f => f.mimeType === 'image/png').length;
            
            if (pngCount > 0) {
                this.extractMetadataInBackground(state.imageFiles.filter(f => f.mimeType === 'image/png'));
            }
            
            Core.initializeStacks();
            Core.initializeImageDisplay();
            
        } catch (error) {
            Utils.showToast(`Error loading images: ${error.message}`, 'error', true);
            this.returnToFolderSelection();
        } finally {
            if (state.provider) {
                state.provider.onProgressCallback = null;
            }
        }
    },
    
    processFileWithProviderMetadata(file) {
        const userMetadata = state.provider.getUserMetadata(file.id);
        
        return {
            id: file.id,
            name: file.name,
            filename: file.name,
            originalName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            thumbnails: file.thumbnails,
            downloadUrl: file.downloadUrl,
            appProperties: file.appProperties, // Keep for GDrive
            extractedMetadata: {},
            metadataStatus: 'pending',
            ...userMetadata // Apply stack, tags, etc. from cache/default
        };
    },
    
    switchToCommonUI() {
        Utils.showScreen('app-container');
        this.setupProviderAwareNavigation();
    },
    
    setupProviderAwareNavigation() {
        Utils.elements.backButton.textContent = '← Folders';
        Utils.elements.backButton.onclick = () => this.returnToFolderSelection();
        
        this.setupFolderTooltips();
    },
    
    setupFolderTooltips() {
        Utils.elements.backButton.addEventListener('mouseenter', () => {
            const folderName = state.currentFolder.name || 'Unknown';
            const imageCount = state.imageFiles.length;
            const provider = state.providerType === 'googledrive' ? 'Google Drive' : 'OneDrive';
            this.showTooltip(Utils.elements.backButton, `${provider}: ${folderName} • ${imageCount} images`);
        });
        
        Utils.elements.backButton.addEventListener('mouseleave', this.hideTooltip);
    },
    
    showTooltip(element, text) {
        const existingTooltip = document.querySelector('.folder-tooltip');
        if (existingTooltip) existingTooltip.remove();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'folder-tooltip';
        tooltip.textContent = text;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
        }
    },
    
    hideTooltip() {
        const tooltip = document.querySelector('.folder-tooltip');
        if (tooltip) tooltip.remove();
    },
    
    returnToFolderSelection() {
        if (state.syncManager) {
            state.syncManager.triggerSync();
        }
        if (state.providerType === 'googledrive') {
            Utils.showScreen('gdrive-folder-screen');
        } else if (state.providerType === 'onedrive') {
            Utils.showScreen('onedrive-folder-screen');
        }
    },
    
    moveFileToStack(fileId, targetStack, sequence) {
        const file = state.imageFiles.find(f => f.id === fileId);
        if (!file) throw new Error('File not found');
        
        file.stack = targetStack;
        file.stackSequence = sequence;
        
        state.provider.moveFileToStack(fileId, targetStack, sequence);
        return file;
    },
    
    updateUserMetadata(fileId, updates) {
        const file = state.imageFiles.find(f => f.id === fileId);
        if (!file) throw new Error('File not found');
        
        Object.assign(file, updates);
        state.provider.updateUserMetadata(fileId, updates);
    },
    
    async deleteFile(fileId) {
        return await state.provider.deleteFile(fileId);
    },
    
    async extractMetadataInBackground(pngFiles) {
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < pngFiles.length; i += BATCH_SIZE) {
            const batch = pngFiles.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(file => this.processFileMetadata(file));
            
            try {
                await Promise.allSettled(batchPromises);
                
                if (i + BATCH_SIZE < pngFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (error) {
                console.warn('Batch processing error:', error);
            }
        }
    },
    
    async processFileMetadata(file) {
        if (file.metadataStatus === 'loaded' || file.metadataStatus === 'loading') return;
        
        file.metadataStatus = 'loading';
        
        const cachedMetadata = await state.fileCache.getMetadata(file.id);
        if (cachedMetadata) {
            file.extractedMetadata = cachedMetadata;
            file.metadataStatus = 'loaded';
            return;
        }
        
        try {
            const metadata = await state.metadataExtractor.fetchMetadata(file);
            
            if (metadata.error) {
                throw new Error(metadata.error);
            }
            
            if (Object.keys(metadata).length > 0) {
                file.extractedMetadata = metadata;
                await state.fileCache.setMetadata(file.id, metadata);
            }
            file.metadataStatus = 'loaded';
            
        } catch (error) {
            console.warn(`Background metadata extraction failed for ${file.name}: ${error.message}`);
            file.metadataStatus = 'error';
        }
    },

    async handleFolderMoveSelection(folderId, folderName) {
        const filesToMove = state.folderMoveMode.files;
        Utils.showScreen('loading-screen');
        Utils.updateLoadingProgress(0, filesToMove.length);

        try {
            for(let i = 0; i < filesToMove.length; i++) {
                const fileId = filesToMove[i];
                await state.provider.moveFileToFolder(fileId, folderId);
                
                const fileIndex = state.imageFiles.findIndex(f => f.id === fileId);
                if (fileIndex > -1) {
                    const [file] = state.imageFiles.splice(fileIndex, 1);
                    const stackIndex = state.stacks[file.stack].findIndex(f => f.id === fileId);
                    if (stackIndex > -1) {
                        state.stacks[file.stack].splice(stackIndex, 1);
                    }
                }
                Utils.updateLoadingProgress(i + 1, filesToMove.length);
            }

            Utils.showToast(`Moved ${filesToMove.length} images to ${folderName}`, 'success', true);
            
            await state.fileCache.clearCacheForFolder(state.currentFolder.id);
            state.folderMoveMode = { active: false, files: [] };
            
            Core.initializeStacks(); 
            Core.updateStackCounts();
            App.returnToFolderSelection();
            
        } catch (error) {
            Utils.showToast('Error moving files', 'error', true);
            App.returnToFolderSelection();
        }
    }
};
