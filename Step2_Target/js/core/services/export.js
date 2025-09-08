
function ExportSystem(appState) {
    
    function exportData(imagesWithMetadata) {
        if (imagesWithMetadata.length === 0) {
            return;
        }
        const csvData = formatForCSV(imagesWithMetadata);
        downloadCSV(csvData);
    }
    
    function formatForCSV(images) {
        const state = appState.getState();
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
                getDirectImageURL(image, state.providerType),
                extractMetadataValue(meta, ['prompt', 'Prompt', 'parameters']),
                extractMetadataValue(meta, ['negative_prompt', 'Negative Prompt']),
                extractMetadataValue(meta, ['model', 'Model']),
                dims.width || '',
                dims.height || '',
                extractMetadataValue(meta, ['steps', 'Steps']),
                extractMetadataValue(meta, ['seed', 'Seed']),
                extractMetadataValue(meta, ['cfg_scale', 'CFG Scale']),
                state.utils.formatFileSize(image.size || 0),
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

    function extractMetadataValue(metadata, keys) {
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
    
    function getDirectImageURL(image, providerType) {
        if (providerType === 'googledrive') {
            return `https://drive.google.com/uc?id=${image.id}&export=view`;
        } else if (providerType === 'onedrive') {
            return image.downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${image.id}/content`;
        }
        return '';
    }
    
    function downloadCSV(data) {
        const state = appState.getState();
        const folderName = state.currentFolder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const stackName = state.grid.stack;
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
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    return {
        exportData
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.ExportSystem = ExportSystem;
