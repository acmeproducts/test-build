class OneDriveProvider extends BaseProvider {
    constructor(appState) {
        super(appState);
        this.name = 'onedrive';
        this.apiBase = 'https://graph.microsoft.com/v1.0';
        this.isAuthenticated = false;
        this.activeAccount = null;
        this.msalInstance = null;
        this.currentParentId = null;
        this.currentParentPath = '';
        this.breadcrumb = [];
        this.onProgressCallback = null;
        
        this.metadataCache = new Map();
        this.dirtyFiles = new Set();
        
        this.initMSAL();
    }
    
    initMSAL() {
        const msalConfig = {
            auth: {
                clientId: 'b407fd45-c551-4dbb-9da5-cab3a2c5a949',
                authority: 'https://login.microsoftonline.com/common',
                redirectUri: window.location.origin + window.location.pathname
            },
            cache: { cacheLocation: 'localStorage' }
        };
        this.msalInstance = new msal.PublicClientApplication(msalConfig);
    }
    
    async authenticate() {
        try {
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                this.msalInstance.setActiveAccount(accounts[0]);
                this.activeAccount = accounts[0];
            } else {
                const loginResponse = await this.msalInstance.loginPopup({
                    scopes: ['Files.ReadWrite.AppFolder', 'User.Read', 'Files.ReadWrite']
                });
                this.activeAccount = loginResponse.account;
                this.msalInstance.setActiveAccount(this.activeAccount);
            }

            this.isAuthenticated = true;
            return true;
        } catch (error) {
            this.isAuthenticated = false;
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }
    
    async getAccessToken() {
        if (!this.activeAccount) {
            throw new Error('No active account');
        }
        
        const scopes = ['Files.ReadWrite.AppFolder', 'Files.ReadWrite'];

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes,
                account: this.activeAccount
            });
            return response.accessToken;
        } catch (silentError) {
            if (silentError instanceof msal.InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes,
                    account: this.activeAccount
                });
                return response.accessToken;
            }
            throw silentError;
        }
    }
    
    async makeApiCall(endpoint, options = {}) {
        const accessToken = await this.getAccessToken();
        const url = endpoint.startsWith('https://') ? endpoint : `${this.apiBase}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return response;
    }
    
    async getFilesAndMetadata(folderId = 'root') {
        this.metadataCache.clear();
        this.dirtyFiles.clear();

        const [imageResult, metadataFilesResult] = await Promise.all([
            this.getFilesFromFolder(folderId),
            this.getMetadataFileList()
        ]);

        if (metadataFilesResult.length > 0) {
            const metadataContentPromises = metadataFilesResult.map(metaFile => 
                this.getMetadataFileContent(metaFile.id)
            );
            const metadataContents = await Promise.all(metadataContentPromises);
            
            metadataContents.forEach(content => {
                if (content) {
                    this.metadataCache.set(content.id, content.data);
                }
            });
        }
        
        return { folders: [], files: imageResult };
    }

    async getFilesFromFolder(folderId) {
        const allFiles = [];
        let endpoint = folderId === 'root' 
            ? '/me/drive/root/children?$expand=thumbnails' 
            : `/me/drive/items/${folderId}/children?$expand=thumbnails`;
        
        let nextLink = `${this.apiBase}${endpoint}`;

        while(nextLink) {
            const response = await this.makeApiCall(nextLink.replace(this.apiBase, ''));
            const data = await response.json();

            const files = data.value
                .filter(item => item.file && item.file.mimeType && item.file.mimeType.startsWith('image/'))
                .map(item => ({
                    id: item.id,
                    name: item.name,
                    type: 'file',
                    mimeType: item.file.mimeType,
                    size: item.size || 0,
                    createdTime: item.createdDateTime,
                    modifiedTime: item.lastModifiedDateTime,
                    thumbnails: item.thumbnails && item.thumbnails.length > 0 ? {
                        large: item.thumbnails[0].large
                    } : null,
                    downloadUrl: item['@microsoft.graph.downloadUrl']
                }));
            
            allFiles.push(...files);
            nextLink = data['@odata.nextLink'];
            
            if (this.onProgressCallback) {
                this.onProgressCallback(allFiles.length);
            }
        }
        return allFiles;
    }

    async getMetadataFileList() {
        try {
            const response = await this.makeApiCall('/me/drive/special/approot/children');
            const data = await response.json();
            return data.value.filter(item => item.name.endsWith('.json'));
        } catch (error) {
            console.warn("Could not list metadata files, maybe none exist yet.", error);
            return [];
        }
    }

    async getMetadataFileContent(metadataFileId) {
        try {
            const response = await this.makeApiCall(`/me/drive/items/${metadataFileId}/content`);
            const data = await response.json();
            const imageId = metadataFileId.replace('.json', '');
            return { id: imageId, data: data };
        } catch (error) {
            console.warn(`Could not read metadata for ${metadataFileId}`, error);
            return null;
        }
    }
    
    async getDownloadsFolder() {
        try {
            const response = await this.makeApiCall('/me/drive/root/children');
            const data = await response.json();
            
            const downloadsFolder = data.value.find(item => 
                item.folder && 
                (item.name.toLowerCase() === 'downloads' || item.name.toLowerCase() === 'download')
            );
            
            if (downloadsFolder) return downloadsFolder;
            return { id: 'root', name: 'Root', folder: true };
        } catch (error) {
            console.warn('Could not find Downloads folder, using root:', error);
            return { id: 'root', name: 'Root', folder: true };
        }
    }
    
    async getFolders() {
        try {
            const downloadsFolder = await this.getDownloadsFolder();
            this.currentParentId = downloadsFolder.id;
            this.currentParentPath = downloadsFolder.name;
            this.breadcrumb = [{ id: downloadsFolder.id, name: downloadsFolder.name }];
            return await this.loadFoldersInParent(downloadsFolder.id);
        } catch (error) {
            console.warn('Failed to load initial folders:', error);
            return [];
        }
    }
    
    async loadFoldersInParent(parentId) {
        try {
            const folders = [];
            let endpoint = parentId === 'root' ? 
                '/me/drive/root/children' : 
                `/me/drive/items/${parentId}/children`;
            let nextLink = `${this.apiBase}${endpoint}`;
            
            do {
                const response = await this.makeApiCall(nextLink.replace(this.apiBase, ''));
                const data = await response.json();
                
                const folderItems = data.value
                    .filter(item => item.folder)
                    .map(folder => ({
                        id: folder.id, name: folder.name, type: 'folder',
                        createdTime: folder.createdDateTime, modifiedTime: folder.lastModifiedDateTime,
                        itemCount: folder.folder.childCount || 0,
                        hasChildren: (folder.folder.childCount || 0) > 0
                    }));
                
                folders.push(...folderItems);
                nextLink = data['@odata.nextLink'];
                
            } while (nextLink);
            
            return folders.sort((a, b) => a.name.localeCompare(b.name));
            
        } catch (error) {
            console.warn('Failed to load folders:', error);
            return [];
        }
    }
    
    async drillIntoFolder(folder) {
        try {
            this.breadcrumb.push({ id: folder.id, name: folder.name });
            this.currentParentId = folder.id;
            this.currentParentPath = this.breadcrumb.map(b => b.name).join(' / ');
            return await this.loadFoldersInParent(folder.id);
        } catch (error) {
            console.warn('Failed to drill into folder:', error);
            return [];
        }
    }
    
    async navigateToParent() {
        if (this.breadcrumb.length <= 1) return await this.getFolders();
        
        this.breadcrumb.pop();
        const parentFolder = this.breadcrumb[this.breadcrumb.length - 1];
        
        this.currentParentId = parentFolder.id;
        this.currentParentPath = this.breadcrumb.map(b => b.name).join(' / ');
        
        return await this.loadFoldersInParent(parentFolder.id);
    }
    
    getCurrentPath() { return this.currentParentPath; }
    canGoUp() { return this.breadcrumb.length > 1; }
    
    async moveFileToStack(fileId, targetStack, sequence) {
        this.updateUserMetadata(fileId, { stack: targetStack, stackSequence: sequence });
    }

    async moveFileToFolder(fileId, targetFolderId) {
        await this.makeApiCall(`/me/drive/items/${fileId}`, {
            method: 'PATCH',
            body: JSON.stringify({ parentReference: { id: targetFolderId } })
        });
        this.updateUserMetadata(fileId, { stack: 'in', stackSequence: Date.now() });
        return true;
    }
    
    async deleteFile(fileId) {
        await this.makeApiCall(`/me/drive/items/${fileId}`, { method: 'DELETE' });
        this.metadataCache.delete(fileId);
        this.dirtyFiles.add(fileId);
        return true;
    }
    
    async disconnect() {
        this.isAuthenticated = false;
        this.activeAccount = null;
        if (this.msalInstance) {
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                await this.msalInstance.logoutPopup({ account: accounts[0] });
            }
        }
    }
}