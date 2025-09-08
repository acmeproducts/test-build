
(function() {
    // This is the App Orchestrator
    document.addEventListener('DOMContentLoaded', () => {
        // Handle OAuth callback for Google Drive first
        if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');
            if (window.opener) {
                if (error) {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: error }, window.location.origin);
                } else if (code) {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', code: code }, window.location.origin);
                }
                window.close();
                return; // Stop app initialization on callback
            }
        }
        
        // 1. Instantiate Core Modules
        const pubSub = window.AppModules.PubSub();
        const appState = window.AppModules.AppState(pubSub);
        const utils = window.AppModules.Utils(pubSub);

        // Make state globally accessible for providers (a temporary necessity until providers are fully refactored)
        window.AppModules.appState = appState;

        // 2. Instantiate Services
        const haptic = window.AppModules.HapticFeedbackManager(pubSub);
        const visualCues = window.AppModules.VisualCueManager();
        const fileCache = window.AppModules.FileCache();
        // ... instantiate other services

        // 3. Instantiate Views
        const setupView = window.AppModules.SetupView(pubSub, utils);
        const centerStageView = window.AppModules.CenterStageView(pubSub, utils, appState);
        const gridView = window.AppModules.GridView(pubSub, utils, appState);
        const detailsView = window.AppModules.DetailsView(pubSub, utils, appState);
        const actionView = window.AppModules.ActionView(pubSub, utils);

        // 4. Initialize everything
        async function initApp() {
            await fileCache.init();
            appState.init();
            haptic.init();
            visualCues.init();
            setupView.init();
            centerStageView.init();
            gridView.init();
            detailsView.init();
            actionView.init();
            
            setupView.showScreen('provider');
        }

        // 5. Wire up the application using PubSub (Orchestration)
        pubSub.subscribe('setup:provider-selected', async (payload) => {
            const ProviderClass = payload.providerType === 'googledrive' 
                ? window.AppModules.GoogleDriveProvider 
                : window.AppModules.OneDriveProvider;
            
            const provider = new ProviderClass(appState);
            appState.setProvider(provider);

            if (provider.isAuthenticated) {
                // Already authenticated, go to folders
                setupView.showScreen(payload.providerType === 'googledrive' ? 'gdriveFolders' : 'onedriveFolders');
                const folders = await provider.getFolders();
                pubSub.publish('app:render-folders', { folders, providerType: provider.name });
            } else {
                setupView.showScreen(payload.providerType === 'googledrive' ? 'gdriveAuth' : 'onedriveAuth');
            }
        });

        pubSub.subscribe('setup:auth-requested', async (payload) => {
            const state = appState.getState();
            try {
                const success = await state.provider.authenticate(payload?.clientSecret);
                if (success) {
                    setupView.showScreen(state.providerType === 'googledrive' ? 'gdriveFolders' : 'onedriveFolders');
                    const folders = await state.provider.getFolders();
                    pubSub.publish('app:render-folders', { folders, providerType: state.provider.name });
                }
            } catch(e) {
                utils.showToast(e.message, 'error', true);
            }
        });

        pubSub.subscribe('setup:folder-selected', async (payload) => {
            const state = appState.getState();
            appState.setCurrentFolder(payload.folderId, payload.folderName);
            setupView.showScreen('loading');
            
            const { files } = await state.provider.getFilesAndMetadata(payload.folderId);
            appState.setImageFiles(files); // This will trigger the first render
            
            setupView.showScreen('app');
        });

        initApp().catch(err => {
            console.error("Fatal error during app initialization:", err);
            utils.showToast("App failed to start. Please refresh.", "error", true);
        });
    });
})();
