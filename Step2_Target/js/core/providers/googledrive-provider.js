class GoogleDriveProvider extends BaseProvider {
    constructor(appState) {
        super(appState);
        this.name = 'googledrive';
        this.clientId = '567988062464-fa6c1ovesqeudqs5398vv4mbo6q068p9.apps.googleusercontent.com';
        this.redirectUri = window.location.origin + window.location.pathname;
        this.scope = 'https://www.googleapis.com/auth/drive';
        this.apiBase = 'https://www.googleapis.com/drive/v3';
        this.accessToken = null;
        this.refreshToken = null;
        this.clientSecret = null;
        this.isAuthenticated = false;
        this.onProgressCallback = null;
        this.loadStoredCredentials();
    }
    
    loadStoredCredentials() {
        this.accessToken = localStorage.getItem('google_access_token');
        this.refreshToken = localStorage.getItem('google_refresh_token');
        this.clientSecret = localStorage.getItem('google_client_secret');
        this.isAuthenticated = !!(this.accessToken && this.refreshToken && this.clientSecret);
    }
    
    storeCredentials() {
        if (this.accessToken) localStorage.setItem('google_access_token', this.accessToken);
        if (this.refreshToken) localStorage.setItem('google_refresh_token', this.refreshToken);
        if (this.clientSecret) localStorage.setItem('google_client_secret', this.clientSecret);
    }
    
    clearStoredCredentials() {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_refresh_token');
        localStorage.removeItem('google_client_secret');
    }
    
    async authenticate(clientSecret) {
        if (clientSecret) {
            this.clientSecret = clientSecret;
            this.storeCredentials();
        }
        
        if (!this.clientSecret) {
            throw new Error('Client secret is required for Google Drive authentication');
        }
        
        if (this.accessToken && this.refreshToken) {
            try {
                await this.makeApiCall('/files?pageSize=1');
                this.isAuthenticated = true;
                return true;
            } catch (error) {
                // Token invalid, continue with fresh auth
            }
        }
        
        return new Promise((resolve, reject) => {
            const authUrl = this.buildAuthUrl();
            const popup = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
            
            if (!popup) {
                reject(new Error('Popup blocked by browser'));
                return;
            }
            
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    reject(new Error('Authentication cancelled'));
                }
            }, 1000);
            
            const messageHandler = async (event) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    
                    try {
                        await this.exchangeCodeForTokens(event.data.code);
                        this.isAuthenticated = true;
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    reject(new Error(event.data.error));
                }
            };
            
            window.addEventListener('message', messageHandler);
        });
    }
    
    buildAuthUrl() {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: this.scope,
            access_type: 'offline',
            prompt: 'consent'
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    
    async exchangeCodeForTokens(code) {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri
            })
        });
        
        if (!response.ok) {
            throw new Error('Token exchange failed');
        }
        
        const tokens = await response.json();
        this.accessToken = tokens.access_token;
        if(tokens.refresh_token) this.refreshToken = tokens.refresh_token;
        this.storeCredentials();
    }
    
    async refreshAccessToken() {
        if (!this.refreshToken || !this.clientSecret) {
            throw new Error('No refresh token or client secret available');
        }
        
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh access token');
        }
        
        const tokens = await response.json();
        this.accessToken = tokens.access_token;
        this.storeCredentials();
        return this.accessToken;
    }
    
    async makeApiCall(endpoint, options = {}, isJson = true) {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }
        
        const url = endpoint.startsWith('https://') ? endpoint : `${this.apiBase}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            ...options.headers
        };
        if(isJson) {
            headers['Content-Type'] = 'application/json';
        }
        
        let response = await fetch(url, { ...options, headers });
        
        if (response.status === 401 && this.refreshToken && this.clientSecret) {
            try {
                await this.refreshAccessToken();
                headers['Authorization'] = `Bearer ${this.accessToken}`;
                response = await fetch(url, { ...options, headers });
            } catch (refreshError) {
                this.isAuthenticated = false;
                this.clearStoredCredentials();
                throw new Error('Authentication expired. Please reconnect.');
            }
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        if (isJson) {
            return await response.json();
        }
        return response;
    }
    
    async getFolders() {
        const response = await this.makeApiCall('/files?q=mimeType%3D%27application/vnd.google-apps.folder%27&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime%20desc');
        return response.files.map(folder => ({
            id: folder.id,
            name: folder.name,
            type: 'folder',
            createdTime: folder.createdTime,
            modifiedTime: folder.modifiedTime
        }));
    }
    
    async getFilesAndMetadata(folderId = 'root') {
        const allFiles = [];
        let nextPageToken = null;
        
        do {
            const query = `'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`;
            let url = `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webContentLink,appProperties,parents),nextPageToken&pageSize=100`;
            
            if (nextPageToken) {
                url += `&pageToken=${nextPageToken}`;
            }
            
            const response = await this.makeApiCall(url);
            
            const files = response.files
                .filter(file => file.mimeType && file.mimeType.startsWith('image/'))
                .map(file => ({
                    id: file.id,
                    name: file.name,
                    type: 'file',
                    mimeType: file.mimeType,
                    size: file.size ? parseInt(file.size) : 0,
                    createdTime: file.createdTime,
                    modifiedTime: file.modifiedTime,
                    thumbnailLink: file.thumbnailLink,
                    downloadUrl: file.webContentLink,
                    appProperties: file.appProperties || {},
                    parents: file.parents
                }));
            
            allFiles.push(...files);
            nextPageToken = response.nextPageToken;
            
            if (this.onProgressCallback) {
                this.onProgressCallback(allFiles.length);
            }
            
        } while (nextPageToken);
        
        return { folders: [], files: allFiles };
    }
    
    async moveFileToStack(fileId, targetStack, sequence) {
        return this.updateUserMetadata(fileId, {
            stack: targetStack,
            stackSequence: sequence
        });
    }

    async moveFileToFolder(fileId, targetFolderId) {
        const file = await this.makeApiCall(`/files/${fileId}?fields=parents`);
        const previousParents = file.parents.join(',');
        await this.makeApiCall(`/files/${fileId}?addParents=${targetFolderId}&removeParents=${previousParents}&fields=id,parents`, {
            method: 'PATCH'
        });
        await this.updateUserMetadata(fileId, { 
            stack: 'in',
            stackSequence: Date.now()
        });
        return true;
    }
    
    async updateFileProperties(fileId, properties) {
        await this.makeApiCall(`/files/${fileId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                appProperties: properties
            })
        });
        return true;
    }
    
    async deleteFile(fileId) {
        await this.makeApiCall(`/files/${fileId}`, {
            method: 'PATCH',
            body: JSON.stringify({ trashed: true })
        });
        return true;
    }
    
    async disconnect() {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.refreshToken = null;
        this.clientSecret = null;
        this.clearStoredCredentials();
    }
}