
function MetadataSyncManager(provider, pubSub) {
    let worker = null;
    let isSyncing = false;
    let tokenRequestPending = false;

    function init() {
        initWorker();
        addEventListeners();
    }

    function initWorker() {
        const workerCode = `
            let accessToken = null;
            let apiBase = 'https://graph.microsoft.com/v1.0';

            self.onmessage = (e) => {
                const { command, payload } = e.data;
                if (command === 'SYNC') {
                    accessToken = payload.accessToken;
                    syncFiles(payload.dirtyFiles, payload.metadata);
                } else if (command === 'NEW_TOKEN') {
                    accessToken = payload.accessToken;
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
                            await makeApiCall(\`/me/drive/special/approot:/\${fileId}.json:/content\`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(fileMetadata)
                            });
                        } else {
                            await makeApiCall(\`/me/drive/special/approot:/\${fileId}.json\`, {
                                method: 'DELETE'
                            });
                        }
                        self.postMessage({ status: 'FILE_SUCCESS', payload: { fileId } });
                    } catch (error) {
                        if (error.message === 'TOKEN_EXPIRED') {
                            self.postMessage({ status: 'TOKEN_EXPIRED' });
                            await new Promise(resolve => {
                                const resumeListener = (e) => {
                                    if (e.data.status === 'RESUME_SYNC') {
                                        self.removeEventListener('message', resumeListener);
                                        resolve();
                                    }
                                };
                                self.addEventListener('message', resumeListener);
                            });
                            dirtyFiles.unshift(fileId);
                            continue;
                        } else {
                            failedFiles.push(fileId);
                            self.postMessage({ status: 'FILE_FAILURE', payload: { fileId, error: error.message } });
                        }
                    }
                }
                self.postMessage({ status: 'SYNC_COMPLETE', payload: { failedFiles } });
            }

            async function makeApiCall(endpoint, options = {}) {
                if (!accessToken) throw new Error('No access token in worker');
                const url = \`\${apiBase}\${endpoint}\`;
                const headers = { 'Authorization': \`Bearer \` + accessToken, ...options.headers };
                const response = await fetch(url, { ...options, headers });
                if (response.status === 401) throw new Error('TOKEN_EXPIRED');
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\`\${response.status}: \${errorText}\`);
                }
                return response;
            }
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = handleWorkerMessage;
    }

    async function handleWorkerMessage(e) {
        const { status, payload } = e.data;
        switch (status) {
            case 'SYNC_START':
                isSyncing = true;
                pubSub.publish('sync:start');
                break;
            case 'SYNC_COMPLETE':
                isSyncing = false;
                if (payload.failedFiles.length > 0) {
                    payload.failedFiles.forEach(id => provider.dirtyFiles.add(id));
                }
                pubSub.publish('sync:complete', { failures: payload.failedFiles.length });
                break;
            case 'TOKEN_EXPIRED':
                if (!tokenRequestPending) {
                    tokenRequestPending = true;
                    try {
                        const newAccessToken = await provider.getAccessToken();
                        worker.postMessage({ command: 'NEW_TOKEN', payload: { accessToken: newAccessToken } });
                    } catch (error) {
                        pubSub.publish('sync:error', { message: 'Could not refresh session. Sync paused.' });
                        isSyncing = false;
                    } finally {
                        tokenRequestPending = false;
                    }
                }
                break;
        }
    }

    function addEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                triggerSync();
            }
        });
        window.addEventListener('beforeunload', () => {
            if (provider.dirtyFiles.size > 0) {
                triggerSync();
            }
        });
    }

    async function triggerSync() {
        if (isSyncing || provider.dirtyFiles.size === 0) return;

        try {
            const accessToken = await provider.getAccessToken();
            const dirtyFilesArray = Array.from(provider.dirtyFiles);
            const metadataToSend = {};
            
            dirtyFilesArray.forEach(id => {
                metadataToSend[id] = provider.metadataCache.get(id);
            });
            
            worker.postMessage({
                command: 'SYNC',
                payload: { accessToken, dirtyFiles: dirtyFilesArray, metadata: metadataToSend }
            });

            provider.dirtyFiles.clear();
        } catch (error) {
            pubSub.publish('sync:error', { message: 'Could not start sync. Are you online?' });
        }
    }
    
    function stop() {
        if (worker) {
            worker.terminate();
            worker = null;
        }
    }

    return {
        init,
        triggerSync,
        stop
    };
}

// For debug-only, multi-file environment
window.AppModules = window.AppModules || {};
window.AppModules.MetadataSyncManager = MetadataSyncManager;
