class HapticFeedbackManager {
    constructor() {
        this.isEnabled = localStorage.getItem('orbital8_haptic_enabled') !== 'false';
        this.isSupported = 'vibrate' in navigator;
        
        const checkbox = document.getElementById('haptic-enabled');
        if (checkbox) checkbox.checked = this.isEnabled;
    }
    
    setEnabled(enabled) {
        this.isEnabled = enabled;
        localStorage.setItem('orbital8_haptic_enabled', enabled);
    }
    
    triggerFeedback(type) {
        if (!this.isEnabled || !this.isSupported) return;
        
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
}