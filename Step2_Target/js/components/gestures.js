const Gestures = (element, pubsub, state) => {
    const ui = {
        centerImage: element.querySelector('#center-image'),
        edgeGlows: {
            top: element.querySelector('#edge-top'),
            bottom: element.querySelector('#edge-bottom'),
            left: element.querySelector('#edge-left'),
            right: element.querySelector('#edge-right'),
        }
    };
    
    let startPos = { x: 0, y: 0 };
    let currentPos = { x: 0, y: 0 };
    let gestureStarted = false;
    let lastTapTime = 0;

    const handleStart = (e) => {
        const appState = state.getState();
        if (appState.isFocusMode) return;
        if (appState.stacks[appState.currentStack].length === 0) return;
        if (appState.currentScale > 1.1) return;
        
        // Double tap for focus mode
        const currentTime = Date.now();
        if (currentTime - lastTapTime < 300) {
            e.preventDefault();
            pubsub.publish('gesture:doubleTap');
            lastTapTime = 0;
            return;
        }
        lastTapTime = currentTime;

        const point = e.touches ? e.touches[0] : e;
        startPos = { x: point.clientX, y: point.clientY };
        gestureStarted = false;
        state.setDragging(true);
    };

    const handleMove = (e) => {
        if (!state.getState().isDragging) return;
        e.preventDefault();
        
        const point = e.touches ? e.touches[0] : e;
        currentPos = { x: point.clientX, y: point.clientY };
        
        const deltaX = currentPos.x - startPos.x;
        const deltaY = currentPos.y - startPos.y;
        
        if (Math.sqrt(deltaX**2 + deltaY**2) > 30) {
            gestureStarted = true;
            const direction = determineSwipeDirection(deltaX, deltaY);
            showEdgeGlow(direction);
        } else {
            hideAllEdgeGlows();
        }
    };

    const handleEnd = () => {
        if (!state.getState().isDragging) return;
        state.setDragging(false);
        hideAllEdgeGlows();
        
        if (!gestureStarted) return;
        
        const deltaX = currentPos.x - startPos.x;
        const deltaY = currentPos.y - startPos.y;
        
        if (Math.sqrt(deltaX**2 + deltaY**2) > 80) {
            const direction = determineSwipeDirection(deltaX, deltaY);
            pubsub.publish('gesture:flick', direction);
        }
    };
    
    const determineSwipeDirection = (dx, dy) => {
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'bottom' : 'top';
        }
    };

    const showEdgeGlow = (dir) => {
        Object.values(ui.edgeGlows).forEach(el => el.classList.remove('active'));
        if (ui.edgeGlows[dir]) ui.edgeGlows[dir].classList.add('active');
    };

    const hideAllEdgeGlows = () => {
        Object.values(ui.edgeGlows).forEach(el => el.classList.remove('active'));
    };

    // ... pinch and zoom handlers would go here, publishing scale/pan events ...

    element.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    element.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: false });
};
