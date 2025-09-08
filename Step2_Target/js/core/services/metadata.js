
function MetadataExtractor() {
    let abortController = null;
    
    function abort() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    }
    
    async function extract(buffer) {
        if (!buffer) return {};
        
        const metadata = {};
        const view = new DataView(buffer);
        
        if (buffer.byteLength < 8) return {};
        
        let pos = 8;
        
        try {
            while (pos < buffer.byteLength - 12) {
                const chunkLength = view.getUint32(pos, false);
                pos += 4;
                
                let chunkType = '';
                for (let i = 0; i < 4; i++) {
                    chunkType += String.fromCharCode(view.getUint8(pos + i));
                }
                pos += 4;
                
                if (chunkType === 'tEXt') {
                    let keyword = '';
                    let value = '';
                    let nullFound = false;
                    
                    for (let i = 0; i < chunkLength; i++) {
                        const byte = view.getUint8(pos + i);
                        
                        if (!nullFound) {
                            if (byte === 0) {
                                nullFound = true;
                            } else {
                                keyword += String.fromCharCode(byte);
                            }
                        } else {
                            value += String.fromCharCode(byte);
                        }
                    }
                    
                    metadata[keyword] = value;
                } else if (chunkType === 'IHDR') {
                    const width = view.getUint32(pos, false);
                    const height = view.getUint32(pos + 4, false);
                    metadata._dimensions = { width, height };
                } else if (chunkType === 'IEND') {
                    break;
                }
                
                pos += chunkLength + 4;
                
                if (chunkLength > buffer.byteLength || pos > buffer.byteLength) {
                    break;
                }
            }
        } catch (error) {
            // Ignore errors and return what we have
        }
        
        return metadata;
    }
    
    async function fetchMetadata(file, provider, isForExport = false) {
        if (file.mimeType !== 'image/png') {
            return { error: 'Not a PNG file' };
        }
        
        try {
            abortController = new AbortController();
            let response;

            if (provider.name === 'googledrive') {
                response = await provider.makeApiCall(`/files/${file.id}?alt=media`, {
                    headers: { 'Range': 'bytes=0-65535' },
                    signal: abortController.signal
                }, false);
            } else { // onedrive
                const accessToken = await provider.getAccessToken();
                response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`, {
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`,
                        'Range': 'bytes=0-65535'
                    },
                    signal: abortController.signal
                });
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            return await extract(buffer);
        } catch (error) {
            if (error.name === 'AbortError') {
                return { error: 'Operation cancelled' };
            }
            return { error: error.message };
        }
    }

    return {
        abort,
        fetchMetadata
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.MetadataExtractor = MetadataExtractor;
