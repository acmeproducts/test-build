function FileCache() {
    let db = null;

    async function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('Orbital8Cache', 3);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'folderId' });
                    fileStore.createIndex('folderId', 'folderId', { unique: true });
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'id' });
                }
            };
        });
    }
    
    function isCacheValid(cachedTime) {
        const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        return (Date.now() - cachedTime) < CACHE_DURATION;
    }

    async function getMetadata(fileId) {
        if (!db) return null;
        try {
            const transaction = db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const result = await new Promise((resolve, reject) => {
                const request = store.get(fileId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (result) return result.metadata;
        } catch (error) {
            console.warn('Failed to get cached metadata:', error);
        }
        return null;
    }
    
    async function setMetadata(fileId, metadata) {
        if (!db) return;
        try {
            const transaction = db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            await new Promise((resolve, reject) => {
                const request = store.put({ id: fileId, metadata, cached: Date.now() });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to cache metadata:', error);
        }
    }
    
    async function clearCacheForFolder(folderId) {
        if (!db) return;
        try {
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            await new Promise((resolve, reject) => {
                const request = store.delete(folderId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }

    return {
        init,
        getMetadata,
        setMetadata,
        clearCacheForFolder
    };
}