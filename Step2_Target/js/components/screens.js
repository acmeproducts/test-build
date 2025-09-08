const Screens = (pubsub) => {
    const screens = {
        provider: document.getElementById('provider-screen'),
        gdriveAuth: document.getElementById('gdrive-auth-screen'),
        onedriveAuth: document.getElementById('onedrive-auth-screen'),
        gdriveFolders: document.getElementById('gdrive-folder-screen'),
        onedriveFolders: document.getElementById('onedrive-folder-screen'),
        loading: document.getElementById('loading-screen'),
        app: document.getElementById('app-container'),
    };

    const show = (screenId) => {
        Object.entries(screens).forEach(([key, el]) => {
            el.classList.toggle('hidden', el.id !== screenId);
        });
    };

    const bindProviderScreenEvents = () => {
        screens.provider.querySelector('#google-drive-btn').addEventListener('click', () => {
            pubsub.publish('screens:providerSelected', 'googledrive');
        });
        screens.provider.querySelector('#onedrive-btn').addEventListener('click', () => {
            pubsub.publish('screens:providerSelected', 'onedrive');
        });
    };

    const showAuth = (providerType, message, isError = false) => {
        const screenId = providerType === 'googledrive' ? 'gdrive-auth-screen' : 'onedrive-auth-screen';
        show(screenId);
        const statusEl = screens[providerType + 'Auth'].querySelector('.status');
        statusEl.textContent = message;
        statusEl.className = `status ${isError ? 'error' : 'info'}`;
    };
    
    const showFolders = (providerType, isLoading) => {
        const screenId = providerType === 'googledrive' ? 'gdrive-folder-screen' : 'onedrive-folder-screen';
        show(screenId);
        // Maybe show/hide a spinner
    };
    
    const renderFolders = (providerType, folders, path = '') => {
        const folderListEl = screens[providerType + 'Folders'].querySelector('.folder-list');
        folderListEl.innerHTML = ''; // Clear previous
        if (folders.length === 0) {
            folderListEl.innerHTML = '<div>No folders found.</div>';
            return;
        }
        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-item';
            div.innerHTML = `<div class="folder-name">${folder.name}</div>`;
            div.addEventListener('click', () => {
                pubsub.publish('screens:folderSelected', { id: folder.id, name: folder.name });
            });
            folderListEl.appendChild(div);
        });
    };

    bindProviderScreenEvents();
    // ... bind other screen events ...
    
    return { show, showAuth, showFolders, renderFolders };
};
