const Modal = {
    currentAction: null,
    
    show(type, options = {}) {
        this.currentAction = type;
        const { title, content, confirmText = 'Confirm', confirmClass = 'btn-primary' } = options;
        
        Utils.elements.actionTitle.textContent = title || 'Action';
        Utils.elements.actionContent.innerHTML = content || '';
        Utils.elements.actionConfirm.textContent = confirmText;
        Utils.elements.actionConfirm.className = `btn ${confirmClass}`;
        Utils.elements.actionConfirm.disabled = false;
        Utils.elements.actionCancel.textContent = "Cancel";

        Utils.showModal('action-modal');
    },
    
    hide() {
        Utils.hideModal('action-modal');
        this.currentAction = null;
    },
    
    setupMoveAction() {
        this.show('move', {
            title: 'Move to Stack',
            content: `
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    ${STACKS.map(stack => 
                        `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background-color 0.2s;">${STACK_NAMES[stack]}</button>`
                    ).join('')}
                </div>
            `,
            confirmText: 'Cancel'
        });
        
        document.querySelectorAll('.move-option').forEach(option => {
            option.addEventListener('click', () => {
                const targetStack = option.dataset.stack;
                this.executeMove(targetStack);
            });
        });
    },
    
    setupTagAction() {
        this.show('tag', {
            title: 'Add Tags',
            content: `
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Enter tags (comma separated)</label>
                    <input type="text" id="modal-tag-input" class="tag-input" placeholder="nature, landscape, vacation">
                </div>
                <div id="modal-tag-suggestions" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                    ${Array.from(state.tags).map(tag => 
                        `<button class="tag-suggestion" data-tag="${tag}" style="background-color: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: background-color 0.2s; border: none;">${tag}</button>`
                    ).join('')}
                </div>
            `,
            confirmText: 'Apply'
        });
        
        document.querySelectorAll('.tag-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('modal-tag-input');
                input.value += (input.value ? ', ' : '') + btn.dataset.tag;
            });
        });
    },
    
    setupDeleteAction() {
        const selectedCount = state.grid.selected.length;
        const providerName = state.providerType === 'googledrive' ? 'Google Drive' : 'OneDrive';
        const message = `Are you sure you want to move ${selectedCount} image(s) to your ${providerName} trash? This can be recovered from the provider's website.`;
        
        this.show('delete', {
            title: 'Confirm Delete',
            content: `<p style="color: #4b5563; margin-bottom: 16px;">${message}</p>`,
            confirmText: `Move to ${providerName} Trash`,
            confirmClass: 'btn-danger'
        });
    },
    
    setupExportAction() {
        this.show('export', {
            title: 'Export to Spreadsheet',
            content: `
                <p style="color: #4b5563; margin-bottom: 16px;">
                    This will start the new Live Export process for ${state.grid.selected.length} selected image(s).
                </p>
                <p style="color: #4b5563; margin-bottom: 16px;">
                    It will fetch fresh data directly from the cloud to ensure 100% accuracy.
                </p>
            `,
            confirmText: 'Begin Export'
        });
    },

    setupFocusStackSwitch() {
        const availableStacks = STACKS.filter(s => s !== state.currentStack && state.stacks[s].length > 0);
        let content = `<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">`;
        if (availableStacks.length > 0) {
            content += availableStacks.map(stack => 
                `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background-color 0.2s;">${STACK_NAMES[stack]} (${state.stacks[stack].length})</button>`
            ).join('');
        } else {
            content += `<p style="color: #4b5563; text-align: center;">No other stacks have images.</p>`;
        }
        content += `</div>`;

        this.show('focus-stack-switch', {
            title: 'Switch Stack',
            content: content,
            confirmText: 'Cancel'
        });

        document.querySelectorAll('.move-option').forEach(option => {
            option.addEventListener('click', () => {
                const targetStack = option.dataset.stack;
                UI.switchToStack(targetStack);
                Core.updateImageCounters();
                this.hide();
            });
        });
    },
    
    setupFolderMoveAction() {
        this.show('folder-move', {
            title: 'Move to Different Folder',
            content: `
                <p style="color: #4b5563; margin-bottom: 16px;">
                    This will move ${state.grid.selected.length} image${state.grid.selected.length > 1 ? 's' : ''} to a different folder. 
                    The images will be removed from this stack and their metadata will move with them.
                </p>
                <div style="margin-bottom: 16px;">
                    <strong>Note:</strong> This action requires provider support and may not be available for all cloud storage providers.
                </div>
            `,
            confirmText: 'Choose Destination Folder'
        });
    },
    
    async executeBulkAction(actionFn, successMessage, options = {}) {
        const { refreshGrid = true, deselect = true } = options;
        const confirmBtn = Utils.elements.actionConfirm;
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        try {
            const promises = state.grid.selected.map(fileId => actionFn(fileId));
            await Promise.all(promises);

            Utils.showToast(successMessage.replace('{count}', promises.length), 'success', true);
            if(!options.keepModalOpen) this.hide();
            
            if (refreshGrid) {
                // Re-render the grid content after action
                Utils.elements.gridContainer.innerHTML = '';
                Grid.initializeLazyLoad(state.grid.stack);
            }
            if (deselect) {
                Grid.deselectAll(); // Visually deselect and reset buttons
            }
            
            Core.updateStackCounts();
        } catch (error) {
            Utils.showToast(`Failed to process some images: ${error.message}`, 'error', true);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    },

    async executeMove(targetStack) {
        await this.executeBulkAction(async (fileId) => {
            const file = state.imageFiles.find(f => f.id === fileId);
            if (file) {
                const currentStack = file.stack;
                const newSequence = Date.now();
                App.moveFileToStack(fileId, targetStack, newSequence);
                
                const currentStackIndex = state.stacks[currentStack].findIndex(f => f.id === fileId);
                if (currentStackIndex !== -1) {
                    state.stacks[currentStack].splice(currentStackIndex, 1);
                }
                
                file.stackSequence = newSequence;
                state.stacks[targetStack].unshift(file);
                state.stacks[targetStack] = Core.sortFiles(state.stacks[targetStack]);
            }
        }, `Moved {count} images to ${targetStack}`);
    },

    async executeTag() {
        const tagInput = document.getElementById('modal-tag-input');
        if (!tagInput.value.trim()) return;
        const tagsToAdd = tagInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);

        await this.executeBulkAction(async (fileId) => {
            const file = state.imageFiles.find(f => f.id === fileId);
            if (file) {
                const currentTags = file.tags || [];
                const newTags = [...new Set([...currentTags, ...tagsToAdd])];
                App.updateUserMetadata(fileId, { tags: newTags });
                tagsToAdd.forEach(tag => state.tags.add(tag));
            }
        }, `Tags added to {count} images`, { refreshGrid: false });
    },

    async executeDelete() {
        await this.executeBulkAction(async (fileId) => {
            await App.deleteFile(fileId);
            
            const fileIndex = state.imageFiles.findIndex(f => f.id === fileId);
            if (fileIndex > -1) {
                const [file] = state.imageFiles.splice(fileIndex, 1);
                const stackIndex = state.stacks[file.stack].findIndex(f => f.id === fileId);
                if (stackIndex > -1) {
                    state.stacks[file.stack].splice(stackIndex, 1);
                }
            }
        }, `Moved {count} images to provider trash`);
    },
    
    async executeExport() {
        const fileIds = [...state.grid.selected];
        const filesToExport = fileIds.map(id => state.imageFiles.find(f => f.id === id)).filter(f => f);
        const total = filesToExport.length;
        const results = [];
        let failures = 0;
        
        Utils.elements.actionTitle.textContent = `Live Export: 0 of ${total}`;
        Utils.elements.actionContent.innerHTML = `
            <div style="background: #111; border: 1px solid #333; color: #eee; font-family: monospace; font-size: 12px; height: 250px; overflow-y: scroll; padding: 8px; white-space: pre-wrap;" id="export-log"></div>
        `;
        const logEl = document.getElementById('export-log');
        Utils.elements.actionConfirm.disabled = true;
        Utils.elements.actionCancel.textContent = "Close";
        
        const log = (message) => {
            logEl.textContent += message + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };
        
        log(`Starting export for ${total} images...`);
        
        for (let i = 0; i < filesToExport.length; i++) {
            const file = filesToExport[i];
            Utils.elements.actionTitle.textContent = `Live Export: ${i + 1} of ${total}`;
            log(`\n[${i+1}/${total}] Processing: ${file.name}`);
            
            let extractedMetadata = {};
            let success = false;
            
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const metadata = await state.metadataExtractor.fetchMetadata(file, true);
                    if (metadata.error) throw new Error(metadata.error);
                    
                    extractedMetadata = metadata;
                    log(`  ✅ Success`);
                    success = true;
                    break;
                } catch (error) {
                    log(`  ⚠️ Attempt ${attempt} failed: ${error.message}`);
                    if (attempt < 3) {
                        const delay = 1000 * attempt;
                        log(`     Retrying in ${delay / 1000}s...`);
                        await new Promise(res => setTimeout(res, delay));
                    } else {
                        log(`  ❌ FAILED permanently after 3 attempts.`);
                        failures++;
                    }
                }
            }
            
            results.push({
                ...file,
                extractedMetadata: extractedMetadata
            });
        }
        
        log('\n-------------------------------------');
        log('Export process complete.');
        log(`Successfully processed: ${total - failures} files.`);
        log(`Failed: ${failures} files.`);
        
        if (results.length > 0) {
            state.export.exportData(results);
            log('CSV file has been generated and downloaded.');
        } else {
            log('No data to export.');
        }
        
        Utils.elements.actionTitle.textContent = `Export Complete`;
        Utils.elements.actionConfirm.disabled = true;
        Utils.elements.actionCancel.textContent = "Close";
    },
    
    executeFolderMove() {
        state.folderMoveMode = {
            active: true,
            files: [...state.grid.selected],
        };
        
        this.hide();
        Grid.close();
        App.returnToFolderSelection();
        Utils.showToast(`Select destination folder for ${state.folderMoveMode.files.length} images`, 'info', true);
    }
};
