class BaseProvider {
    constructor() {
        // This class is intended to be extended by specific provider implementations.
    }

    // This method is now a simple, synchronous cache lookup for OneDrive
    // or a direct property access for Google Drive.
    getUserMetadata(fileId, allFiles, metadataCache) {
        if (this.name === 'googledrive') {
            const file = allFiles.find(f => f.id === fileId);
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
            if (metadataCache && metadataCache.has(fileId)) {
                return metadataCache.get(fileId);
            }
            return {
                stack: 'in', tags: [], qualityRating: 0, contentRating: 0, notes: '', stackSequence: 0
            };
        }
    }

    // This method now updates the in-memory cache and marks the file as dirty for OneDrive.
    updateUserMetadata(fileId, updates, allFiles) {
        if (this.name === 'googledrive') {
            const file = allFiles.find(f => f.id === fileId);
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
            const currentMetadata = this.getUserMetadata(fileId, null, this.metadataCache);
            const newMetadata = { ...currentMetadata, ...updates };
            this.metadataCache.set(fileId, newMetadata);
            this.dirtyFiles.add(fileId);
            
            const file = allFiles.find(f => f.id === fileId);
            if(file) Object.assign(file, updates);
        }
    }
}