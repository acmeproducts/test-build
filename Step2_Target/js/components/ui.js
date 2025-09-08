const UI = (element, pubsub, state) => {
    const ui = {
        pills: {
            in: element.querySelector('#pill-in'),
            out: element.querySelector('#pill-out'),
            priority: element.querySelector('#pill-priority'),
            trash: element.querySelector('#pill-trash'),
        },
        centerImage: element.querySelector('#center-image'),
        filenameOverlay: element.querySelector('#filename-overlay'),
        imageCounters: {
            normal: element.querySelector('#normal-image-count'),
            focus: element.querySelector('#focus-image-count'),
        },
        focusStackName: element.querySelector('#focus-stack-name'),
        emptyState: element.querySelector('#empty-state'),
        detailsButton: element.querySelector('#details-button'),
    };
    
    const updateStackCounts = (stacks) => {
        const { STACKS, STACK_NAMES } = state.getState();
        STACKS.forEach(stack => {
            const count = stacks[stack].length;
            const pill = ui.pills[stack];
            if (pill) {
                pill.textContent = count > 999 ? ':)' : count;
                pill.classList.toggle('visible', count > 0);
            }
        });
    };
    
    const updateActivePill = (currentStack) => {
         Object.values(ui.pills).forEach(pill => pill.classList.remove('active'));
         if (ui.pills[currentStack]) ui.pills[currentStack].classList.add('active');
    };

    const updateImageDisplay = () => {
        const appState = state.getState();
        const stack = appState.stacks[appState.currentStack];
        
        if (stack.length === 0 || appState.currentStackPosition >= stack.length) {
            showEmptyState();
            return;
        }

        ui.emptyState.classList.add('hidden');
        ui.detailsButton.style.display = 'flex';

        const file = stack[appState.currentStackPosition];
        setImageSrc(file);
        
        // Update counters and filename
        const total = stack.length;
        const current = total > 0 ? appState.currentStackPosition + 1 : 0;
        const counterText = `${current} / ${total}`;
        ui.imageCounters.normal.textContent = counterText;
        ui.imageCounters.focus.textContent = counterText;
        ui.focusStackName.textContent = appState.STACK_NAMES[appState.currentStack];

        ui.filenameOverlay.textContent = `${appState.currentFolder.name} / ${file.name}`;
        ui.filenameOverlay.href = state.getState().services.exportSystem.getDirectImageURL(file);
        ui.filenameOverlay.classList.add('visible');

        // Reset transform
        applyTransform(1, {x: 0, y: 0});
    };

    const showEmptyState = () => {
        ui.centerImage.src = '';
        ui.centerImage.alt = 'No images in this stack';
        ui.filenameOverlay.classList.remove('visible');
        ui.detailsButton.style.display = 'none';
        ui.emptyState.classList.remove('hidden');
        // update counters to 0 / 0
    };

    const applyTransform = (scale, pan) => {
        const transform = `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`;
        ui.centerImage.style.transform = transform;
    };
    
    const setImageSrc = async (file) => {
        const loadId = file.id + '_' + Date.now();
        state.setCurrentImageLoadId(loadId);

        const { providerType } = state.getState();
        const preferredUrl = state.getState().services.exportSystem.getDirectImageURL(file); // simplified
        
        ui.centerImage.src = preferredUrl;
        // Error handling logic would be needed here
    };

    const bindEvents = () => {
        Object.entries(ui.pills).forEach(([stackName, pill]) => {
            pill.addEventListener('click', () => {
                const currentStack = state.getState().currentStack;
                if (currentStack === stackName) {
                    pubsub.publish('ui:openGridViewRequest', { stack: stackName });
                } else {
                    pubsub.publish('ui:stackPillClicked', { stack: stackName });
                }
            });
        });
        ui.detailsButton.addEventListener('click', () => {
            const appState = state.getState();
            const file = appState.stacks[appState.currentStack][appState.currentStackPosition];
            if(file) pubsub.publish('ui:detailsRequested', file);
        });
    };

    // Subscriptions
    pubsub.subscribe('state:stacksUpdated', ({ stacks }) => updateStackCounts(stacks));
    pubsub.subscribe('state:stackChanged', (stackName) => updateActivePill(stackName));
    pubsub.subscribe('state:imagesLoaded', () => updateImageDisplay());
    pubsub.subscribe('state:imageChanged', () => updateImageDisplay());
    pubsub.subscribe('state:transformChanged', () => {
        const { currentScale, panOffset } = state.getState();
        applyTransform(currentScale, panOffset);
    });

    bindEvents();
};
