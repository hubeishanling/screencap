// UI管理模块 - 负责界面交互和侧边栏调整
class UIManager {
    constructor() {
        this.isResizing = false;
        this.elements = {};
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
    }

    // 设置事件监听器
    setupEventListeners() {
        // 标签页切换
        this.elements.cropTabBtn.addEventListener('click', () => this.switchTab('crop'));
        this.elements.nodesTabBtn.addEventListener('click', () => this.switchTab('nodes'));
        this.elements.colorTabBtn.addEventListener('click', () => this.switchTab('color'));
        
        // 拖动调整大小
        this.elements.sidebarResizer.addEventListener('mousedown', this.startResize.bind(this));
    }

    // 切换标签页
    switchTab(tabName) {
        // 移除所有标签的激活状态
        this.elements.cropTabBtn.classList.remove('active');
        this.elements.nodesTabBtn.classList.remove('active');
        this.elements.colorTabBtn.classList.remove('active');
        this.elements.cropPanel.classList.remove('active');
        this.elements.nodesPanel.classList.remove('active');
        this.elements.colorPanel.classList.remove('active');
        
        // 激活选中的标签
        if (tabName === 'crop') {
            this.elements.cropTabBtn.classList.add('active');
            this.elements.cropPanel.classList.add('active');
        } else if (tabName === 'nodes') {
            this.elements.nodesTabBtn.classList.add('active');
            this.elements.nodesPanel.classList.add('active');
        } else if (tabName === 'color') {
            this.elements.colorTabBtn.classList.add('active');
            this.elements.colorPanel.classList.add('active');
        }
    }

    // 开始拖动调整大小
    startResize(e) {
        this.isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', this.doResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
        
        e.preventDefault();
    }

    // 执行调整大小
    doResize(e) {
        if (!this.isResizing) return;
        
        const windowWidth = window.innerWidth;
        const mouseX = e.clientX;
        
        const newWidth = windowWidth - mouseX - 5;
        
        const minWidth = 250;
        // 最大宽度为窗口宽度的70%，或者至少留400px给中间的截图区域
        const maxWidth = Math.max(windowWidth * 0.7, windowWidth - 400);
        const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        this.elements.sidebarRight.style.width = finalWidth + 'px';
    }

    // 停止拖动调整大小
    stopResize() {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        document.removeEventListener('mousemove', this.doResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
    }
}

// 导出单例
window.UIManager = new UIManager();
