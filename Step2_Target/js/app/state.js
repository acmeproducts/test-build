const AppState = (pubsub) => {
    const state = {
        // Core state
        provider: null,
        providerType: null,
        currentFolder: { id: null, name: '' },
        imageFiles: [],
        currentStack: 'in',
        currentStackPosition: 0,
        isFocusMode: false,
        stacks: { in: [], out: [], priority: [], trash: [] },
        tags: new Set(),

        // UI state
        isDragging: false,
        isPinching: false,
        initialDistance: 0,
        currentScale: 1,
        panOffset: { x: 0, y: 0 },
        currentImageLoadId: null,

        // Component-specific state
        grid: {
            stack: null,
            selected: new Set(),
            filtered: [],
            isDirty: false,
            lazyLoadState: { allFiles: [], renderedCount: 0, observer: null, batchSize: 20 }
        },
        folderMoveMode: { active: false, files: [] },
        
        // Injected services
        services: {}
    };

    const CONSTANTS = {
        STACKS: ['in', 'out', 'priority', 'trash'],
        STACK_NAMES: { 'in': 'In', 'out': 'Out', 'priority': 'Priority', 'trash': 'Trash' },
        MAX_SCALE: 4,
        MIN_SCALE: 0.3,
    };

    const sortFiles = (files) => {
        return [...files].sort((a, b) => {
            const seqA = a.stackSequence || 0;
            const seqB = b.stackSequence || 0;
            if (seqB !== seqA) return seqB - seqA;
            return (a.name || '').localeCompare(b.name || '');
        });
    };

    const actions = {
        getState: () => ({ ...state, ...CONSTANTS }), // Expose a read-only copy
        
        setProvider(provider, type) {
            state.provider = provider;
            state.providerType = type;
        },
        
        setServices(services) {
            state.services = { ...state.services, ...services };
        },

        setFolder(id, name) {
            state.currentFolder = { id, name };
        },

        setImages(files) {
            state.imageFiles = files;
            this.initializeStacks();
            state.currentStack = 'in';
            state.currentStackPosition = 0;
            // Collect all unique tags from the loaded images
            const allTags = new Set();
            files.forEach(file => {
                if (file.tags && Array.isArray(file.tags)) {
                    file.tags.forEach(tag => allTags.add(tag));
                }
            });
            state.tags = allTags;

            pubsub.publish('state:imagesLoaded', { files, stacks: state.stacks });
        },

        initializeStacks() {
            CONSTANTS.STACKS.forEach(stack => state.stacks[stack] = []);
            state.imageFiles.forEach(file => {
                const stack = file.stack || 'in';
                if (CONSTANTS.STACKS.includes(stack)) {
                    state.stacks[stack].push(file);
                } else {
                    state.stacks.in.push(file);
                }
            });
            CONSTANTS.STACKS.forEach(stack => state.stacks[stack] = sortFiles(state.stacks[stack]));
            pubsub.publish('state:stacksUpdated', { stacks: state.stacks });
        },
        
        moveCurrentImageToStack(targetStack) {
            const stackArray = state.stacks[state.currentStack];
            if (!stackArray || stackArray.length === 0) return;
            
            const image = stackArray[state.currentStackPosition];
            if (!image) return;

            const originalStack = image.stack || 'in';
            const newSequence = Date.now();
            
            // Optimistic UI update
            const [item] = stackArray.splice(state.currentStackPosition, 1);
            item.stack = targetStack;
            item.stackSequence = newSequence;

            if (targetStack !== originalStack) {
                state.stacks[targetStack].unshift(item);
                state.stacks[targetStack] = sortFiles(state.stacks[targetStack]);
            } else {
                 // If moving to the same stack, put it at the end
                 stackArray.push(item);
            }
            
            // Persist the change
            state.provider.updateUserMetadata(image.id, { stack: targetStack, stackSequence: newSequence });
            
            if (state.currentStackPosition >= stackArray.length && stackArray.length > 0) {
                state.currentStackPosition = stackArray.length - 1;
            }

            pubsub.publish('state:imageMoved', { image, from: originalStack, to: targetStack });
            pubsub.publish('state:stacksUpdated', { stacks: state.stacks });
            pubsub.publish('state:imageChanged');
        },

        updateUserMetadata(fileId, updates) {
            const file = state.imageFiles.find(f => f.id === fileId);
            if (!file) return;
            
            Object.assign(file, updates);
            state.provider.updateUserMetadata(fileId, updates);
            
            if (updates.tags) {
                updates.tags.forEach(tag => state.tags.add(tag));
                pubsub.publish('state:tagsUpdated', { tags: Array.from(state.tags) });
            }
        },

        setCurrentStack(stackName) {
            if (state.currentStack === stackName) return;
            state.currentStack = stackName;
            state.currentStackPosition = 0;
            pubsub.publish('state:stackChanged', stackName);
            pubsub.publish('state:imageChanged');
        },

        navigateImage(direction) {
            const stack = state.stacks[state.currentStack];
            if (stack.length === 0) return;
            const newPosition = (state.currentStackPosition + direction + stack.length) % stack.length;
            state.currentStackPosition = newPosition;
            pubsub.publish('state:imageChanged');
        },

        setFocusMode(isFocus) {
            state.isFocusMode = isFocus;
            pubsub.publish('state:focusModeChanged', state.isFocusMode);
        },
        
        // This is just one of many other state actions to be added...
    };

    return actions;
};