class FileCache {
    constructor() {
        this.db = null;
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('Orbital8Cache', 3);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
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
    
    async getCachedFiles(folderId) {
        if (!this.db) return null;
        try {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const result = await new Promise((resolve, reject) => {
                const request = store.get(folderId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (result && this.isCacheValid(result.cached)) {
                return result.files;
            }
        } catch (error) {
            console.warn('Failed to get cached files:', error);
        }
        return null;
    }
    
    async setCachedFiles(folderId, files) {
        if (!this.db) return;
        try {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            await new Promise((resolve, reject) => {
                const request = store.put({
                    folderId,
                    files,
                    cached: Date.now()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to cache files:', error);
        }
    }
    
    async getMetadata(fileId) {
        if (!this.db) return null;
        try {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const result = await new Promise((resolve, reject) => {
                const request = store.get(fileId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (result) {
                return result.metadata;
            }

        } catch (error) {
            console.warn('Failed to get cached metadata:', error);
        }
        return null;
    }
    
    async setMetadata(fileId, metadata) {
        if (!this.db) return;
        try {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            await new Promise((resolve, reject) => {
                const request = store.put({ 
                    id: fileId, 
                    metadata,
                    cached: Date.now()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to cache metadata:', error);
        }
    }
    
    isCacheValid(cachedTime) {
        const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        return (Date.now() - cachedTime) < CACHE_DURATION;
    }
    
    async clearCacheForFolder(folderId) {
        if (!this.db) return;
        try {
            const transaction = this.db.transaction(['files'], 'readwrite');
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
}