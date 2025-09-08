class ExportSystem {
    constructor(state) {
        this.state = state; // Dependency injection
    }

    async exportData(imagesWithMetadata) {
        if (imagesWithMetadata.length === 0) {
            // Can't use global Utils, would need to be passed in or use pubsub
            console.warn('No images to export');
            return;
        }
        
        const csvData = this.formatForCSV(imagesWithMetadata);
        this.downloadCSV(csvData);
    }
    
    formatForCSV(images) {
        const headers = ['Filename', 'Direct Image URL', /* ... other headers ... */];
        
        const rows = images.map(image => {
            const appState = this.state.getState();
            return [
                image.name || '',
                this.getDirectImageURL(image, appState.providerType),
                // ... other fields
            ];
        });
        
        return [headers, ...rows];
    }
    
    getDirectImageURL(image, providerType) {
        if (providerType === 'googledrive') {
            return `https://drive.google.com/uc?id=${image.id}&export=view`;
        } else if (providerType === 'onedrive') {
            return image.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${image.id}/content`;
        }
        return '';
    }

    downloadCSV(data) {
        const { currentFolder, grid } = this.state.getState();
        const folderName = currentFolder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const stackName = grid.stack;
        const date = new Date().toISOString().split('T')[0];
        const filename = `orbital8_${folderName}_${stackName}_${date}.csv`;

        const csvContent = data.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
