class BaseProvider {
    constructor() {
        // Common properties for all providers can go here.
    }

    // New: This method is now a simple, synchronous cache lookup.
    getUserMetadata(fileId) {
        if (this.name === 'googledrive') {
            // Google Drive logic remains, as it uses appProperties directly on the file object
            const file = state.imageFiles.find(f => f.id === fileId);
            const providerData = file ? file.appProperties : {};
            return {
                stack: providerData?.slideboxStack || 'in',
                tags: providerData?.slideboxTags ? providerData.slideboxTags.split(',').map(t => t.trim()) : [],
                qualityRating: parseInt(providerData?.qualityRating) || 0,
                contentRating: parseInt(providerData?.contentRating) || 0,
                notes: providerData?.notes || '',
                stackSequence: parseInt(providerData?.stackSequence) || 0
            };
        } else { // OneDrive
            // If metadata exists in the cache, return it.
            if (this.metadataCache.has(fileId)) {
                return this.metadataCache.get(fileId);
            }
            // Otherwise, return a default object for new/untagged files.
            return {
                stack: 'in', tags: [], qualityRating: 0, contentRating: 0, notes: '', stackSequence: 0
            };
        }
    }

    // New: This method now updates the in-memory cache and marks the file as dirty.
    updateUserMetadata(fileId, updates) {
        if (this.name === 'googledrive') {
            // Google Drive still writes directly. This could be refactored to a worker too,
            // but for now, we follow the plan which focuses on OneDrive performance.
            const file = state.imageFiles.find(f => f.id === fileId);
            if(file) Object.assign(file, updates);

            const properties = {};
            if (updates.stack) properties.slideboxStack = updates.stack;
            if (updates.tags) properties.slideboxTags = updates.tags.join(',');
            if (updates.qualityRating !== undefined) properties.qualityRating = updates.qualityRating.toString();
            if (updates.contentRating !== undefined) properties.contentRating = updates.contentRating.toString();
            if (updates.notes !== undefined) properties.notes = updates.notes;
            if (updates.stackSequence !== undefined) properties.stackSequence = updates.stackSequence.toString();
            
            return this.updateFileProperties(fileId, properties);

        } else { // OneDrive
            const currentMetadata = this.getUserMetadata(fileId);
            const newMetadata = { ...currentMetadata, ...updates };
            this.metadataCache.set(fileId, newMetadata);
            this.dirtyFiles.add(fileId); // Mark as dirty for the sync worker.
            
            // Update the main file object in memory as well
            const file = state.imageFiles.find(f => f.id === fileId);
            if(file) Object.assign(file, updates);
        }
    }
}
