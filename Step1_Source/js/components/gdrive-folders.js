const GoogleDriveFolders = {
    async load() {
        Utils.elements.gdriveFolderList.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <div class="spinner"></div>
                <span>Loading folders...</span>
            </div>
        `;
        
        try {
            const folders = await state.provider.getFolders();
            
            if (folders.length === 0) {
                Utils.elements.gdriveFolderList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                        <span>No folders found in your Drive</span>
                    </div>
                `;
                return;
            }
            
            Utils.elements.gdriveFolderList.innerHTML = '';
            
            folders.forEach(folder => {
                const div = document.createElement('div');
                div.className = 'folder-item';
                div.innerHTML = `
                    <svg class="folder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                    <div class="folder-info">
                        <div class="folder-name">${folder.name}</div>
                        <div class="folder-date">${new Date(folder.modifiedTime).toLocaleDateString()}</div>
                    </div>
                `;
                
                div.addEventListener('click', () => {
                    if (state.folderMoveMode.active) {
                        App.handleFolderMoveSelection(folder.id, folder.name);
                    } else {
                        App.initializeWithProvider('googledrive', folder.id, folder.name, state.provider);
                    }
                });
                Utils.elements.gdriveFolderList.appendChild(div);
            });
            
        } catch (error) {
            Utils.showToast(`Error loading folders: ${error.message}`, 'error', true);
        }
    }
};
