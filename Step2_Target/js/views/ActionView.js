function ActionView(pubSub, utils) {
    const el = utils.qs('#action-modal');
    const titleEl = utils.qs('#action-title', el);
    const contentEl = utils.qs('#action-content', el);
    const confirmBtn = utils.qs('#action-confirm', el);
    const cancelBtn = utils.qs('#action-cancel', el);

    let currentAction = null;
    let currentPayload = null;
    let suggestions = [];

    function render(type, payload) {
        currentAction = type;
        currentPayload = payload;

        let title, content = '', confirmText = 'Confirm', confirmClass = 'btn-primary';

        switch (type) {
            case 'grid:bulk-delete-action':
                title = 'Confirm Delete';
                const count = payload.fileIds.length;
                const providerName = payload.providerType === 'googledrive' ? 'Google Drive' : 'OneDrive';
                content = `<p style="color: #4b5563; margin-bottom: 16px;">Are you sure you want to move ${count} image(s) to your ${providerName} trash? This can be recovered from the provider's website.</p>`;
                confirmText = `Move to ${providerName} Trash`;
                confirmClass = 'btn-danger';
                break;
            
            case 'grid:bulk-tag-action':
                 title = 'Add Tags';
                 suggestions = [...payload.allTags];
                 content = `
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Enter tags (comma separated)</label>
                        <input type="text" id="modal-tag-input" class="tag-input" placeholder="nature, landscape, vacation">
                    </div>
                    <div id="modal-tag-suggestions" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                        ${suggestions.map(tag => 
                            `<button class="tag-suggestion" data-tag="${tag}" style="background-color: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: background-color 0.2s; border: none;">${tag}</button>`
                        ).join('')}
                    </div>
                `;
                confirmText = 'Apply';
                break;

            case 'grid:bulk-move-action':
                title = 'Move to Stack';
                const STACKS = ['in', 'out', 'priority', 'trash'];
                const STACK_NAMES = { 'in': 'In', 'out': 'Out', 'priority': 'Priority', 'trash': 'Trash' };
                content = `<div id="move-options-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    ${STACKS.map(stack => 
                        `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background-color 0.2s;">${STACK_NAMES[stack]}</button>`
                    ).join('')}
                </div>`;
                confirmText = 'Cancel';
                confirmClass = 'btn-secondary';
                break;

            case 'grid:bulk-export-action':
                title = 'Export to Spreadsheet';
                content = `
                    <p style="color: #4b5563; margin-bottom: 16px;">
                        This will start the new Live Export process for ${payload.fileIds.length} selected image(s).
                    </p>
                    <p style="color: #4b5563; margin-bottom: 16px;">
                        It will fetch fresh data directly from the cloud to ensure 100% accuracy.
                    </p>
                `;
                confirmText = 'Begin Export';
                break;
            
            case 'grid:bulk-folder-move-action':
                 title = 'Move to Different Folder';
                 content = `
                    <p style="color: #4b5563; margin-bottom: 16px;">
                        This will move ${payload.fileIds.length} image(s) to a different folder. 
                        The images will be removed from this stack and their metadata will move with them.
                    </p>`;
                confirmText = 'Choose Destination Folder';
                break;
            
            case 'centerStage:focus-stack-switch-requested':
                 title = 'Switch Stack';
                 const { availableStacks, stackCounts } = payload;
                 const STACK_NAMES_FS = { 'in': 'In', 'out': 'Out', 'priority': 'Priority', 'trash': 'Trash' };
                 content = `<div id="move-options-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">`;
                 if(availableStacks.length > 0) {
                     content += availableStacks.map(stack => 
                        `<button class="move-option" data-stack="${stack}" style="width: 100%; text-align: left; padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background-color 0.2s;">${STACK_NAMES_FS[stack]} (${stackCounts[stack]})</button>`
                     ).join('');
                 } else {
                     content += `<p style="color: #4b5563; text-align: center;">No other stacks have images.</p>`;
                 }
                 content += `</div>`;
                 confirmText = 'Cancel';
                 confirmClass = 'btn-secondary';
                 break;
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
        if (currentAction === 'grid:bulk-tag-action') {
            const tagInput = utils.qs('#modal-tag-input', contentEl);
            if (!tagInput.value.trim()) return;
            const tagsToAdd = tagInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            currentPayload.tags = tagsToAdd;
        }

        pubSub.publish(`action:confirmed:${currentAction}`, { action: currentAction, payload: currentPayload });
        hide();
    }
    
    function handleContentClick(e) {
        if(e.target.classList.contains('tag-suggestion')) {
            const input = utils.qs('#modal-tag-input', contentEl);
            input.value += (input.value ? ', ' : '') + e.target.dataset.tag;
        }
        if(e.target.classList.contains('move-option')) {
            const targetStack = e.target.dataset.stack;
            if (currentAction === 'grid:bulk-move-action') {
                 pubSub.publish(`action:confirmed:${currentAction}`, { action: currentAction, payload: { ...currentPayload, targetStack } });
            } else if (currentAction === 'centerStage:focus-stack-switch-requested') {
                 pubSub.publish('centerStage:stack-selected', { stackName: targetStack });
            }
            hide();
        }
    }

    function init() {
        cancelBtn.addEventListener('click', hide);
        confirmBtn.addEventListener('click', handleConfirm);
        contentEl.addEventListener('click', handleContentClick);
        
        const actions = [
            'grid:bulk-delete-action', 'grid:bulk-tag-action', 'grid:bulk-move-action',
            'grid:bulk-export-action', 'grid:bulk-folder-move-action',
            'centerStage:focus-stack-switch-requested'
        ];
        actions.forEach(action => {
            pubSub.subscribe(action, (payload) => render(action, payload));
        });
    }

    return { init };
}
