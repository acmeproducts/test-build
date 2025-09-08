
function HapticFeedbackManager(pubSub) {
    let isEnabled = localStorage.getItem('orbital8_haptic_enabled') !== 'false';
    const isSupported = 'vibrate' in navigator;
    
    function setEnabled(enabled) {
        isEnabled = enabled;
        localStorage.setItem('orbital8_haptic_enabled', enabled);
    }
    
    function triggerFeedback({ type }) {
        if (!isEnabled || !isSupported) return;
        
        const patterns = {
            swipe: [20, 40],
            pillTap: [35],
            buttonPress: [25],
            error: [100, 50, 100]
        };
        
        const pattern = patterns[type];
        if (pattern && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    function init() {
        const checkbox = document.getElementById('haptic-enabled');
        if (checkbox) {
            checkbox.checked = isEnabled;
            checkbox.addEventListener('change', (e) => setEnabled(e.target.checked));
        }
        pubSub.subscribe('haptic:trigger', triggerFeedback);
    }

    return {
        init
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.HapticFeedbackManager = HapticFeedbackManager;
