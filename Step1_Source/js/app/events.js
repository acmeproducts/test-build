const Events = {
    init() {
        this.setupProviderSelection();
        this.setupSettings();
        this.setupGoogleDriveAuth();
        this.setupOneDriveAuth();
        this.setupFolderManagement();
        this.setupLoadingScreen();
        this.setupDetailsModal();
        this.setupFocusMode();
        this.setupTabs();
        this.setupCopyButtons();
        this.setupEmptyState();
        this.setupPillCounters();
        this.setupGridControls();
        this.setupSearchFunctionality();
        this.setupActionButtons();
        this.setupKeyboardNavigation();
    },

    setupProviderSelection() {
        Utils.elements.googleDriveBtn.addEventListener('click', () => App.selectGoogleDrive());
        Utils.elements.onedriveBtn.addEventListener('click', () => App.selectOneDrive());
    },

    setupSettings() {
        document.querySelectorAll('.intensity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.visualCues.setIntensity(btn.dataset.level);
            });
        });
        
        document.getElementById('haptic-enabled').addEventListener('change', (e) => {
            state.haptic.setEnabled(e.target.checked);
        });
    },

    setupGoogleDriveAuth() {
        Utils.elements.gdriveAuthButton.addEventListener('click', async () => {
            const clientSecret = Utils.elements.gdriveClientSecret.value.trim();
            
            if (!clientSecret) {
                Utils.elements.gdriveAuthStatus.textContent = 'Please enter client secret';
                Utils.elements.gdriveAuthStatus.className = 'status error';
                return;
            }
            
            Utils.elements.gdriveAuthButton.disabled = true;
            Utils.elements.gdriveAuthButton.textContent = 'Connecting...';
            Utils.elements.gdriveAuthStatus.textContent = 'Connecting to Google Drive...';
            Utils.elements.gdriveAuthStatus.className = 'status info';
            
            try {
                const provider = new GoogleDriveProvider();
                const success = await provider.authenticate(clientSecret);
                
                if (success) {
                    state.provider = provider;
                    Utils.elements.gdriveAuthStatus.textContent = '✅ Connected to Google Drive!';
                    Utils.elements.gdriveAuthStatus.className = 'status success';
                    Utils.elements.gdriveClientSecret.value = '';
                    
                    setTimeout(() => {
                        Utils.showScreen('gdrive-folder-screen');
                        GoogleDriveFolders.load();
                    }, 1000);
                }
            } catch (error) {
                Utils.elements.gdriveAuthStatus.textContent = `Authentication failed: ${error.message}`;
                Utils.elements.gdriveAuthStatus.className = 'status error';
            } finally {
                Utils.elements.gdriveAuthButton.disabled = false;
                Utils.elements.gdriveAuthButton.textContent = 'Connect Drive';
            }
        });
        
        Utils.elements.gdriveBackButton.addEventListener('click', () => App.backToProviderSelection());
    },

    setupOneDriveAuth() {
        Utils.elements.onedriveAuthButton.addEventListener('click', async () => {
            Utils.elements.onedriveAuthButton.disabled = true;
            Utils.elements.onedriveAuthButton.textContent = 'Connecting...';
            Utils.elements.onedriveAuthStatus.textContent = 'Connecting to OneDrive...';
            Utils.elements.onedriveAuthStatus.className = 'status info';
            
            try {
                const provider = new OneDriveProvider();
                const success = await provider.authenticate();
                
                if (success) {
                    state.provider = provider;
                    state.syncManager = new MetadataSyncManager(provider);
                    Utils.elements.onedriveAuthStatus.textContent = '✅ Connected to OneDrive!';
                    Utils.elements.onedriveAuthStatus.className = 'status success';
                    
                    setTimeout(() => {
                        Utils.showScreen('onedrive-folder-screen');
                        OneDriveFolders.load();
                    }, 1000);
                }
            } catch (error) {
                Utils.elements.onedriveAuthStatus.textContent = `Authentication failed: ${error.message}`;
                Utils.elements.onedriveAuthStatus.className = 'status error';
            } finally {
                Utils.elements.onedriveAuthButton.disabled = false;
                Utils.elements.onedriveAuthButton.textContent = 'Connect OneDrive';
            }
        });
        
        Utils.elements.onedriveBackButton.addEventListener('click', () => App.backToProviderSelection());
    },

    setupFolderManagement() {
        Utils.elements.gdriveRefreshFolders.addEventListener('click', () => GoogleDriveFolders.load());
        Utils.elements.gdriveBackToProvider.addEventListener('click', () => App.backToProviderSelection());
        Utils.elements.gdriveLogout.addEventListener('click', () => {
            state.provider.disconnect();
            App.backToProviderSelection();
        });
        
        Utils.elements.onedriveRefreshFolders.addEventListener('click', () => OneDriveFolders.load());
        Utils.elements.onedriveBackToProvider.addEventListener('click', () => App.backToProviderSelection());
        Utils.elements.onedriveLogout.addEventListener('click', () => {
            state.provider.disconnect();
            App.backToProviderSelection();
        });
    },

    setupLoadingScreen() {
        Utils.elements.cancelLoading.addEventListener('click', () => {
            if (state.metadataExtractor) {
                state.metadataExtractor.abort();
            }
            App.returnToFolderSelection();
            Utils.showToast('Loading cancelled', 'info', true);
        });
    },

    setupDetailsModal() {
        Utils.elements.detailsButton.addEventListener('click', () => {
            if (state.stacks[state.currentStack].length > 0) {
                Details.show();
            }
        });
        Utils.elements.detailsClose.addEventListener('click', () => Details.hide());
    },

    setupFocusMode() {
        Utils.elements.focusStackName.addEventListener('click', () => Modal.setupFocusStackSwitch());
        Utils.elements.focusDeleteBtn.addEventListener('click', () => Gestures.deleteCurrentImage());
    },

    setupTabs() {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => Details.switchTab(btn.dataset.tab));
        });
    },

    setupCopyButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-metadata')) {
                const value = e.target.dataset.value;
                const button = e.target;
                
                button.classList.add('copied');
                const originalText = button.textContent;
                button.textContent = '✓';
                
                Details.copyToClipboard(value);
                
                setTimeout(() => {
                    button.classList.remove('copied');
                    button.textContent = originalText;
                }, 1000);
            }
        });
    },

    setupEmptyState() {
        Utils.elements.selectAnotherStackBtn.addEventListener('click', () => {
            const stacksWithImages = STACKS.filter(stack => state.stacks[stack].length > 0);
            if (stacksWithImages.length > 0) {
                const nextStack = stacksWithImages.find(stack => stack !== state.currentStack) || stacksWithImages[0];
                UI.switchToStack(nextStack);
            } else {
                Utils.elements.selectAnotherStackBtn.style.display = 'none';
                Utils.elements.selectAnotherFolderBtn.style.display = 'block';
            }
        });
        
        Utils.elements.selectAnotherFolderBtn.addEventListener('click', () => {
            App.returnToFolderSelection();
        });
    },

    setupPillCounters() {
        STACKS.forEach(stackName => {
            const pill = document.getElementById(`pill-${stackName}`);
            if (pill) {
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    if (state.haptic) {
                        state.haptic.triggerFeedback('pillTap');
                    }
                    
                    if (state.currentStack === stackName) {
                        Grid.open(stackName);
                    } else {
                        UI.switchToStack(stackName);
                    }
                    UI.acknowledgePillCounter(stackName);
                });
            }
        });
    },

    setupGridControls() {
        Utils.elements.closeGrid.addEventListener('click', () => Grid.close());
        Utils.elements.selectAllBtn.addEventListener('click', () => Grid.selectAll());
        Utils.elements.deselectAllBtn.addEventListener('click', () => Grid.deselectAll());
        
        Utils.elements.gridSize.addEventListener('input', () => {
            const value = Utils.elements.gridSize.value;
            Utils.elements.gridSizeValue.textContent = value;
            Utils.elements.gridContainer.style.gridTemplateColumns = `repeat(${value}, 1fr)`;
        });
    },

    setupSearchFunctionality() {
        Utils.elements.omniSearch.addEventListener('input', () => Grid.performSearch());
        Utils.elements.clearSearchBtn.addEventListener('click', () => Grid.resetSearch());
    },

    setupActionButtons() {
        Utils.elements.moveSelected.addEventListener('click', () => Modal.setupMoveAction());
        Utils.elements.tagSelected.addEventListener('click', () => Modal.setupTagAction());
        Utils.elements.deleteSelected.addEventListener('click', () => Modal.setupDeleteAction());
        Utils.elements.exportSelected.addEventListener('click', () => Modal.setupExportAction());
        Utils.elements.folderSelected.addEventListener('click', () => Modal.setupFolderMoveAction());
        
        Utils.elements.actionCancel.addEventListener('click', () => Modal.hide());
        Utils.elements.actionConfirm.addEventListener('click', () => {
            if (Modal.currentAction === 'move') {
                // Handled by move option buttons
            } else if (Modal.currentAction === 'tag') {
                Modal.executeTag();
            } else if (Modal.currentAction === 'delete') {
                Modal.executeDelete();
            } else if (Modal.currentAction === 'export') {
                Modal.executeExport();
            } else if (Modal.currentAction === 'folder-move') {
                Modal.executeFolderMove();
            }
        });
    },

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (Utils.elements.appContainer.classList.contains('hidden')) return;
            
            if (!Utils.elements.detailsModal.classList.contains('hidden')) {
                if (e.key === 'Escape') Details.hide();
                return;
            }
            
            if (!Utils.elements.gridModal.classList.contains('hidden')) {
                if (e.key === 'Escape') Grid.close();
                return;
            }
            
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            if (state.isFocusMode) {
                if (e.key === 'ArrowRight') Gestures.nextImage();
                if (e.key === 'ArrowLeft') Gestures.prevImage();
                if (e.key === 'Escape') Gestures.toggleFocusMode();
                return;
            }
            
            const keyMap = {
                'ArrowUp': 'priority',
                'ArrowDown': 'trash',
                'ArrowLeft': 'in',
                'ArrowRight': 'out'
            };
            
            if (keyMap[e.key]) {
                e.preventDefault();
                const targetStack = keyMap[e.key];
                if (state.stacks[state.currentStack].length > 0) {
                    UI.acknowledgePillCounter(targetStack);
                    Core.moveToStack(targetStack);
                }
                return;
            }
            
            switch (e.key) {
                case 'Tab':
                    e.preventDefault();
                    UI.cycleThroughProxTabs();
                    break;
                case 'Escape':
                    App.returnToFolderSelection();
                    break;
            }
        });
    }
};
