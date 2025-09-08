
function CenterStageView(pubSub, utils, appState) {
    const el = utils.qs('#app-container');
    const imageViewport = utils.qs('#image-viewport', el);
    const centerImage = utils.qs('#center-image', el);
    // ... other element queries

    function init() {
        // Bind events, subscribe to state updates
    }

    // ... Gesture handling logic consolidated here ...
    
    // ... UI update logic consolidated here ...

    return {
        init
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.CenterStageView = CenterStageView;
