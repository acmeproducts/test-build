const Details = {
    currentTab: 'info',
    
    async show() {
        const currentFile = state.stacks[state.currentStack][state.currentStackPosition];
        if (!currentFile) return;

        if (currentFile.metadataStatus !== 'loaded') {
            this.populateMetadataTab(currentFile);
            await App.processFileMetadata(currentFile);
        }
        
        this.populateAllTabs(currentFile);
        Utils.showModal('details-modal');
        this.switchTab('info');
    },
    
    hide() {
        Utils.hideModal('details-modal');
    },
    
    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
        
        this.currentTab = tabName;
    },
    
    populateAllTabs(file) {
        this.populateInfoTab(file);
        this.populateTagsTab(file);
        this.populateNotesTab(file);
        this.populateMetadataTab(file);
    },
    
    populateInfoTab(file) {
        const filename = file.name || 'Unknown';
        Utils.elements.detailFilename.textContent = filename;
        
        if (state.providerType === 'googledrive') {
            Utils.elements.detailFilenameLink.href = `https://drive.google.com/file/d/${file.id}/view`;
        } else {
            Utils.elements.detailFilenameLink.href = file.downloadUrl || '#';
        }
        Utils.elements.detailFilenameLink.style.display = 'inline';
        
        const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 
                   file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Unknown';
        Utils.elements.detailDate.textContent = date;
        
        const size = file.size ? Utils.formatFileSize(file.size) : 'Unknown';
        Utils.elements.detailSize.textContent = size;
    },
    
    populateTagsTab(file) {
        const tags = file.tags || [];
        
        Utils.elements.detailTags.innerHTML = '';
        
        tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
                <span>${tag}</span>
                <button class="tag-remove" data-tag="${tag}">×</button>
            `;
            Utils.elements.detailTags.appendChild(tagElement);
        });
        
        const addButton = document.createElement('div');
        addButton.className = 'add-tag-btn';
        addButton.textContent = '+ Add Tag';
        addButton.addEventListener('click', () => this.showAddTagInput());
        Utils.elements.detailTags.appendChild(addButton);
        
        Utils.elements.detailTags.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagToRemove = e.target.dataset.tag;
                this.removeTag(file, tagToRemove);
            });
        });
    },
    
    showAddTagInput() {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tag-input';
        input.placeholder = 'Enter tag name';
        input.style.marginLeft = '8px';
        
        const addButton = Utils.elements.detailTags.querySelector('.add-tag-btn');
        addButton.parentNode.insertBefore(input, addButton);
        input.focus();
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const tagName = input.value.trim();
                if (tagName) {
                    const currentFile = state.stacks[state.currentStack][state.currentStackPosition];
                    const currentTags = currentFile.tags || [];
                    const newTags = [...new Set([...currentTags, tagName])];
                    
                    App.updateUserMetadata(currentFile.id, { tags: newTags });
                    state.tags.add(tagName);
                    
                    this.populateTagsTab(currentFile);
                    input.remove();
                }
            } else if (e.key === 'Escape') {
                input.remove();
            }
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => input.remove(), 100);
        });
    },
    
    removeTag(file, tagToRemove) {
        const currentTags = file.tags || [];
        const newTags = currentTags.filter(tag => tag !== tagToRemove);
        
        App.updateUserMetadata(file.id, { tags: newTags });
        this.populateTagsTab(file);
    },
    
    populateNotesTab(file) {
        Utils.elements.detailNotes.value = file.notes || '';
        
        const newNotesTextarea = Utils.elements.detailNotes.cloneNode(true);
        Utils.elements.detailNotes.parentNode.replaceChild(newNotesTextarea, Utils.elements.detailNotes);
        Utils.elements.detailNotes = newNotesTextarea;
        
        Utils.elements.detailNotes.addEventListener('blur', () => {
            const currentFile = state.stacks[state.currentStack][state.currentStackPosition];
            if (currentFile.notes !== Utils.elements.detailNotes.value) {
                App.updateUserMetadata(currentFile.id, { notes: Utils.elements.detailNotes.value });
            }
        });
        
        this.setupStarRating('quality', file.qualityRating || 0);
        this.setupStarRating('content', file.contentRating || 0);
    },
    
    setupStarRating(type, currentRating) {
        const container = Utils.elements[`${type}Rating`];
        if (!container) return;

        let rating = currentRating;
        const stars = container.querySelectorAll('.star');

        const updateVisuals = (r) => {
            stars.forEach((star, index) => {
                star.classList.toggle('active', index < r);
            });
        };

        container.onmouseleave = () => updateVisuals(rating);

        stars.forEach((star, index) => {
            star.onmouseenter = () => updateVisuals(index + 1);
            star.onclick = () => {
                const newRating = index + 1;
                if (newRating === rating) {
                    rating = 0;
                } else {
                    rating = newRating;
                }
                updateVisuals(rating);

                const currentFile = state.stacks[state.currentStack][state.currentStackPosition];
                if (!currentFile) return;

                const updatePayload = {};
                if (type === 'quality') {
                    updatePayload.qualityRating = rating;
                } else {
                    updatePayload.contentRating = rating;
                }

                App.updateUserMetadata(currentFile.id, updatePayload);
            };
        });

        updateVisuals(rating);
    },
    
    populateMetadataTab(file) {
        Utils.elements.metadataTable.innerHTML = '';
        
        if (file.metadataStatus !== 'loaded') {
            Utils.elements.metadataTable.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>`;
            return;
        }

        const metadata = file.extractedMetadata || {};
        
        if (Object.keys(metadata).length === 0) {
            this.addMetadataRow('Status', 'No embedded metadata found', false);
            return;
        }
        
        const priorityFields = ['prompt', 'Prompt', 'model', 'Model', 'seed', 'Seed', 'negative_prompt', 'Negative_Prompt', 'steps', 'Steps', 'cfg_scale', 'CFG_Scale', 'sampler', 'Sampler', 'scheduler', 'Scheduler', 'api_call', 'API_Call'];
        
        priorityFields.forEach(field => {
            if (metadata[field]) {
                this.addMetadataRow(field, metadata[field], true);
            }
        });
        
        const remainingFields = Object.entries(metadata).filter(([key, value]) => 
            !priorityFields.includes(key) && 
            !priorityFields.includes(key.toLowerCase()) && 
            value
        );
        
        if (priorityFields.some(field => metadata[field]) && remainingFields.length > 0) {
            const separatorRow = document.createElement('tr');
            separatorRow.innerHTML = `
                <td colspan="2" style="padding: 8px; background: #f0f0f0; text-align: center; font-size: 12px; color: #666; font-weight: bold;">
                    Other Metadata
                </td>
            `;
            Utils.elements.metadataTable.appendChild(separatorRow);
        }
        
        remainingFields.forEach(([key, value]) => {
            this.addMetadataRow(key, value, false);
        });
        
        if (Object.keys(metadata).length > 0) {
            const separatorRow = document.createElement('tr');
            separatorRow.innerHTML = `
                <td colspan="2" style="padding: 8px; background: #f0f0f0; text-align: center; font-size: 12px; color: #666; font-weight: bold;">
                    File Information
                </td>
            `;
            Utils.elements.metadataTable.appendChild(separatorRow);
        }
        
        this.addMetadataRow('File Name', file.name || 'Unknown', false);
        this.addMetadataRow('File Size', file.size ? Utils.formatFileSize(file.size) : 'Unknown', false);
        this.addMetadataRow('MIME Type', file.mimeType || 'Unknown', false);
        this.addMetadataRow('Created', file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Unknown', false);
        this.addMetadataRow('Modified', file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Unknown', false);
        this.addMetadataRow('Provider', state.providerType === 'googledrive' ? 'Google Drive' : 'OneDrive', false);
    },
    
    addMetadataRow(key, value, needsCopyButton = false) {
        const row = document.createElement('tr');
        
        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        let formattedValue = String(value);
        
        if (formattedValue.length > 200) {
            formattedValue = formattedValue
                .replace(/,\s+/g, ',\n')
                .replace(/\.\s+/g, '.\n')
                .replace(/;\s+/g, ';\n')
                .trim();
        } else if (formattedValue.length > 100) {
            formattedValue = formattedValue.replace(/\s+/g, ' ').trim();
        }
        
        const keyCell = document.createElement('td');
        keyCell.className = 'key-cell';
        keyCell.textContent = formattedKey;
        
        const valueCell = document.createElement('td');
        valueCell.className = 'value-cell';
        
        if (formattedValue.length > 500) {
            valueCell.style.maxHeight = '120px';
            valueCell.style.overflowY = 'auto';
            valueCell.style.fontSize = '12px';
            valueCell.style.lineHeight = '1.4';
        }
        
        valueCell.textContent = formattedValue;
        
        if (needsCopyButton) {
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button copy-metadata';
            copyButton.textContent = 'Copy';
            copyButton.dataset.value = String(value);
            copyButton.title = `Copy ${formattedKey} to clipboard`;
            valueCell.appendChild(copyButton);
        }
        
        row.appendChild(keyCell);
        row.appendChild(valueCell);
        Utils.elements.metadataTable.appendChild(row);
    },
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            Utils.showToast('📋 Copied to clipboard', 'success', true);
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                Utils.showToast('📋 Copied to clipboard', 'success', true);
            } catch (err) {
                Utils.showToast('❌ Failed to copy', 'error', true);
            }
            document.body.removeChild(textArea);
        });
    }
};
