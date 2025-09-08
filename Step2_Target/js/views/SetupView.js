
function SetupView(pubSub, utils) {
    const screens = {
        provider: utils.qs('#provider-screen'),
        gdriveAuth: utils.qs('#gdrive-auth-screen'),
        onedriveAuth: utils.qs('#onedrive-auth-screen'),
        gdriveFolders: utils.qs('#gdrive-folder-screen'),
        onedriveFolders: utils.qs('#onedrive-folder-screen'),
        loading: utils.qs('#loading-screen'),
        app: utils.qs('#app-container')
    };

    // --- Element Caching ---
    // Provider Screen
    const gdriveBtn = utils.qs('#google-drive-btn', screens.provider);
    const onedriveBtn = utils.qs('#onedrive-btn', screens.provider);
    
    // GDrive Auth
    const gdriveAuthBtn = utils.qs('#gdrive-auth-button', screens.gdriveAuth);
    const gdriveBackBtn = utils.qs('#gdrive-back-button', screens.gdriveAuth);
    const gdriveSecretInput = utils.qs('#gdrive-client-secret', screens.gdriveAuth);

    // OneDrive Auth
    const onedriveAuthBtn = utils.qs('#onedrive-auth-button', screens.onedriveAuth);
    const onedriveBackBtn = utils.qs('#onedrive-back-button', screens.onedriveAuth);

    // Folder Screens
    const gdriveFolderList = utils.qs('#gdrive-folder-list', screens.gdriveFolders);
    const onedriveFolderList = utils.qs('#onedrive-folder-list', screens.onedriveFolders);
    // ... and so on for all elements used in this view

    function init() {
        bindEvents();
        subscribeToEvents();
    }
    
    function bindEvents() {
        gdriveBtn.addEventListener('click', () => pubSub.publish('setup:provider-selected', { providerType: 'googledrive' }));
        onedriveBtn.addEventListener('click', () => pubSub.publish('setup:provider-selected', { providerType: 'onedrive' }));
        
        gdriveAuthBtn.addEventListener('click', () => {
            pubSub.publish('setup:auth-requested', { clientSecret: gdriveSecretInput.value.trim() })
        });
        onedriveAuthBtn.addEventListener('click', () => pubSub.publish('setup:auth-requested'));
        
        gdriveBackBtn.addEventListener('click', () => showScreen('provider'));
        onedriveBackBtn.addEventListener('click', () => showScreen('provider'));

        // ... Bind all other folder screen buttons ...
    }

    function subscribeToEvents() {
        pubSub.subscribe('app:show-screen', (payload) => showScreen(payload.screenName));
        pubSub.subscribe('app:render-folders', (payload) => renderFolders(payload.folders, payload.providerType));
        pubSub.subscribe('app:update-loading', (payload) => updateLoading(payload));
    }
    
    function showScreen(screenName) {
        Object.keys(screens).forEach(key => {
            screens[key].classList.toggle('hidden', key !== screenName);
        });
    }

    function renderFolders(folders, providerType) {
        const listEl = providerType === 'googledrive' ? gdriveFolderList : onedriveFolderList;
        listEl.innerHTML = ''; // Clear previous
        
        if (folders.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">No folders found.</div>`;
            return;
        }

        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-item';
            div.innerHTML = `...`; // Folder item HTML template
            div.addEventListener('click', () => {
                pubSub.publish('setup:folder-selected', { folderId: folder.id, folderName: folder.name });
            });
            listEl.appendChild(div);
        });
    }

    function updateLoading({ current, total, message }) {
        const loadingCounter = utils.qs('#loading-counter', screens.loading);
        const loadingMessage = utils.qs('#loading-message', screens.loading);
        const loadingProgressBar = utils.qs('#loading-progress-bar', screens.loading);

        loadingCounter.textContent = current;
        loadingMessage.textContent = message;
        if (total > 0) {
            loadingProgressBar.style.width = `${(current / total) * 100}%`;
        }
    }

    return {
        init,
        showScreen
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.SetupView = SetupView;
