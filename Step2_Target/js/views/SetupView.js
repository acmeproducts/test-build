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

    function showScreen(screenName) {
        for (const key in screens) {
            screens[key].classList.toggle('hidden', key !== screenName);
        }
    }

    // ... more logic for rendering folders, handling auth, etc.

    function init() {
        // ... add event listeners for all setup buttons
        // e.g., gdriveBtn.addEventListener('click', () => {
        //    pubSub.publish('setup:provider-selected', { providerType: 'googledrive' });
        // });
        
        pubSub.subscribe('app:show-screen', ({ screenName }) => showScreen(screenName));
    }

    return { init };
}