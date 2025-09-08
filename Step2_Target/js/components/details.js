const Details = (element, pubsub, state) => {
    const ui = {
        closeBtn: element.querySelector('#details-close'),
        tabButtons: element.querySelectorAll('.tab-button'),
        tabContents: element.querySelectorAll('.tab-content'),
        filename: element.querySelector('#detail-filename'),
        filenameLink: element.querySelector('#detail-filename-link'),
        date: element.querySelector('#detail-date'),
        size: element.querySelector('#detail-size'),
        tagsContainer: element.querySelector('#detail-tags'),
        notes: element.querySelector('#detail-notes'),
        qualityRating: element.querySelector('#quality-rating'),
        contentRating: element.querySelector('#content-rating'),
        metadataTable: element.querySelector('#metadata-table'),
    };

    let currentFile = null;

    const show = (file) => {
        currentFile = file;
        render();
        element.classList.remove('hidden');
    };

    const hide = () => {
        element.classList.add('hidden');
        currentFile = null;
    };
    
    const render = () => {
        if (!currentFile) return;
        renderInfo();
        renderTags();
        renderNotes();
        renderMetadata();
        switchTab('info');
    };

    const switchTab = (tabName) => {
        ui.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        ui.tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${tabName}`));
    };
    
    // Render functions for each tab
    const renderInfo = () => { /* ... implementation from baseline ... */ };
    const renderTags = () => { /* ... implementation from baseline ... */ };
    const renderNotes = () => { /* ... implementation from baseline ... */ };
    const renderMetadata = () => { /* ... implementation from baseline ... */ };

    const bindEvents = () => {
        ui.closeBtn.addEventListener('click', hide);
        ui.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
        
        // Event delegation for dynamically created elements
        ui.tagsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-remove')) {
                const tagToRemove = e.target.dataset.tag;
                // ... logic to remove tag
                pubsub.publish('details:tagRemoved', { fileId: currentFile.id, tag: tagToRemove });
            }
            if (e.target.classList.contains('add-tag-btn')) {
                // ... logic to show input
            }
        });
        
        // ... other event bindings
    };

    // Subscriptions
    pubsub.subscribe('ui:detailsRequested', (file) => show(file));
    pubsub.subscribe('state:fileMetadataLoaded', ({ fileId }) => {
        if (currentFile && currentFile.id === fileId) {
            renderMetadata();
        }
    });

    bindEvents();

    return {}; // No public methods needed, everything is event-driven
};
