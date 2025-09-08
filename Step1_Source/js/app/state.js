const STACKS = ['in', 'out', 'priority', 'trash'];
const STACK_NAMES = { 'in': 'In', 'out': 'Out', 'priority': 'Priority', 'trash': 'Trash' };

const state = {
    provider: null, providerType: null, fileCache: null, metadataExtractor: null,
    syncManager: null, // New: Manages background sync
    visualCues: null, haptic: null, export: null, currentFolder: { id: null, name: '' },
    imageFiles: [], currentImageLoadId: null, currentStack: 'in', currentStackPosition: 0,
    isFocusMode: false, stacks: { in: [], out: [], priority: [], trash: [] },
    isDragging: false, isPinching: false, initialDistance: 0, currentScale: 1,
    maxScale: 4, minScale: 0.3, panOffset: { x: 0, y: 0 },
    grid: { stack: null, selected: [], filtered: [], isDirty: false,
        lazyLoadState: { allFiles: [], renderedCount: 0, observer: null, batchSize: 20 } },
    tags: new Set(), loadingProgress: { current: 0, total: 0 },
    folderMoveMode: { active: false, files: [] }
};
