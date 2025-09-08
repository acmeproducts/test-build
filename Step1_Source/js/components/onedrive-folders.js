const OneDriveFolders = {
    async load() {
        Utils.elements.onedriveFolderList.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <div class="spinner"></div>
                <span>Loading folders...</span>
            </div>
        `;
        
        try {
            const folders = await state.provider.getFolders();
            this.display(folders);
            this.updateNavigation();
        } catch (error) {
            Utils.showToast('Error loading folders', 'error', true);
        }
    },
    
    display(folders) {
        Utils.elements.onedriveFolderList.innerHTML = '';
        
        if (folders.length === 0) {
            Utils.elements.onedriveFolderList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                    <span>No folders found in this location</span>
                </div>
            `;
            return;
        }
        
        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-item';
            
            const hasChildren = folder.hasChildren;
            const iconColor = hasChildren ? 'var(--accent)' : 'rgba(255, 255, 255, 0.6)';
            
            div.innerHTML = `
                <svg class="folder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: ${iconColor};">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                <div class="folder-info">
                    <div class="folder-name">${folder.name}</div>
                    <div class="folder-date">
                        ${new Date(folder.modifiedTime).toLocaleDateString()} • ${folder.itemCount} items
                        ${hasChildren ? ' • Has subfolders' : ''}
                    </div>
                </div>
                <div class="folder-actions">
                    ${hasChildren ? `<button class="folder-action-btn drill-btn" data-folder-id="${folder.id}">Browse →</button>` : ''}
                    <button class="folder-action-btn select-btn" data-folder-id="${folder.id}">Select</button>
                </div>
            `;
            
            Utils.elements.onedriveFolderList.appendChild(div);
        });
        
        document.querySelectorAll('.drill-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const folderId = btn.dataset.folderId;
                const folderElement = btn.closest('.folder-item');
                const folderName = folderElement.querySelector('.folder-name').textContent;
                
                try {
                    const subfolders = await state.provider.drillIntoFolder({ id: folderId, name: folderName });
                    this.display(subfolders);
                    this.updateNavigation();
                } catch (error) {
                    Utils.showToast('Error loading subfolders', 'error', true);
                }
            });
        });
        
        document.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderId = btn.dataset.folderId;
                const folderElement = btn.closest('.folder-item');
                const folderName = folderElement.querySelector('.folder-name').textContent;
                
                if (state.folderMoveMode.active) {
                    App.handleFolderMoveSelection(folderId, folderName);
                } else {
                    App.initializeWithProvider('onedrive', folderId, folderName, state.provider);
                }
            });
        });
    },
    
    updateNavigation() {
        const currentPath = state.provider.getCurrentPath();
        const canGoUp = state.provider.canGoUp();
        
        Utils.elements.onedriveFolderSubtitle.textContent = `Current: ${currentPath}`;
        
        const refreshBtn = Utils.elements.onedriveRefreshFolders;
        if (canGoUp) {
            refreshBtn.textContent = '← Go Up';
            refreshBtn.onclick = async () => {
                try {
                    const folders = await state.provider.navigateToParent();
                    this.display(folders);
                    this.updateNavigation();
                } catch (error) {
                    Utils.showToast('Error navigating to parent folder', 'error', true);
                }
            };
        } else {
            refreshBtn.textContent = 'Refresh';
            refreshBtn.onclick = () => this.load();
        }
    }
};
