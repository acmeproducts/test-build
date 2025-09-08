// This is the main entry point of the application.
// It is wrapped in an IIFE to avoid polluting the global scope.
(function() {
    'use strict';

    // Handle OAuth callback for Google Drive early
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
            return; // Stop further execution in the popup
        }
    }

    // Main application setup
    async function main() {
        const pubsub = PubSub;
        const state = AppState(pubsub);

        // --- Initialize Services ---
        const services = {
            visualCues: new VisualCueManager(),
            haptic: new HapticFeedbackManager(),
            fileCache: new FileCache(),
            syncManager: null, // will be created on demand
        };
        await services.fileCache.init();
        
        // Services that depend on other services or state
        services.exportSystem = new ExportSystem(state);
        services.metadataExtractor = new MetadataExtractor(state, pubsub);
        
        state.setServices(services);


        // --- Initialize UI Components ---
        const components = {
            screens: Screens(pubsub),
            ui: UI(Utils.qs('#app-container'), pubsub, state),
            gestures: Gestures(Utils.qs('#image-viewport'), pubsub, state),
            details: Details(Utils.qs('#details-modal'), pubsub, state),
            grid: Grid(Utils.qs('#grid-modal'), pubsub, state),
            modal: Modal(Utils.qs('#action-modal'), pubsub, state),
        };

        // --- Business Logic & Event Subscriptions ---
        let currentProvider = null;

        // Provider Selection
        pubsub.subscribe('screens:providerSelected', async (providerType) => {
            if (providerType === 'googledrive') {
                currentProvider = new GoogleDriveProvider();
            } else {
                currentProvider = new OneDriveProvider();
            }
            
            state.setProvider(currentProvider, providerType);

            try {
                components.screens.showAuth(providerType, 'Connecting...');
                const success = await currentProvider.authenticate();
                if (success) {
                    if (providerType === 'onedrive') {
                        services.syncManager = new MetadataSyncManager(currentProvider, Utils.qs('#back-button-spinner'), Utils.showToast);
                        state.setServices({ syncManager: services.syncManager });
                    }
                    loadInitialFolders(providerType);
                }
            } catch (error) {
                components.screens.showAuth(providerType, `Auth failed: ${error.message}`, true);
            }
        });

        pubsub.subscribe('screens:backToProvider', () => {
             if (services.syncManager) {
                services.syncManager.stop();
                state.setServices({ syncManager: null });
            }
            if (currentProvider) {
                currentProvider.disconnect();
            }
            state.setProvider(null, null);
            components.screens.show('provider-screen');
        });

        const loadInitialFolders = async (providerType) => {
            components.screens.showFolders(providerType, true);
            try {
                const folders = await currentProvider.getFolders();
                components.screens.renderFolders(providerType, folders, currentProvider.getCurrentPath());
            } catch (error) {
                Utils.showToast(`Error loading folders: ${error.message}`, 'error', true);
                 components.screens.renderFolders(providerType, []);
            } finally {
                components.screens.showFolders(providerType, false);
            }
        };
        
        pubsub.subscribe('screens:folderSelected', async ({ id, name }) => {
            state.setFolder(id, name);
            components.screens.show('loading-screen');
            Utils.updateLoadingProgress(0, 0, `Loading from ${name}...`);

            try {
                currentProvider.onProgressCallback = (count) => Utils.updateLoadingProgress(count, 0, `Found ${count} images...`);
                const { files } = await currentProvider.getFilesAndMetadata(id);
                
                if (files.length === 0) {
                    Utils.showToast('No images found in this folder', 'info', true);
                    loadInitialFolders(state.getState().providerType);
                    return;
                }
                
                // Process files and update state
                const imageFiles = files.map(file => {
                    const userMetadata = currentProvider.getUserMetadata(file.id);
                    return { ...file, ...userMetadata, extractedMetadata: {}, metadataStatus: 'pending' };
                });
                state.setImages(imageFiles);

            } catch (error) {
                Utils.showToast(`Error loading images: ${error.message}`, 'error', true);
                loadInitialFolders(state.getState().providerType);
            }
        });

        pubsub.subscribe('state:imagesLoaded', () => {
            components.screens.show('app-container');
            const pngFiles = state.getState().imageFiles.filter(f => f.mimeType === 'image/png');
            if (pngFiles.length > 0) {
                services.metadataExtractor.extractInBackground(pngFiles);
            }
        });

        pubsub.subscribe('app:returnToFolders', () => {
            if (services.syncManager) services.syncManager.triggerSync();
            loadInitialFolders(state.getState().providerType);
        });

        // --- App Initialization ---
        components.screens.show('provider-screen');
    }

    // Wait for the DOM to be fully loaded before starting the app
    document.addEventListener('DOMContentLoaded', main);
})();
