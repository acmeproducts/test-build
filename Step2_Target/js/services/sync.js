class MetadataSyncManager {
    constructor(provider, spinnerEl, toastFn) {
        this.provider = provider;
        this.worker = null;
        this.isSyncing = false;
        this.tokenRequestPending = false;
        this.spinnerEl = spinnerEl;
        this.toastFn = toastFn;
        this.initWorker();
        this.addEventListeners();
    }

    initWorker() {
        const workerCode = `
            // ... worker code from Step 1 ...
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    async handleWorkerMessage(e) {
        const { status, payload } = e.data;
        switch (status) {
            case 'SYNC_START':
                this.isSyncing = true;
                this.spinnerEl.style.display = 'inline-block';
                this.toastFn('Syncing changes...', 'info');
                break;
            case 'SYNC_COMPLETE':
                this.isSyncing = false;
                this.spinnerEl.style.display = 'none';
                if (payload.failedFiles.length > 0) {
                    payload.failedFiles.forEach(id => this.provider.dirtyFiles.add(id));
                    this.toastFn(`Sync complete. ${payload.failedFiles.length} item(s) failed.`, 'error', true);
                } else {
                    this.toastFn('All changes synced to OneDrive.', 'success');
                }
                break;
            case 'TOKEN_EXPIRED':
                // ... same as Step 1 ...
                break;
        }
    }

    addEventListeners() {
        // ... same as Step 1 ...
    }

    async triggerSync() {
        // ... same as Step 1 ...
    }
    
    stop() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
