function ActionView(pubSub, utils) {
    const el = utils.qs('#action-modal');
    const titleEl = utils.qs('#action-title', el);
    const contentEl = utils.qs('#action-content', el);
    const confirmBtn = utils.qs('#action-confirm', el);
    const cancelBtn = utils.qs('#action-cancel', el);

    let currentAction = null;
    let currentPayload = null;

    function render(type, payload) {
        currentAction = type;
        currentPayload = payload;

        let title, content, confirmText, confirmClass;

        switch (type) {
            case 'grid:bulk-delete-action':
                title = 'Confirm Delete';
                const count = payload.fileIds.length;
                content = `<p style="color: #4b5563; margin-bottom: 16px;">Are you sure you want to move ${count} image(s) to the trash?</p>`;
                confirmText = 'Move to Trash';
                confirmClass = 'btn-danger';
                break;
            
            case 'grid:bulk-move-action':
                title = 'Move to Stack';
                const STACKS = ['in', 'out', 'priority', 'trash'];
                const STACK_NAMES = { 'in': 'In', 'out': 'Out', 'priority': 'Priority', 'trash': 'Trash' };
                content = `<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    ${STACKS.map(stack => 
                        `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background-color 0.2s;">${STACK_NAMES[stack]}</button>`
                    ).join('')}
                </div>`;
                confirmText = 'Cancel';
                confirmClass = 'btn-secondary';
                break;

            // Add other cases here
        }

        titleEl.textContent = title;
        contentEl.innerHTML = content;
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmClass}`;
        el.classList.remove('hidden');
    }

    function hide() {
        el.classList.add('hidden');
        currentAction = null;
        currentPayload = null;
    }

    function handleConfirm() {
        pubSub.publish(`action:confirmed`, { action: currentAction, payload: currentPayload });
        hide();
    }

    function init() {
        cancelBtn.addEventListener('click', hide);
        confirmBtn.addEventListener('click', handleConfirm);

        pubSub.subscribe('grid:bulk-delete-action', (payload) => render('grid:bulk-delete-action', payload));
        pubSub.subscribe('grid:bulk-move-action', (payload) => render('grid:bulk-move-action', payload));
    }

    return { init };
}