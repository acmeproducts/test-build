function DetailsView(pubSub, utils) {
    const el = utils.qs('#details-modal');
    // ... other element queries

    function show(file) {
        // ... logic to populate all the tabs with file data
        el.classList.remove('hidden');
    }

    function hide() {
        el.classList.add('hidden');
    }

    function init() {
        // ... add all event listeners for tabs, inputs, close button, etc.
        // On input blur or change, publish an event, e.g.:
        // notesTextarea.addEventListener('blur', (e) => {
        //     pubSub.publish('details:metadata-updated', { 
        //         fileId: currentFileId, 
        //         updates: { notes: e.target.value }
        //     });
        // });

        pubSub.subscribe('app:open-details-view', ({ file }) => show(file));
    }

    return { init };
}