const Gestures = {
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    gestureStarted: false,
    lastTapTime: 0,
    edgeElements: [],

    init() {
        this.edgeElements = [Utils.elements.edgeTop, Utils.elements.edgeBottom, Utils.elements.edgeLeft, Utils.elements.edgeRight];
        this.setupEventListeners();
        this.setupPinchZoom();
        this.setupFocusMode();
    },

    setupEventListeners() {
        Utils.elements.imageViewport.addEventListener('mousedown', this.handleStart.bind(this));
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('mouseup', this.handleEnd.bind(this));
        
        Utils.elements.imageViewport.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleEnd.bind(this), { passive: false });
    },

    setupPinchZoom() {
        Utils.elements.centerImage.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        Utils.elements.centerImage.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        Utils.elements.centerImage.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        Utils.elements.centerImage.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    },

    setupFocusMode() {
        let startX = 0;
        let isSwiping = false;

        Utils.elements.imageViewport.addEventListener('touchstart', (e) => {
            if (!state.isFocusMode || e.touches.length > 1) return;
            startX = e.touches[0].clientX;
            isSwiping = true;
        });

        Utils.elements.imageViewport.addEventListener('touchend', (e) => {
            if (!isSwiping || !state.isFocusMode) return;
            isSwiping = false;
            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - startX;

            if (Math.abs(deltaX) > 50) {
                if (deltaX < 0) {
                    this.nextImage();
                } else {
                    this.prevImage();
                }
            }
        });
    },

    showEdgeGlow(direction) {
        this.edgeElements.forEach(edge => edge.classList.remove('active'));
        if (Utils.elements[`edge${direction.charAt(0).toUpperCase() + direction.slice(1)}`]) {
            Utils.elements[`edge${direction.charAt(0).toUpperCase() + direction.slice(1)}`].classList.add('active');
        }
    },
    
    hideAllEdgeGlows() {
        this.edgeElements.forEach(edge => edge.classList.remove('active'));
    },
    
    determineSwipeDirection(deltaX, deltaY) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'bottom' : 'top';
        }
    },
    
    directionToStack(direction) {
        const mapping = {
            'top': 'priority',
            'bottom': 'trash',
            'left': 'in',
            'right': 'out'
        };
        return mapping[direction];
    },
    
    async executeFlick(targetStack) {
        if (state.stacks[state.currentStack].length === 0) return;

        UI.acknowledgePillCounter(targetStack);
        
        if (state.haptic) {
            state.haptic.triggerFeedback('swipe');
        }
        
        await Core.moveToStack(targetStack);
        this.hideAllEdgeGlows();
    },
    
    handleStart(e) {
        const currentTime = Date.now();
        if (currentTime - this.lastTapTime < 300) {
            e.preventDefault();
            this.toggleFocusMode();
            this.lastTapTime = 0;
            return;
        }
        this.lastTapTime = currentTime;

        if (state.isFocusMode) return;
        if (state.stacks[state.currentStack].length === 0) return;
        if (e.touches && (e.touches.length > 1 || state.isPinching)) return;
        if (state.currentScale > 1.1) return;
        
        const point = e.touches ? e.touches[0] : e;
        
        this.startPos = { x: point.clientX, y: point.clientY };
        this.currentPos = { x: point.clientX, y: point.clientY };
        this.gestureStarted = false;
        
        state.isDragging = true;
        Utils.elements.centerImage.classList.add('dragging');
    },
    
    handleMove(e) {
        if (!state.isDragging || state.isFocusMode) return;
        if (state.imageFiles.length === 0) return;
        
        if (e.touches && e.touches.length > 1) {
            state.isDragging = false;
            Utils.elements.centerImage.classList.remove('dragging');
            this.hideAllEdgeGlows();
            return;
        }
        
        e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        
        this.currentPos = { x: point.clientX, y: point.clientY };
        
        const deltaX = this.currentPos.x - this.startPos.x;
        const deltaY = this.currentPos.y - this.startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 30) {
            this.gestureStarted = true;
            const direction = this.determineSwipeDirection(deltaX, deltaY);
            if (direction) {
                this.hideAllEdgeGlows();
                this.showEdgeGlow(direction);
            }
        } else {
            this.hideAllEdgeGlows();
        }
    },
    
    handleEnd(e) {
        if (!state.isDragging || state.isFocusMode) return;
        
        state.isDragging = false;
        Utils.elements.centerImage.classList.remove('dragging');
        
        if (!this.gestureStarted) {
            this.hideAllEdgeGlows();
            return;
        }
        
        const deltaX = this.currentPos.x - this.startPos.x;
        const deltaY = this.currentPos.y - this.startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 80) {
            const direction = this.determineSwipeDirection(deltaX, deltaY);
            const targetStack = this.directionToStack(direction);
            if (targetStack && direction) {
                this.executeFlick(targetStack);
                return;
            }
        }
        
        this.hideAllEdgeGlows();
    },

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    },
    
    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            state.isPinching = true;
            state.initialDistance = this.getDistance(e.touches[0], e.touches[1]);
            state.lastTouchPos = this.getCenter(e.touches[0], e.touches[1]);
        } else if (e.touches.length === 1 && state.currentScale > 1) {
            state.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    },
    
    handleTouchMove(e) {
        if (e.touches.length === 2 && state.isPinching) {
            e.preventDefault();
            
            const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
            const scaleFactor = currentDistance / state.initialDistance;
            
            let newScale = state.currentScale * scaleFactor;
            newScale = Math.max(state.minScale, Math.min(state.maxScale, newScale));
            
            state.currentScale = newScale;
            state.initialDistance = currentDistance;
            
            Core.applyTransform();
        } else if (e.touches.length === 1 && state.currentScale > 1) {
            e.preventDefault();
            
            const deltaX = e.touches[0].clientX - state.lastTouchPos.x;
            const deltaY = e.touches[0].clientY - state.lastTouchPos.y;
            
            state.panOffset.x += deltaX / state.currentScale;
            state.panOffset.y += deltaY / state.currentScale;
            
            state.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            
            Core.applyTransform();
        }
    },
    
    handleTouchEnd(e) {
        if (e.touches.length < 2) {
            state.isPinching = false;
        }
        
        if (state.currentScale < 1.1) {
            state.currentScale = 1;
            state.panOffset = { x: 0, y: 0 };
            Core.applyTransform();
        }
    },
    
    handleWheel(e) {
        e.preventDefault();
        
        const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
        let newScale = state.currentScale * scaleChange;
        newScale = Math.max(state.minScale, Math.min(state.maxScale, newScale));
        
        state.currentScale = newScale;
        
        if (state.currentScale <= 1.1) {
            state.currentScale = 1;
            state.panOffset = { x: 0, y: 0 };
        }
        
        Core.applyTransform();
    },

    toggleFocusMode() {
        state.isFocusMode = !state.isFocusMode;
        Utils.elements.appContainer.classList.toggle('focus-mode', state.isFocusMode);
        Core.updateImageCounters(); // Sync counters on toggle
    },
    
    async nextImage() {
        const stack = state.stacks[state.currentStack];
        if (stack.length === 0) return;

        state.currentStackPosition = (state.currentStackPosition + 1) % stack.length;
        await Core.displayCurrentImage();
    },
    
    async prevImage() {
        const stack = state.stacks[state.currentStack];
        if (stack.length === 0) return;

        state.currentStackPosition = (state.currentStackPosition - 1 + stack.length) % stack.length;
        await Core.displayCurrentImage();
    },
    
    async deleteCurrentImage() {
        const currentStackArray = state.stacks[state.currentStack];
        if (currentStackArray.length === 0) return;

        const fileToDelete = currentStackArray[state.currentStackPosition];
        
        try {
            await App.deleteFile(fileToDelete.id);
            
            const fileIndex = state.imageFiles.findIndex(f => f.id === fileToDelete.id);
            if (fileIndex > -1) state.imageFiles.splice(fileIndex, 1);
            
            currentStackArray.splice(state.currentStackPosition, 1);
            
            Core.updateStackCounts();
            
            if (currentStackArray.length === 0) {
                this.toggleFocusMode();
                Core.showEmptyState();
            } else {
                // Pointer will now reference the next image automatically
                await Core.displayCurrentImage();
            }
        } catch (error) {
            Utils.showToast(`Failed to delete ${fileToDelete.name}`, 'error', true);
        }
    }
};
