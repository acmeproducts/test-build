function GridView(pubSub, utils) {
    const el = utils.qs('#grid-modal');
    const containerEl = utils.qs('#grid-container');
    // ... other element queries

    let currentStack = null;
    let selectedFileIds = [];

    function open(state) {
        currentStack = state.currentStack;
        // ... render logic based on state.stacks[currentStack]
        el.classList.remove('hidden');
    }

    function close() {
        pubSub.publish('grid:closed-with-selection', { 
            stackName: currentStack,
            selectedFileIds: selectedFileIds
        });
        el.classList.add('hidden');
        selectedFileIds = [];
        currentStack = null;
    }

    function init() {
        // ... add event listeners for all buttons
        // e.g., deleteBtn.addEventListener('click', () => {
        //     pubSub.publish('grid:bulk-delete-action', { fileIds: selectedFileIds });
        // });

        utils.qs('#close-grid', el).addEventListener('click', close);
        
        pubSub.subscribe('app:open-grid-view', open);
    }

    return { init };
}