// New: Manages background sync for OneDrive using a Web Worker
class MetadataSyncManager {
    constructor(provider) {
        this.provider = provider;
        this.worker = null;
        this.isSyncing = false;
        this.tokenRequestPending = false;
        this.initWorker();
        this.addEventListeners();
    }

    initWorker() {
        // The entire worker logic is defined here as a string and created as a Blob URL.
        // This keeps the application as a single, self-contained HTML file.
        const workerCode = `
            let accessToken = null;
            let apiBase = 'https://graph.microsoft.com/v1.0';

            // Main message handler for the worker
            self.onmessage = (e) => {
                const { command, payload } = e.data;
                if (command === 'SYNC') {
                    accessToken = payload.accessToken;
                    syncFiles(payload.dirtyFiles, payload.metadata);
                } else if (command === 'NEW_TOKEN') {
                    accessToken = payload.accessToken;
                    // The main thread has sent a new token, so we can resume.
                    self.postMessage({ status: 'RESUME_SYNC' });
                }
            };

            async function syncFiles(dirtyFiles, metadata) {
                self.postMessage({ status: 'SYNC_START' });
                let failedFiles = [];

                for (const fileId of dirtyFiles) {
                    const fileMetadata = metadata[fileId];
                    try {
                        if (fileMetadata) {
                            // If metadata exists, PUT it to create/update the .json file.
                            await makeApiCall(\`/me/drive/special/approot:/\${fileId}.json:/content\`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(fileMetadata)
                            });
                        } else {
                            // If metadata is null/undefined, it means the file was deleted.
                            // So, we delete its corresponding .json file.
                            await makeApiCall(\`/me/drive/special/approot:/\${fileId}.json\`, {
                                method: 'DELETE'
                            });
                        }
                        self.postMessage({ status: 'FILE_SUCCESS', payload: { fileId } });
                    } catch (error) {
                        if (error.message === 'TOKEN_EXPIRED') {
                            // If token expires, pause and ask the main thread for a new one.
                            self.postMessage({ status: 'TOKEN_EXPIRED' });
                            // Wait for the 'RESUME_SYNC' message before continuing.
                            await new Promise(resolve => {
                                const resumeListener = (e) => {
                                    if (e.data.status === 'RESUME_SYNC') {
                                        self.removeEventListener('message', resumeListener);
                                        resolve();
                                    }
                                };
                                self.addEventListener('message', resumeListener);
                            });
                            // Retry the failed operation with the new token.
                            // We push the fileId back to the front of the array to be re-processed.
                            dirtyFiles.unshift(fileId);
                            continue;
                        } else {
                            // For other errors (e.g., network, server error), mark as failed.
                            failedFiles.push(fileId);
                            self.postMessage({ status: 'FILE_FAILURE', payload: { fileId, error: error.message } });
                        }
                    }
                }
                self.postMessage({ status: 'SYNC_COMPLETE', payload: { failedFiles } });
            }

            // A helper function inside the worker to make API calls.
            async function makeApiCall(endpoint, options = {}) {
                if (!accessToken) throw new Error('No access token in worker');
                
                const url = \`\${apiBase}\${endpoint}\`;
                const headers = {
                    'Authorization': \`Bearer \` + accessToken,
                    ...options.headers
                };
                
                const response = await fetch(url, { ...options, headers });
                
                if (response.status === 401) {
                    throw new Error('TOKEN_EXPIRED');
                }
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\`\${response.status}: \${errorText}\`);
                }
                
                // For PUT/DELETE, we don't need to parse a JSON body.
                return response;
            }
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        // Listen for messages coming back from the worker
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    // Handles messages from the worker on the main thread
    async handleWorkerMessage(e) {
        const { status, payload } = e.data;
        switch (status) {
            case 'SYNC_START':
                this.isSyncing = true;
                Utils.elements.backButtonSpinner.style.display = 'inline-block';
                Utils.showToast('Syncing changes...', 'info');
                break;
            case 'SYNC_COMPLETE':
                this.isSyncing = false;
                Utils.elements.backButtonSpinner.style.display = 'none';
                if (payload.failedFiles.length > 0) {
                    // Add failed files back to the dirty list for the next sync attempt
                    payload.failedFiles.forEach(id => this.provider.dirtyFiles.add(id));
                    Utils.showToast(`Sync complete. ${payload.failedFiles.length} item(s) failed.`, 'error', true);
                } else {
                    Utils.showToast('All changes synced to OneDrive.', 'success');
                }
                break;
            case 'TOKEN_EXPIRED':
                if (!this.tokenRequestPending) {
                    this.tokenRequestPending = true;
                    try {
                        const newAccessToken = await this.provider.getAccessToken();
                        this.worker.postMessage({ command: 'NEW_TOKEN', payload: { accessToken: newAccessToken } });
                    } catch (error) {
                        Utils.showToast('Could not refresh session. Sync paused.', 'error', true);
                        this.isSyncing = false; // Stop sync process
                    } finally {
                        this.tokenRequestPending = false;
                    }
                }
                break;
        }
    }

    // Adds event listeners to trigger sync automatically
    addEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.triggerSync();
            }
        });
        window.addEventListener('beforeunload', (e) => {
            if (this.provider.dirtyFiles.size > 0) {
                // This is a best-effort attempt. Most modern browsers will not wait for async operations here.
                this.triggerSync();
                // A small delay to allow the worker to start
                const start = Date.now();
                while(Date.now() - start < 100) {}
            }
        });
    }

    // The main method to start the sync process
    async triggerSync() {
        if (this.isSyncing || this.provider.dirtyFiles.size === 0) {
            return;
        }

        try {
            const accessToken = await this.provider.getAccessToken();
            const dirtyFilesArray = Array.from(this.provider.dirtyFiles);
            const metadataToSend = {};
            
            dirtyFilesArray.forEach(id => {
                // We send the current state of the metadata from the cache
                metadataToSend[id] = this.provider.metadataCache.get(id);
            });
            
            this.worker.postMessage({
                command: 'SYNC',
                payload: {
                    accessToken,
                    dirtyFiles: dirtyFilesArray,
                    metadata: metadataToSend
                }
            });

            // Clear the dirty files set immediately on the main thread.
            // Failed items will be added back by the worker.
            this.provider.dirtyFiles.clear();

        } catch (error) {
            Utils.showToast('Could not start sync. Are you online?', 'error', true);
        }
    }
    
    // Clean up the worker and event listeners
    stop() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // In a real app, you'd also remove the event listeners here.
    }
}
