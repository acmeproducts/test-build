
function PubSub() {
    const events = {};

    function subscribe(eventName, fn) {
        events[eventName] = events[eventName] || [];
        events[eventName].push(fn);
    }

    function unsubscribe(eventName, fn) {
        if (events[eventName]) {
            for (let i = 0; i < events[eventName].length; i++) {
                if (events[eventName][i] === fn) {
                    events[eventName].splice(i, 1);
                    break;
                }
            }
        }
    }

    function publish(eventName, data) {
        if (events[eventName]) {
            events[eventName].forEach(fn => {
                fn(data);
            });
        }
    }

    return {
        subscribe,
        unsubscribe,
        publish,
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.PubSub = PubSub;
