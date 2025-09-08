function CenterStageView(pubSub, utils) {
    const el = utils.qs('#app-container');
    const imageEl = utils.qs('#center-image');
    // ... other element queries

    function render(state) {
        // ... logic to update image, pills, filename based on state
    }

    function init() {
        // ... add all event listeners for gestures, buttons, etc.
        // On interaction, publish events, e.g.:
        // imageEl.addEventListener('doubleclick', () => pubSub.publish('centerStage:focus-toggled'));
        
        pubSub.subscribe('state:updated', render);
    }
    
    return { init };
}