function VisualCueManager() {
    let currentIntensity = localStorage.getItem('orbital8_visual_intensity') || 'medium';

    function setIntensity(level) {
        currentIntensity = level;
        applyIntensity(level);
        localStorage.setItem('orbital8_visual_intensity', level);
        
        document.querySelectorAll('.intensity-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === level);
        });
    }
    
    function applyIntensity(level) {
        const settings = {
            low: { glow: 0.3, ripple: 1000, extraEffects: false },
            medium: { glow: 0.6, ripple: 1500, extraEffects: false },
            high: { glow: 1.0, ripple: 2000, extraEffects: true }
        };
        
        const config = settings[level];
        
        document.documentElement.style.setProperty('--glow', config.glow);
        document.documentElement.style.setProperty('--ripple', `${config.ripple}ms`);
        
        document.body.classList.toggle('high-intensity-mode', config.extraEffects);
    }

    function init() {
        applyIntensity(currentIntensity);
        document.querySelectorAll('.intensity-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === currentIntensity);
        });
    }

    return {
        init,
        setIntensity
    };
}