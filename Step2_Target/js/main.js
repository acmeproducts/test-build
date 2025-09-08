(function() {
    // Handle OAuth callback for Google Drive
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
            return; // Stop app execution in the popup
        }
    }

    async function initApp() {
        // --- 1. Core Services Instantiation ---
        const pubSub = PubSub();
        const utils = Utils(pubSub);
        const appState = AppState(pubSub);
        
        const services = {
            visualCues: VisualCueManager(),
            haptic: HapticFeedbackManager(),
            fileCache: FileCache(),
            metadata: MetadataExtractor(),
            exportSystem: ExportSystem(appState, utils)
            // OneDrive sync manager is instantiated later
        };

        const providers = {
            googledrive: new GoogleDriveProvider(appState),
            onedrive: new OneDriveProvider(appState)
        };

        let syncManager = null;

        // --- 2. Views Instantiation ---
        const views = {
            setup: SetupView(pubSub, utils, providers),
            centerStage: CenterStageView(pubSub, utils),
            grid: GridView(pubSub, utils),
            details: DetailsView(pubSub, utils),
            action: ActionView(pubSub, utils)
        };
        
        Object.values(views).forEach(view => view.init());
        Object.values(services).forEach(service => service.init && service.init());

        // --- 3. App Orchestration (Wiring) ---

        // Handle provider selection
        pubSub.subscribe('setup:provider-selected', async ({ providerType }) => {
            const provider = providers[providerType];
            if (provider.isAuthenticated) {
                appState.selectFolder(null, null, providerType, provider); // Set provider in state
                pubSub.publish('app:show-screen', { screenName: `${providerType}Folders` });
            } else {
                pubSub.publish('app:show-screen', { screenName: `${providerType}Auth` });
            }
        });

        // Handle folder selection
        pubSub.subscribe('setup:folder-selected', async ({ folderId, folderName, providerType }) => {
            pubSub.publish('app:show-screen', { screenName: 'loading' });
            const provider = providers[providerType];
            appState.selectFolder(folderId, folderName, providerType, provider);

            if (providerType === 'onedrive' && !syncManager) {
                syncManager = MetadataSyncManager(provider, pubSub);
                syncManager.init();
            }

            try {
                const { files } = await provider.getFilesAndMetadata(folderId);
                appState.initializeStacks(files);
                pubSub.publish('app:show-screen', { screenName: 'app' });
            } catch (e) {
                utils.showToast(`Error loading images: ${e.message}`, 'error', true);
                pubSub.publish('app:show-screen', { screenName: `${providerType}Folders` });
            }
        });

        // Handle view opening requests from CenterStage
        pubSub.subscribe('centerStage:grid-requested', () => {
            pubSub.publish('app:open-grid-view', appState.getState());
        });

        pubSub.subscribe('centerStage:details-requested', () => {
            const state = appState.getState();
            const currentFile = state.stacks[state.currentStack][state.currentStackPosition];
            if(currentFile) {
                pubSub.publish('app:open-details-view', { file: currentFile });
            }
        });

        // Handle returning to folder selection
        pubSub.subscribe('centerStage:return-to-folders', () => {
            if (syncManager) syncManager.triggerSync();
            const { providerType } = appState.getState();
            pubSub.publish('app:show-screen', { screenName: `${providerType}Folders` });
        });
        
        // Final init
        pubSub.publish('app:show-screen', { screenName: 'provider' });
    }

    document.addEventListener('DOMContentLoaded', initApp);
})();
