
function AppState(pubSub) {
    const _state = {
        provider: null,
        providerType: null,
        currentFolder: { id: null, name: '' },
        imageFiles: [],
        currentImageLoadId: null,
        currentStack: 'in',
        currentStackPosition: 0,
        isFocusMode: false,
        stacks: { in: [], out: [], priority: [], trash: [] },
        isDragging: false,
        isPinching: false,
        initialDistance: 0,
        currentScale: 1,
        maxScale: 4,
        minScale: 0.3,
        panOffset: { x: 0, y: 0 },
        grid: { stack: null, selected: [], filtered: [], isDirty: false,
            lazyLoadState: { allFiles: [], renderedCount: 0, observer: null, batchSize: 20 } },
        tags: new Set(),
        loadingProgress: { current: 0, total: 0 },
        folderMoveMode: { active: false, files: [] }
    };

    function getState() {
        return { ..._state };
    }

    function _publishUpdate() {
        pubSub.publish('state:updated', getState());
    }

    function setProvider(provider) {
        _state.provider = provider;
        _state.providerType = provider.name;
    }
    
    function setCurrentFolder(folderId, folderName) {
        _state.currentFolder = { id: folderId, name: folderName };
    }

    function setImageFiles(files) {
        _state.imageFiles = files;
        _initializeStacks();
        _publishUpdate();
    }
    
    function _initializeStacks() {
        _state.stacks = { in: [], out: [], priority: [], trash: [] };
        
        _state.imageFiles.forEach(file => {
            const stack = file.stack || 'in';
            if (_state.stacks[stack]) {
                _state.stacks[stack].push(file);
            } else {
                _state.stacks.in.push(file);
            }
        });
        
        Object.keys(_state.stacks).forEach(stackName => {
            _state.stacks[stackName] = _sortFiles(_state.stacks[stackName]);
        });
    }

    function _sortFiles(files) {
        return [...files].sort((a, b) => {
            const seqA = a.stackSequence || 0;
            const seqB = b.stackSequence || 0;
            if (seqB !== seqA) {
                return seqB - seqA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    }

    function moveToStack({ targetStack }) {
        const currentStackArray = _state.stacks[_state.currentStack];
        if (!currentStackArray || currentStackArray.length === 0) return;
        
        const currentImage = currentStackArray[_state.currentStackPosition];
        if (!currentImage) return;

        const originalStackName = _state.currentStack;

        if (targetStack === originalStackName) {
            const otherImages = currentStackArray.filter(img => img.id !== currentImage.id);
            const minSequence = otherImages.length > 0 ? Math.min(...otherImages.map(img => img.stackSequence || 0)) : Date.now();
            const newSequence = minSequence - 1;
            
            _state.provider.updateUserMetadata(currentImage.id, { stackSequence: newSequence });
            
            const [item] = currentStackArray.splice(_state.currentStackPosition, 1);
            item.stackSequence = newSequence;
            currentStackArray.push(item);
        } else {
            const newSequence = Date.now();
            _state.provider.updateUserMetadata(currentImage.id, { stack: targetStack, stackSequence: newSequence });

            const [item] = currentStackArray.splice(_state.currentStackPosition, 1);
            item.stack = targetStack;
            item.stackSequence = newSequence;
            _state.stacks[targetStack].unshift(item);
            _state.stacks[targetStack] = _sortFiles(_state.stacks[targetStack]);
        }
        
        _publishUpdate();
    }
    
    function selectStack( { stackName } ) {
        _state.currentStack = stackName;
        _state.currentStackPosition = 0;
        _publishUpdate();
    }

    function reorderStack( { stackName, selectedIds } ) {
        if (!selectedIds || selectedIds.length === 0) {
            _publishUpdate();
            return;
        }

        const stackArray = _state.stacks[stackName];
        const selectedIdSet = new Set(selectedIds);
        
        const topItems = stackArray.filter(f => selectedIdSet.has(f.id));
        const bottomItems = stackArray.filter(f => !selectedIdSet.has(f.id));

        const newStack = [...topItems, ...bottomItems];
        const timestamp = Date.now();

        for (let i = 0; i < newStack.length; i++) {
            newStack[i].stackSequence = timestamp - i;
            _state.provider.updateUserMetadata(newStack[i].id, { stackSequence: newStack[i].stackSequence });
        }

        _state.stacks[stackName] = newStack;
        _state.currentStackPosition = 0;
        _publishUpdate();
    }

    async function deleteFiles({ fileIds }) {
        for (const fileId of fileIds) {
            await _state.provider.deleteFile(fileId);
            const fileIndex = _state.imageFiles.findIndex(f => f.id === fileId);
            if (fileIndex > -1) {
                const [file] = _state.imageFiles.splice(fileIndex, 1);
                const stackIndex = _state.stacks[file.stack].findIndex(f => f.id === fileId);
                if (stackIndex > -1) {
                    _state.stacks[file.stack].splice(stackIndex, 1);
                }
            }
        }
        _publishUpdate();
    }

    function updateMetadata({ fileId, updates }) {
        _state.provider.updateUserMetadata(fileId, updates);
        const file = _state.imageFiles.find(f => f.id === fileId);
        if (file) {
            Object.assign(file, updates);
            if (updates.tags) {
                updates.tags.forEach(tag => _state.tags.add(tag));
            }
        }
        _publishUpdate();
    }
    
    function logout() {
        if (_state.provider) {
            _state.provider.disconnect();
        }
        if(_state.syncManager) {
            _state.syncManager.stop();
        }
        Object.assign(_state, {
            provider: null, providerType: null, currentFolder: { id: null, name: '' },
            imageFiles: [], currentStack: 'in', currentStackPosition: 0,
            stacks: { in: [], out: [], priority: [], trash: [] },
        });
        _publishUpdate();
    }

    function init() {
        pubSub.subscribe('centerStage:image-flicked', moveToStack);
        pubSub.subscribe('centerStage:stack-selected', selectStack);
        pubSub.subscribe('grid:closed-with-selection', reorderStack);
        pubSub.subscribe('grid:bulk-delete-action', (payload) => deleteFiles({ fileIds: payload.fileIds }));
        pubSub.subscribe('details:metadata-updated', (payload) => updateMetadata({ fileId: payload.fileId, updates: payload.updates }));
        pubSub.subscribe('centerStage:focus-delete-requested', (payload) => deleteFiles({ fileIds: [payload.fileId] }));
        pubSub.subscribe('app:logout', logout);
    }

    return {
        init,
        getState,
        setProvider,
        setCurrentFolder,
        setImageFiles,
        updateMetadata,
        deleteFiles
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.AppState = AppState;
