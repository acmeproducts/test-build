function AppState(pubSub) {
    const state = {
        provider: null, providerType: null, currentFolder: { id: null, name: '' },
        imageFiles: [], currentImageLoadId: null, currentStack: 'in', currentStackPosition: 0,
        isFocusMode: false, stacks: { in: [], out: [], priority: [], trash: [] },
        isDragging: false, isPinching: false, initialDistance: 0, currentScale: 1,
        maxScale: 4, minScale: 0.3, panOffset: { x: 0, y: 0 },
        grid: { stack: null, selected: [], filtered: [], isDirty: false,
            lazyLoadState: { allFiles: [], renderedCount: 0, observer: null, batchSize: 20 } },
        tags: new Set(), loadingProgress: { current: 0, total: 0 },
        folderMoveMode: { active: false, files: [] }
    };

    const STACKS = ['in', 'out', 'priority', 'trash'];

    function getState() {
        return { ...state };
    }

    function _publishUpdate() {
        pubSub.publish('state:updated', getState());
    }

    function _sortFiles(files) {
        return [...files].sort((a, b) => {
            const seqA = a.stackSequence || 0;
            const seqB = b.stackSequence || 0;
            if (seqB !== seqA) return seqB - seqA;
            return (a.name || '').localeCompare(b.name || '');
        });
    }

    function initializeStacks(imageFiles) {
        state.imageFiles = imageFiles.map(file => {
             const userMetadata = state.provider.getUserMetadata(file.id);
             const allTags = userMetadata.tags || [];
             allTags.forEach(tag => state.tags.add(tag));
             return { ...file, ...userMetadata };
        });
        
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
            state.stacks[stack] = _sortFiles(state.stacks[stack]);
        });

        state.currentStack = 'in';
        state.currentStackPosition = 0;
        _publishUpdate();
    }

    function selectFolder(folderId, folderName, providerType, provider) {
        state.currentFolder = { id: folderId, name: folderName };
        state.providerType = providerType;
        state.provider = provider;
    }
    
    function resetToProviderSelection() {
        state.provider = null;
        state.providerType = null;
        state.imageFiles = [];
        state.currentFolder = { id: null, name: '' };
        STACKS.forEach(stack => { state.stacks[stack] = []; });
        _publishUpdate();
    }
    
    function moveToStack({ targetStack }) {
        const currentStackArray = state.stacks[state.currentStack];
        if (!currentStackArray || currentStackArray.length === 0) return;
        
        const currentImage = currentStackArray[state.currentStackPosition];
        if (!currentImage) return;

        const originalStackName = state.currentStack;

        if (targetStack === originalStackName) {
            const otherImages = currentStackArray.filter(img => img.id !== currentImage.id);
            const minSequence = otherImages.length > 0 ? Math.min(...otherImages.map(img => img.stackSequence || 0)) : Date.now();
            currentImage.stackSequence = minSequence - 1;
            const [item] = currentStackArray.splice(state.currentStackPosition, 1);
            currentStackArray.push(item);
        } else {
            currentImage.stack = targetStack;
            currentImage.stackSequence = Date.now();
            const [item] = currentStackArray.splice(state.currentStackPosition, 1);
            state.stacks[targetStack].unshift(item);
            state.stacks[targetStack] = _sortFiles(state.stacks[targetStack]);
        }
        
        state.provider.updateUserMetadata(currentImage.id, {
            stack: currentImage.stack,
            stackSequence: currentImage.stackSequence
        });
        
        _publishUpdate();
    }

    function reorderStackWithSelection({ stackName, selectedFileIds }) {
        if (selectedFileIds.length === 0) return;

        const stackArray = state.stacks[stackName];
        const selectedIds = new Set(selectedFileIds);

        const topItems = stackArray.filter(f => selectedIds.has(f.id));
        const bottomItems = stackArray.filter(f => !selectedIds.has(f.id));
        
        const newStack = [...topItems, ...bottomItems];
        const timestamp = Date.now();
        
        for (let i = 0; i < newStack.length; i++) {
            newStack[i].stackSequence = timestamp - i;
            state.provider.updateUserMetadata(newStack[i].id, { stackSequence: newStack[i].stackSequence });
        }

        state.stacks[stackName] = newStack;
        state.currentStackPosition = 0;

        _publishUpdate();
        pubSub.publish('ui:show-toast', { message: 'Stack order updated', type: 'success' });
    }

    function changeStack({ stackName }) {
        if (state.currentStack !== stackName) {
            state.currentStack = stackName;
            state.currentStackPosition = 0;
            _publishUpdate();
        }
    }
    
    function updateMetadata({ fileId, updates }) {
        const file = state.imageFiles.find(f => f.id === fileId);
        if (file) {
            Object.assign(file, updates);
            state.provider.updateUserMetadata(fileId, updates);
            if(updates.tags) {
                updates.tags.forEach(t => state.tags.add(t));
            }
        }
        _publishUpdate();
    }
    
    async function deleteFiles(fileIds) {
        for (const fileId of fileIds) {
            await state.provider.deleteFile(fileId);
            const file = state.imageFiles.find(f => f.id === fileId);
            if (file) {
                 const fileIndex = state.imageFiles.indexOf(file);
                 state.imageFiles.splice(fileIndex, 1);
                 
                 const stackIndex = state.stacks[file.stack].indexOf(file);
                 if (stackIndex > -1) {
                     state.stacks[file.stack].splice(stackIndex, 1);
                 }
            }
        }
        _publishUpdate();
        pubSub.publish('ui:show-toast', { message: `Moved ${fileIds.length} image(s) to provider trash`, type: 'success', important: true });
    }
    
    async function moveFilesToFolder({ fileIds, targetFolderId, targetFolderName }) {
        for(let i=0; i<fileIds.length; i++) {
            const fileId = fileIds[i];
            await state.provider.moveFileToFolder(fileId, targetFolderId);
            const file = state.imageFiles.find(f => f.id === fileId);
            if (file) {
                const fileIndex = state.imageFiles.indexOf(file);
                state.imageFiles.splice(fileIndex, 1);
                const stackIndex = state.stacks[file.stack].indexOf(file);
                if (stackIndex > -1) {
                    state.stacks[file.stack].splice(stackIndex, 1);
                }
            }
        }
        pubSub.publish('ui:show-toast', { message: `Moved ${fileIds.length} images to ${targetFolderName}`, type: 'success', important: true });
        _publishUpdate();
    }

    pubSub.subscribe('centerStage:image-flicked', moveToStack);
    pubSub.subscribe('centerStage:stack-selected', changeStack);
    pubSub.subscribe('grid:closed-with-selection', reorderStackWithSelection);
    pubSub.subscribe('details:metadata-updated', updateMetadata);
    pubSub.subscribe('centerStage:focus-delete-requested', ({ fileId }) => deleteFiles([fileId]));
    pubSub.subscribe('action:confirmed:grid:bulk-delete-action', ({ payload }) => deleteFiles(payload.fileIds));
    pubSub.subscribe('action:confirmed:grid:bulk-folder-move-action', ({ payload }) => moveFilesToFolder(payload));


    return {
        getState,
        initializeStacks,
        selectFolder,
        resetToProviderSelection,
        updateMetadata,
        deleteFiles
    };
}
