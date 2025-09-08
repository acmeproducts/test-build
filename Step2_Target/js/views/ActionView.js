
function ActionView(pubSub, utils) {
    let currentAction = null;
    let originalPayload = null;
    
    const el = utils.qs('#action-modal');
    const titleEl = utils.qs('#action-title', el);
    const contentEl = utils.qs('#action-content', el);
    const cancelBtn = utils.qs('#action-cancel', el);
    const confirmBtn = utils.qs('#action-confirm', el);

    function init() {
        bindEvents();
        subscribeToEvents();
    }

    function bindEvents() {
        cancelBtn.addEventListener('click', hide);
        confirmBtn.addEventListener('click', handleConfirm);
    }

    function subscribeToEvents() {
        pubSub.subscribe('grid:bulk-tag-action', () => setupTagAction());
        pubSub.subscribe('grid:bulk-move-action', () => setupMoveAction());
        pubSub.subscribe('grid:bulk-delete-action', (payload) => setupDeleteAction(payload));
        pubSub.subscribe('grid:bulk-export-action', (payload) => setupExportAction(payload));
        pubSub.subscribe('grid:bulk-folder-move-action', (payload) => setupFolderMoveAction(payload));
        pubSub.subscribe('centerStage:focus-stack-switch-requested', (payload) => setupFocusStackSwitch(payload));
    }

    function show(action, options, payload) {
        currentAction = action;
        originalPayload = payload;
        const { title, content, confirmText = 'Confirm', confirmClass = 'btn-primary' } = options;
        
        titleEl.textContent = title || 'Action';
        contentEl.innerHTML = content || '';
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmClass}`;
        confirmBtn.disabled = false;
        cancelBtn.textContent = "Cancel";

        el.classList.remove('hidden');
    }

    function hide() {
        el.classList.add('hidden');
        currentAction = null;
        originalPayload = null;
    }

    function handleConfirm() {
        pubSub.publish(`action:confirmed:${currentAction}`, originalPayload);
    }

    // Action Setups
    function setupMoveAction() {
        const state = window.AppModules.appState.getState();
        const content = `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                ${state.STACKS.map(stack => 
                    `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: #f3f4f6; cursor: pointer; transition: background-color 0.2s;">${state.STACK_NAMES[stack]}</button>`
                ).join('')}
            </div>`;
        show('move', { title: 'Move to Stack', content, confirmText: 'Cancel' });
        
        utils.qsa('.move-option', contentEl).forEach(option => {
            option.addEventListener('click', () => {
                pubSub.publish('grid:bulk-move-requested', { targetStack: option.dataset.stack });
                hide();
            });
        });
    }

    function setupTagAction() {
        // Implementation for tag action
    }

    function setupDeleteAction({ fileIds, providerType }) {
        const message = `Are you sure you want to move ${fileIds.length} image(s) to your ${providerType} trash?`;
        show('delete', {
            title: 'Confirm Delete',
            content: `<p style="color: #4b5563;">${message}</p>`,
            confirmText: `Move to Trash`,
            confirmClass: 'btn-danger'
        }, { fileIds });
    }
    
    function setupExportAction({ fileIds }) {
         const content = `<p style="color: #4b5563;">This will start a live export for ${fileIds.length} image(s).</p>`;
        show('export', { title: 'Export to Spreadsheet', content, confirmText: 'Begin Export' }, { fileIds });
    }
    
    function setupFolderMoveAction({ fileIds }) {
         const content = `<p style="color: #4b5563;">This will move ${fileIds.length} image(s) to a different folder.</p>`;
        show('folder-move', { title: 'Move to Different Folder', content, confirmText: 'Choose Folder' }, { fileIds });
    }

    function setupFocusStackSwitch({ availableStacks }) {
        // Implementation for focus stack switch
    }
    
    return {
        init
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.ActionView = ActionView;
