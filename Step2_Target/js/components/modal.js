const Modal = (element, pubsub, state) => {
    const ui = {
        title: element.querySelector('#action-title'),
        content: element.querySelector('#action-content'),
        confirmBtn: element.querySelector('#action-confirm'),
        cancelBtn: element.querySelector('#action-cancel'),
    };
    let currentAction = null;
    let currentPayload = null;

    const show = (type, { title, content, confirmText, confirmClass }, payload) => {
        currentAction = type;
        currentPayload = payload;
        ui.title.textContent = title;
        ui.content.innerHTML = content;
        ui.confirmBtn.textContent = confirmText || 'Confirm';
        ui.confirmBtn.className = `btn ${confirmClass || 'btn-primary'}`;
        element.classList.remove('hidden');
    };

    const hide = () => {
        element.classList.add('hidden');
        currentAction = null;
        currentPayload = null;
    };

    const onConfirm = () => {
        pubsub.publish(`modal:confirmed:${currentAction}`, currentPayload);
        hide();
    };

    const onCancel = () => {
        pubsub.publish(`modal:cancelled:${currentAction}`, currentPayload);
        hide();
    };
    
    // Subscriptions to requests from other components
    pubsub.subscribe('grid:moveActionRequested', (payload) => {
        const { STACK_NAMES } = state.getState();
        const content = Object.entries(STACK_NAMES).map(([key, name]) => 
            `<button class="move-option" data-stack="${key}">${name}</button>`
        ).join('');
        show('move', { title: 'Move to Stack', content }, payload);
    });
    
    // ... other subscriptions for tag, delete, export modals ...

    ui.confirmBtn.addEventListener('click', onConfirm);
    ui.cancelBtn.addEventListener('click', onCancel);
};
