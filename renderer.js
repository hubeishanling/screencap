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
    
    // 加载历史记录
    await window.HistoryManager.loadHistoryFromDisk();
    
    // 自动刷新设备列表
    await window.DeviceManager.refreshDevices();
});

// 初始化应用
function initializeApp() {
    // 缓存所有DOM元素
    elements = {
        // 设备相关
        deviceSelect: document.getElementById('device-select'),
        refreshDevicesBtn: document.getElementById('refresh-devices-btn'),
        scanDevicesBtn: document.getElementById('scan-devices-btn'),
        manualConnectInput: document.getElementById('manual-connect-input'),
        manualConnectBtn: document.getElementById('manual-connect-btn'),
        adbPairBtn: document.getElementById('adb-pair-btn'),
        adbPairForm: document.getElementById('adb-pair-form'),
        pairAddrInput: document.getElementById('pair-addr-input'),
        pairCodeInput: document.getElementById('pair-code-input'),
        pairDebugInput: document.getElementById('pair-debug-input'),
        pairExecBtn: document.getElementById('pair-exec-btn'),
        pairCancelBtn: document.getElementById('pair-cancel-btn'),
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
        colorTabBtn: document.getElementById('color-tab-btn'),
        cropPanel: document.getElementById('crop-panel'),
        nodesPanel: document.getElementById('nodes-panel'),
        colorPanel: document.getElementById('color-panel'),
        
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
        sidebarRight: document.getElementById('sidebar-right'),
        
        // 取色工具
        colorPickBtn: document.getElementById('color-pick-btn'),
        colorTypeSelect: document.getElementById('color-type-select'),
        gridSizeInput: document.getElementById('grid-size-input'),
        gridSizeValue: document.getElementById('grid-size-value'),
        gridSizeControl: document.getElementById('grid-size-control'),
        clearColorHistoryBtn: document.getElementById('clear-color-history-btn'),
        recolorAreaBtn: document.getElementById('recolor-area-btn'),
        colorPreview: document.getElementById('color-preview'),
        colorPreviewSwatch: document.getElementById('color-preview-swatch'),
        colorPreviewHex: document.getElementById('color-preview-hex'),
        colorPreviewRgb: document.getElementById('color-preview-rgb'),
        
        // 取色历史Tab
        singleColorTabBtn: document.getElementById('single-color-tab-btn'),
        multiColorTabBtn: document.getElementById('multi-color-tab-btn'),
        singleColorContainer: document.getElementById('single-color-container'),
        multiColorContainer: document.getElementById('multi-color-container'),
        singleColorHistoryList: document.getElementById('single-color-history-list'),
        multiColorHistoryList: document.getElementById('multi-color-history-list'),
        multiColorCode: document.getElementById('multi-color-code'),
        copyMultiCodeBtn: document.getElementById('copy-multi-code-btn')
    };
    
    // 初始化各个模块
    window.Utils.initStatusElement(elements.statusMessage);
    window.DeviceManager.initElements(elements);
    window.HistoryManager.initElements(elements);
    window.ScreenshotManager.initElements(elements);
    window.CanvasManager.initElements(elements);
    window.NodeManager.initElements(elements);
    window.ColorPickerManager.initElements(elements);
    window.UIManager.initElements(elements);
}

// 设置事件监听器
function setupEventListeners() {
    // 设备管理
    elements.refreshDevicesBtn.addEventListener('click', () => window.DeviceManager.refreshDevices());
    elements.scanDevicesBtn.addEventListener('click', () => window.DeviceManager.scanAllDevices());
    elements.deviceSelect.addEventListener('change', () => window.DeviceManager.onDeviceChange());
    elements.adbPairBtn.addEventListener('click', () => {
        if (elements.adbPairForm.style.display === 'none') {
            elements.adbPairForm.style.display = 'block';
            window.showStatus('请输入配对信息并执行配对', 'info');
        } else {
            elements.adbPairForm.style.display = 'none';
        }
    });
    elements.pairCancelBtn.addEventListener('click', () => {
        elements.pairAddrInput.value = '';
        elements.pairCodeInput.value = '';
        elements.pairDebugInput.value = '';
        elements.adbPairForm.style.display = 'none';
    });
    elements.pairExecBtn.addEventListener('click', async () => {
        const addr = (elements.pairAddrInput.value || '').trim();
        const code = (elements.pairCodeInput.value || '').trim();
        const daddr = (elements.pairDebugInput.value || '').trim();
        const addrRegex = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/;
        if (!addrRegex.test(addr)) {
            window.showStatus('配对地址格式不正确，应为 IP:端口', 'warning');
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            window.showStatus('配对码应为6位数字', 'warning');
            return;
        }
        if (!addrRegex.test(daddr)) {
            window.showStatus('调试地址格式不正确，应为 IP:端口', 'warning');
            return;
        }
        try {
            elements.pairExecBtn.disabled = true;
            window.showStatus(`正在配对 ${addr} ...`, 'info');
            const pairResult = await window.electronAPI.pairDevice(addr, code);
            if (!pairResult || !pairResult.success) {
                const msg = (pairResult && (pairResult.message || pairResult.error)) || '配对失败';
                window.showStatus(msg, 'error');
                return;
            }
            window.showStatus('配对成功，正在连接...', 'success');
            const conn = await window.electronAPI.connectDevice(daddr);
            if (conn && conn.success) {
                window.showStatus(conn.message || `已连接 ${daddr}`, 'success');
                await window.DeviceManager.refreshDevices(true);
                const options = Array.from(elements.deviceSelect.options);
                const match = options.find(o => o.value === daddr);
                if (match) {
                    elements.deviceSelect.value = daddr;
                    window.DeviceManager.onDeviceChange();
                }
                elements.adbPairForm.style.display = 'none';
                elements.pairAddrInput.value = '';
                elements.pairCodeInput.value = '';
                elements.pairDebugInput.value = '';
            } else {
                const msg = (conn && (conn.message || conn.error)) || '连接失败';
                window.showStatus(msg, 'error');
            }
        } catch (e) {
            window.showStatus(`操作失败: ${e.message}`, 'error');
        } finally {
            elements.pairExecBtn.disabled = false;
        }
    });
    elements.manualConnectBtn.addEventListener('click', async () => {
        const address = (elements.manualConnectInput.value || '').trim();
        if (!address) {
            window.showStatus('请输入 IP:端口', 'warning');
            return;
        }
        // 简单校验 IPv4:port
        const ipv4PortRegex = /^\s*(\d{1,3}\.){3}\d{1,3}:\d{1,5}\s*$/;
        if (!ipv4PortRegex.test(address)) {
            window.showStatus('地址格式不正确，应为 IP:端口，例如 192.168.0.106:5555', 'warning');
            return;
        }
        try {
            window.showStatus(`正在连接 ${address} ...`, 'info');
            const result = await window.electronAPI.connectDevice(address);
            if (result && result.success) {
                window.showStatus(result.message || `已连接 ${address}`, 'success');
                await window.DeviceManager.refreshDevices(true);
                // 自动选中该设备
                const options = Array.from(elements.deviceSelect.options);
                const match = options.find(o => o.value === address);
                if (match) {
                    elements.deviceSelect.value = address;
                    window.DeviceManager.onDeviceChange();
                }
            } else {
                const msg = (result && (result.message || result.error)) || '连接失败';
                window.showStatus(msg, 'error');
            }
        } catch (err) {
            window.showStatus(`连接出错: ${err.message}`, 'error');
        }
    });
    
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
    
    // 取色管理器事件（在ColorPickerManager内部设置）
    window.ColorPickerManager.setupEventListeners();
    
    // UI管理器事件（在UIManager内部设置）
    window.UIManager.setupEventListeners();
}
