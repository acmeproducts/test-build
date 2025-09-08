const Grid = (element, pubsub, state) => {
    // ... UI element selectors ...

    const open = (stack) => {
        // ... logic to open and render grid for a stack
        element.classList.remove('hidden');
    };
    
    const close = () => {
        // ... logic to reorder stack if dirty, then hide
        element.classList.add('hidden');
        pubsub.publish('grid:closed');
    };

    const bindEvents = () => {
        // ... bind close, select all, deselect all, slider, search, and bulk action buttons
        // e.g., element.querySelector('#close-grid').addEventListener('click', close);
        
        // Instead of calling Modal.setupMoveAction(), publish an event
        element.querySelector('#move-selected').addEventListener('click', () => {
            pubsub.publish('grid:moveActionRequested', { selectedFiles: Array.from(state.getState().grid.selected) });
        });
    };

    // Subscriptions
    pubsub.subscribe('ui:openGridViewRequest', ({ stack }) => open(stack));
    pubsub.subscribe('state:stacksUpdated', () => {
        // if grid is open and stack has changed, re-render
    });

    bindEvents();
};
