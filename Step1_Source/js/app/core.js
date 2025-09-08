const Core = {
    initializeStacks() {
        STACKS.forEach(stack => { state.stacks[stack] = []; });
        
        state.imageFiles.forEach(file => {
            const stack = file.stack || 'in';
            if (STACKS.includes(stack)) {
                state.stacks[stack].push(file);
            } else {
                state.stacks.in.push(file);
            }
        });
        
        STACKS.forEach(stack => {
            state.stacks[stack] = this.sortFiles(state.stacks[stack]);
        });
        
        this.updateStackCounts();
    },
    
    sortFiles(files) {
        return [...files].sort((a, b) => {
            const seqA = a.stackSequence || 0;
            const seqB = b.stackSequence || 0;
            if (seqB !== seqA) {
                return seqB - seqA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    },
    
    updateStackCounts() {
        STACKS.forEach(stack => {
            const count = state.stacks[stack].length;
            const pill = document.getElementById(`pill-${stack}`);
            if (pill) {
                pill.textContent = count > 999 ? ':)' : count;
                pill.classList.toggle('visible', count > 0);
            }
        });
    },
    
    initializeImageDisplay() {
        state.currentStackPosition = 0;
        state.currentStack = 'in';
        
        this.displayTopImageFromStack('in');
        this.updateActiveProxTab();
        this.updateStackCounts();
    },
    
    async displayTopImageFromStack(stackName) {
        const stack = state.stacks[stackName];
        if (stack.length === 0) {
            this.showEmptyState();
            return;
        }
        
        Utils.elements.emptyState.classList.add('hidden');
        state.currentStack = stackName;
        state.currentStackPosition = 0; // Always start at the top
        
        await this.displayCurrentImage();
        this.updateActiveProxTab();
    },
    
    async displayCurrentImage() {
        const currentStackArray = state.stacks[state.currentStack];
        if (!currentStackArray || currentStackArray.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Ensure pointer is within bounds
        if (state.currentStackPosition >= currentStackArray.length) {
            state.currentStackPosition = currentStackArray.length - 1;
        }
        if (state.currentStackPosition < 0) {
            state.currentStackPosition = 0;
        }

        const currentFile = currentStackArray[state.currentStackPosition];
        if (!currentFile) {
            this.showEmptyState();
            return;
        }

        Utils.elements.detailsButton.style.display = 'flex';
        
        await Utils.setImageSrc(Utils.elements.centerImage, currentFile);
        
        const folderName = state.currentFolder.name;
        const truncatedFolder = folderName.length > 12 ? folderName.substring(0, 12) + '...' : folderName;
        Utils.elements.filenameOverlay.textContent = `${truncatedFolder} / ${currentFile.name.replace(/\.[^/.]+$/, "")}`;
        Utils.elements.filenameOverlay.href = state.export.getDirectImageURL(currentFile);
        Utils.elements.filenameOverlay.classList.add('visible');

        state.currentScale = 1;
        state.panOffset = { x: 0, y: 0 };
        this.applyTransform();

        if (currentFile.metadataStatus === 'pending') {
            App.processFileMetadata(currentFile);
        }
        
        this.updateImageCounters();
    },

    updateImageCounters() {
        const stack = state.stacks[state.currentStack];
        const total = stack.length;
        const current = total > 0 ? state.currentStackPosition + 1 : 0; // 1-based for display
        const text = `${current} / ${total}`;

        Utils.elements.focusImageCount.textContent = text;
        Utils.elements.normalImageCount.textContent = text;
        Utils.elements.focusStackName.textContent = STACK_NAMES[state.currentStack];
    },
    
    applyTransform() {
        const transform = `scale(${state.currentScale}) translate(${state.panOffset.x}px, ${state.panOffset.y}px)`;
        Utils.elements.centerImage.style.transform = transform;
    },
    
    updateActiveProxTab() {
        STACKS.forEach(stack => {
            const pill = document.getElementById(`pill-${stack}`);
            if (pill) pill.classList.remove('active');
        });
        
        const currentPill = document.getElementById(`pill-${state.currentStack}`);
        if (currentPill) currentPill.classList.add('active');
    },
    
    async moveToStack(targetStack) {
        const currentStackArray = state.stacks[state.currentStack];
        if (!currentStackArray || currentStackArray.length === 0) return;
        
        const currentImage = currentStackArray[state.currentStackPosition];
        if (!currentImage) return;

        const originalStackName = state.currentStack;

        // If moving to the same stack, move to the end
        if (targetStack === originalStackName) {
            const otherImages = currentStackArray.filter(img => img.id !== currentImage.id);
            const minSequence = otherImages.length > 0 ? Math.min(...otherImages.map(img => img.stackSequence || 0)) : Date.now();
            const newSequence = minSequence - 1;

            App.updateUserMetadata(currentImage.id, { stackSequence: newSequence });
            
            // Re-order locally by re-sorting the whole array
            const [item] = currentStackArray.splice(state.currentStackPosition, 1);
            item.stackSequence = newSequence;
            currentStackArray.push(item);

        } else {
            // Move to a different stack
            const newSequence = Date.now();
            App.moveFileToStack(currentImage.id, targetStack, newSequence);

            // Re-order locally
            const [item] = currentStackArray.splice(state.currentStackPosition, 1);
            item.stack = targetStack;
            item.stackSequence = newSequence;
            state.stacks[targetStack].unshift(item); // Add to top of new stack
            state.stacks[targetStack] = this.sortFiles(state.stacks[targetStack]);
        }
        
        this.updateStackCounts();
        this.updateActiveProxTab();
        
        // Display next image in the original stack
        await this.displayCurrentImage();
    },
    
    showEmptyState() {
        state.currentImageLoadId = null;
        Utils.elements.centerImage.style.opacity = '0';
        Utils.elements.filenameOverlay.classList.remove('visible');
        Utils.elements.detailsButton.style.display = 'none';
        this.updateImageCounters(); // Show 0/0
        setTimeout(() => {
            Utils.elements.centerImage.src = '';
            Utils.elements.centerImage.alt = 'No images in this stack';
            Utils.elements.emptyState.classList.remove('hidden');
            Utils.elements.centerImage.style.opacity = '1';
            UI.updateEmptyStateButtons();
        }, 200);
    }
};
