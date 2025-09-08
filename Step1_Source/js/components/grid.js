const Grid = {
    open(stack) {
        Utils.showModal('grid-modal');
        Utils.elements.gridTitle.textContent = STACK_NAMES[stack] || stack;
        state.grid.stack = stack;
        state.grid.isDirty = false;
        
        // Initialize grid layout correctly
        const value = Utils.elements.gridSize.value;
        Utils.elements.gridContainer.style.gridTemplateColumns = `repeat(${value}, 1fr)`;
        
        state.grid.selected = [];
        state.grid.filtered = [];
        Utils.elements.gridContainer.innerHTML = '';

        this.initializeLazyLoad(stack);
        this.updateSelectionUI();
        Core.updateStackCounts();
    },
    
    async close() {
        if (state.grid.isDirty) {
            await this.reorderStackOnClose();
        }
        
        Utils.hideModal('grid-modal');
        this.resetSearch();
        this.destroyLazyLoad();

        const selectedImages = state.grid.selected;
        if (selectedImages.length === 1) {
            const selectedFileId = selectedImages[0];
            const stackArray = state.stacks[state.currentStack];
            const selectedIndex = stackArray.findIndex(f => f.id === selectedFileId);
            if (selectedIndex !== -1) {
                state.currentStackPosition = selectedIndex;
            }
        }
        
        Core.displayCurrentImage();
        
        state.grid.stack = null;
        state.grid.selected = [];
    },

    handleIntersection(entries) {
        if (entries[0].isIntersecting) {
            this.renderBatch();
        }
    },

    initializeLazyLoad(stack) {
        const lazyState = state.grid.lazyLoadState;
        lazyState.allFiles = state.grid.filtered.length > 0 ? state.grid.filtered : state.stacks[stack];
        lazyState.renderedCount = 0;
        Utils.elements.selectAllBtn.textContent = lazyState.allFiles.length;

        this.renderBatch();

        if (lazyState.observer) lazyState.observer.disconnect();
        
        lazyState.observer = new IntersectionObserver(this.handleIntersection.bind(this), { 
            root: Utils.elements.gridContent, 
            rootMargin: "400px"
        });

        const sentinel = document.getElementById('grid-sentinel');
        if (sentinel) {
            lazyState.observer.observe(sentinel);
        }
    },

    destroyLazyLoad() {
        const lazyState = state.grid.lazyLoadState;
        if (lazyState.observer) {
            lazyState.observer.disconnect();
            lazyState.observer = null;
        }
        lazyState.allFiles = [];
        lazyState.renderedCount = 0;
    },

    renderBatch() {
        const lazyState = state.grid.lazyLoadState;
        const container = Utils.elements.gridContainer;
        const filesToRender = lazyState.allFiles.slice(lazyState.renderedCount, lazyState.renderedCount + lazyState.batchSize);

        const oldSentinel = document.getElementById('grid-sentinel');
        if (oldSentinel && lazyState.observer) {
            lazyState.observer.unobserve(oldSentinel);
            oldSentinel.remove();
        }

        filesToRender.forEach(file => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.dataset.fileId = file.id;
            
            if (state.grid.selected.includes(file.id)) {
                div.classList.add('selected');
            }
            
            const img = document.createElement('img');
            img.className = 'grid-image';
            img.alt = file.name || 'Image';
            img.dataset.src = Utils.getPreferredImageUrl(file);

            img.onload = () => img.classList.add('loaded');
            img.onerror = () => {
                img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 150 150\' fill=\'none\'%3E%3Crect width=\'150\' height=\'150\' fill=\'%23E5E7EB\'/%3E%3Cpath d=\'M65 60H85V90H65V60Z\' fill=\'%239CA3AF\'/%3E%3Ccircle cx=\'75\' cy=\'45\' r=\'10\' fill=\'%239CA3AF\'/%3E%3C/svg%3E';
                img.classList.add('loaded');
            };
            
            div.addEventListener('click', e => this.toggleSelection(e, file.id));
            
            div.appendChild(img);
            container.appendChild(div);
        });

        container.querySelectorAll('.grid-image:not([src])').forEach(img => {
            img.src = img.dataset.src;
        });

        lazyState.renderedCount += filesToRender.length;

        if (lazyState.renderedCount < lazyState.allFiles.length) {
            const sentinel = document.createElement('div');
            sentinel.id = 'grid-sentinel';
            container.appendChild(sentinel);
            if (lazyState.observer) {
                lazyState.observer.observe(sentinel);
            }
        }
    },
    
    toggleSelection(e, fileId) {
        const gridItem = e.currentTarget;
        const index = state.grid.selected.indexOf(fileId);
        
        if (index === -1) {
            state.grid.selected.push(fileId);
            gridItem.classList.add('selected');
        } else {
            state.grid.selected.splice(index, 1);
            gridItem.classList.remove('selected');
        }
        
        state.grid.isDirty = true;
        this.updateSelectionUI();
    },
    
    updateSelectionUI() {
        const count = state.grid.selected.length;
        const buttons = [Utils.elements.tagSelected, Utils.elements.moveSelected, Utils.elements.deleteSelected, 
                               Utils.elements.exportSelected, Utils.elements.folderSelected];
        
        Utils.elements.selectionText.textContent = `${count} selected`;
        
        buttons.forEach(btn => {
            if (btn) btn.disabled = (count === 0);
        });
    },
    
    selectAll() {
        const filesToSelect = state.grid.lazyLoadState.allFiles;
        state.grid.selected = filesToSelect.map(f => f.id);
        
        document.querySelectorAll('#grid-container .grid-item').forEach(item => {
            item.classList.add('selected');
        });
        
        state.grid.isDirty = true;
        this.updateSelectionUI();
    },
    
    deselectAll() {
        document.querySelectorAll('#grid-container .grid-item.selected').forEach(item => 
            item.classList.remove('selected')
        );
        state.grid.selected = [];
        this.updateSelectionUI();
    },
    
    performSearch() {
        const query = Utils.elements.omniSearch.value.trim();
        Utils.elements.clearSearchBtn.style.display = query ? 'block' : 'none';
        state.grid.selected = [];
        
        if (!query) {
            this.resetSearch();
            return;
        }
        
        state.grid.filtered = this.searchImages(query);
        
        Utils.elements.gridContainer.innerHTML = '';
        this.initializeLazyLoad(state.grid.stack);
        this.updateSelectionUI();
        state.grid.isDirty = true;
    },

    resetSearch() {
        Utils.elements.omniSearch.value = '';
        Utils.elements.clearSearchBtn.style.display = 'none';
        state.grid.filtered = [];
        Utils.elements.gridContainer.innerHTML = '';
        this.initializeLazyLoad(state.grid.stack);
        Core.updateStackCounts();
        this.deselectAll();
    },
    
    searchImages(query) {
        const pattern = query
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*')
            .replace(/\\\?/g, '.');
        const regex = new RegExp(pattern, 'i');

        return state.stacks[state.grid.stack].filter(file => {
            const searchableText = [
                file.name || '',
                file.tags?.join(' ') || '',
                file.notes || '',
                JSON.stringify(file.extractedMetadata || {})
            ].join(' ');
            
            return regex.test(searchableText);
        });
    },

    async reorderStackOnClose() {
        const stackArray = state.stacks[state.grid.stack];
        let topItems = [];
        let bottomItems = [];

        if (state.grid.filtered.length > 0) { // Search was active
            const filteredIds = new Set(state.grid.filtered.map(f => f.id));
            topItems = state.grid.filtered.sort((a, b) => a.name.localeCompare(b.name));
            bottomItems = stackArray.filter(f => !filteredIds.has(f.id));
        } else if (state.grid.selected.length > 0) { // Manual selection
            const selectedIds = new Set(state.grid.selected);
            topItems = stackArray.filter(f => selectedIds.has(f.id)).sort((a,b) => a.name.localeCompare(b.name));
            bottomItems = stackArray.filter(f => !selectedIds.has(f.id));
        } else {
            return; // No reordering needed
        }
        
        const newStack = [...topItems, ...bottomItems];
        const timestamp = Date.now();
        
        // Update sequence numbers for persistence
        for (let i = 0; i < newStack.length; i++) {
            newStack[i].stackSequence = timestamp - i;
            // Mark each reordered file as dirty
            App.updateUserMetadata(newStack[i].id, { stackSequence: newStack[i].stackSequence });
        }

        state.stacks[state.grid.stack] = newStack;
        state.currentStackPosition = 0; // Reset pointer to the top of the reordered stack

        Utils.showToast('Stack order updated', 'success');
    }
};
