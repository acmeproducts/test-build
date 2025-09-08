class ExportSystem {
    async exportData(imagesWithMetadata) {
        if (imagesWithMetadata.length === 0) {
            Utils.showToast('No images to export', 'info', true);
            return;
        }
        
        const csvData = this.formatForCSV(imagesWithMetadata);
        this.downloadCSV(csvData);
    }
    
    formatForCSV(images) {
        const headers = [
            'Filename', 'Direct Image URL', 'Prompt', 'Negative Prompt', 'Model', 
            'Width', 'Height', 'Steps', 'Seed', 'CFG Scale', 'Size', 
            'Created Date', 'Modified Date', 'Tags', 'Notes', 
            'Quality Rating', 'Content Rating', 'Provider', 'Metadata (JSON)'
        ];
        
        const rows = images.map(image => {
            const meta = image.extractedMetadata || {};
            const dims = meta._dimensions || {};
            return [
                image.name || '',
                this.getDirectImageURL(image),
                this.extractMetadataValue(meta, ['prompt', 'Prompt', 'parameters']),
                this.extractMetadataValue(meta, ['negative_prompt', 'Negative Prompt']),
                this.extractMetadataValue(meta, ['model', 'Model']),
                dims.width || '',
                dims.height || '',
                this.extractMetadataValue(meta, ['steps', 'Steps']),
                this.extractMetadataValue(meta, ['seed', 'Seed']),
                this.extractMetadataValue(meta, ['cfg_scale', 'CFG Scale']),
                Utils.formatFileSize(image.size || 0),
                image.createdTime ? new Date(image.createdTime).toISOString() : '',
                image.modifiedTime ? new Date(image.modifiedTime).toISOString() : '',
                (image.tags || []).join('; '),
                image.notes || '',
                image.qualityRating || 0,
                image.contentRating || 0,
                state.providerType || 'unknown',
                JSON.stringify(meta)
            ];
        });
        
        return [headers, ...rows];
    }

    extractMetadataValue(metadata, keys) {
        for (const key of keys) {
            if (metadata[key]) {
                if (key === 'parameters') {
                    const promptMatch = metadata[key].match(/^(.*?)(Negative prompt:|$)/);
                    if (promptMatch && promptMatch[1]) return promptMatch[1].trim();
                }
                return metadata[key];
            }
        }
        return '';
    }
    
    getDirectImageURL(image) {
        if (state.providerType === 'googledrive') {
            return `https://drive.google.com/uc?id=${image.id}&export=view`;
        } else if (state.providerType === 'onedrive') {
            return image.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${image.id}/content`;
        }
        return '';
    }
    
    downloadCSV(data) {
        const folderName = state.currentFolder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const stackName = state.grid.stack;
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `orbital8_${folderName}_${stackName}_${date}.csv`;

        const csvContent = data.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
}
