const UI = {
    updateEmptyStateButtons() {
        const stacksWithImages = STACKS.filter(stack => state.stacks[stack].length > 0);
        const hasOtherStacks = stacksWithImages.some(stack => stack !== state.currentStack);
        
        Utils.elements.selectAnotherStackBtn.style.display = hasOtherStacks ? 'block' : 'none';
        Utils.elements.selectAnotherFolderBtn.style.display = 'block';
    },
    
    acknowledgePillCounter(stackName) {
        const pill = document.getElementById(`pill-${stackName}`);
        if (pill) {
            pill.classList.remove('triple-ripple', 'glow-effect');
            pill.offsetHeight;
            pill.classList.add('triple-ripple');
            
            setTimeout(() => {
                pill.classList.add('glow-effect');
            }, 100);
            
            setTimeout(() => {
                pill.classList.remove('triple-ripple', 'glow-effect');
            }, 3000);
        }
    },
    
    switchToStack(stackName) {
        Core.displayTopImageFromStack(stackName);
    },
    
    cycleThroughProxTabs() {
        const stackOrder = ['in', 'out', 'priority', 'trash'];
        const currentIndex = stackOrder.indexOf(state.currentStack);
        const nextIndex = (currentIndex + 1) % stackOrder.length;
        const nextStack = stackOrder[nextIndex];
        
        this.switchToStack(nextStack);
    }
};
