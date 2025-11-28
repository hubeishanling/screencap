// 渲染进程脚本 - ADB截图工具（模块化版本）

// 全局状态（简化）
window.currentImagePath = null;
window.currentImageData = null;

// DOM元素集合
let elements = {};

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
    initializeApp();
    setupEventListeners();
    await window.HistoryManager.loadHistoryFromDisk();
    window.DeviceManager.refreshDevices();
});

// 初始化应用
function initializeApp() {
    // 缓存所有DOM元素
    elements = {
        // 设备相关
        deviceSelect: document.getElementById('device-select'),
        refreshDevicesBtn: document.getElementById('refresh-devices-btn'),
        captureBtn: document.getElementById('capture-btn'),
        dumpUIBtn: document.getElementById('dump-ui-btn'),
        
        // 历史记录
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        historyList: document.getElementById('history-list'),
        
        // 状态消息
        statusMessage: document.getElementById('status-message'),
        
        // 画布相关
        imageCanvas: document.getElementById('image-canvas'),
        imageContainer: document.getElementById('image-container'),
        selectionOverlay: document.getElementById('selection-overlay'),
        selectionBox: document.getElementById('selection-box'),
        bottomControls: document.querySelector('.bottom-controls'),
        
        // 缩放控制
        zoomInBtn: document.getElementById('zoom-in-btn'),
        zoomOutBtn: document.getElementById('zoom-out-btn'),
        zoomResetBtn: document.getElementById('zoom-reset-btn'),
        zoomFitBtn: document.getElementById('zoom-fit-btn'),
        zoomLevel: document.getElementById('zoom-level'),
        
        // 裁剪预览
        cropCanvas: document.getElementById('crop-canvas'),
        cropPreviewContainer: document.getElementById('crop-preview-container'),
        cropWidth: document.getElementById('crop-width'),
        cropHeight: document.getElementById('crop-height'),
        cropX: document.getElementById('crop-x'),
        cropY: document.getElementById('crop-y'),
        saveCropBtn: document.getElementById('save-crop-btn'),
        saveOriginalBtn: document.getElementById('save-original-btn'),
        resetSelectionBtn: document.getElementById('reset-selection-btn'),
        
        // 标签页
        cropTabBtn: document.getElementById('crop-tab-btn'),
        nodesTabBtn: document.getElementById('nodes-tab-btn'),
        cropPanel: document.getElementById('crop-panel'),
        nodesPanel: document.getElementById('nodes-panel'),
        
        // 节点树
        nodesTree: document.getElementById('nodes-tree'),
        nodeDetails: document.getElementById('node-details'),
        nodeSearch: document.getElementById('node-search'),
        expandAllBtn: document.getElementById('expand-all-btn'),
        collapseAllBtn: document.getElementById('collapse-all-btn'),
        nodeHighlightOverlay: document.getElementById('node-highlight-overlay'),
        nodeHighlightBox: document.getElementById('node-highlight-box'),
        
        // 侧边栏调整
        sidebarResizer: document.getElementById('sidebar-resizer'),
        sidebarRight: document.getElementById('sidebar-right')
    };
    
    // 初始化各个模块
    window.Utils.initStatusElement(elements.statusMessage);
    window.DeviceManager.initElements(elements);
    window.HistoryManager.initElements(elements);
    window.ScreenshotManager.initElements(elements);
    window.CanvasManager.initElements(elements);
    window.NodeManager.initElements(elements);
    window.UIManager.initElements(elements);
}

// 设置事件监听器
function setupEventListeners() {
    // 设备管理
    elements.refreshDevicesBtn.addEventListener('click', () => window.DeviceManager.refreshDevices());
    elements.deviceSelect.addEventListener('change', () => window.DeviceManager.onDeviceChange());
    
    // 截图相关
    elements.captureBtn.addEventListener('click', () => window.ScreenshotManager.captureScreen());
    elements.saveCropBtn.addEventListener('click', () => window.ScreenshotManager.saveCroppedImage());
    elements.saveOriginalBtn.addEventListener('click', () => window.ScreenshotManager.saveOriginalImage());
    
    // 节点抓取
    elements.dumpUIBtn.addEventListener('click', () => window.NodeManager.dumpUIHierarchy());
    
    // 历史记录
    elements.clearHistoryBtn.addEventListener('click', () => window.HistoryManager.clearHistory());
    
    // 画布管理器事件（在CanvasManager内部设置）
    window.CanvasManager.setupEventListeners();
    
    // 节点管理器事件（在NodeManager内部设置）
    window.NodeManager.setupEventListeners();
    
    // UI管理器事件（在UIManager内部设置）
    window.UIManager.setupEventListeners();
}
