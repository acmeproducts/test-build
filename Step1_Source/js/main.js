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
    }
}

async function initApp() {
    try {
        Utils.init();
        
        state.visualCues = new VisualCueManager();
        state.haptic = new HapticFeedbackManager();
        state.export = new ExportSystem();
        
        state.fileCache = new FileCache();
        await state.fileCache.init();
        
        state.metadataExtractor = new MetadataExtractor();
        
        Utils.showScreen('provider-screen');
        
        Events.init();
        Gestures.init();
        
        Core.updateActiveProxTab();
        
    } catch (error) {
        Utils.showToast('Failed to initialize app', 'error', true);
    }
}

document.addEventListener('DOMContentLoaded', initApp);
