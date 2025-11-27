// 渲染进程脚本 - ADB截图工具（新版）

// 全局状态
let selectedDevice = null;
let currentImagePath = null;
let currentImageData = null;
let historyData = [];
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionEnd = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let scale = 1;

// 缩放和拖动相关
let zoomLevel = 1;
let minZoom = 0.1;
let maxZoom = 50; // 最大放大50倍
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let scrollStart = { x: 0, y: 0 };

// DOM元素
let elements = {};

// 十字光标元素
let crosshair = null;
let crosshairH = null;
let crosshairV = null;
let crosshairCoords = null;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
    initializeApp();
    setupEventListeners();
    await loadHistoryFromDisk();
    refreshDevices();
});

// 初始化应用
function initializeApp() {
    // 缓存DOM元素
    elements = {
        deviceSelect: document.getElementById('device-select'),
        refreshDevicesBtn: document.getElementById('refresh-devices-btn'),
        captureBtn: document.getElementById('capture-btn'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        historyList: document.getElementById('history-list'),
        statusMessage: document.getElementById('status-message'),
        imageCanvas: document.getElementById('image-canvas'),
        imageContainer: document.getElementById('image-container'),
        selectionOverlay: document.getElementById('selection-overlay'),
        selectionBox: document.getElementById('selection-box'),
        cropCanvas: document.getElementById('crop-canvas'),
        cropPreviewContainer: document.getElementById('crop-preview-container'),
        cropWidth: document.getElementById('crop-width'),
        cropHeight: document.getElementById('crop-height'),
        cropX: document.getElementById('crop-x'),
        cropY: document.getElementById('crop-y'),
        saveCropBtn: document.getElementById('save-crop-btn'),
        saveOriginalBtn: document.getElementById('save-original-btn'),
        resetSelectionBtn: document.getElementById('reset-selection-btn')
    };
    
    // 初始化十字光标元素
    crosshair = document.getElementById('crosshair');
    crosshairH = document.querySelector('.crosshair-h');
    crosshairV = document.querySelector('.crosshair-v');
    crosshairCoords = document.getElementById('crosshair-coords');
    
    // 缩放控制元素
    elements.zoomInBtn = document.getElementById('zoom-in-btn');
    elements.zoomOutBtn = document.getElementById('zoom-out-btn');
    elements.zoomResetBtn = document.getElementById('zoom-reset-btn');
    elements.zoomFitBtn = document.getElementById('zoom-fit-btn');
    elements.zoomLevel = document.getElementById('zoom-level');
    elements.bottomControls = document.querySelector('.bottom-controls');
}

// 设置事件监听器
function setupEventListeners() {
    // 顶部按钮
    elements.refreshDevicesBtn.addEventListener('click', refreshDevices);
    elements.captureBtn.addEventListener('click', captureScreen);
    elements.deviceSelect.addEventListener('change', onDeviceChange);
    
    // 历史记录
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Canvas鼠标事件 - 框选和十字光标
    elements.imageCanvas.addEventListener('mousedown', onCanvasMouseDown);
    elements.imageCanvas.addEventListener('mousemove', onCanvasMouseMove);
    elements.imageCanvas.addEventListener('mouseup', onCanvasMouseUp);
    elements.imageCanvas.addEventListener('mouseleave', onCanvasMouseLeave);
    elements.imageCanvas.addEventListener('mouseenter', onCanvasMouseEnter);
    
    // 右侧按钮
    elements.saveCropBtn.addEventListener('click', saveCroppedImage);
    elements.saveOriginalBtn.addEventListener('click', saveOriginalImage);
    elements.resetSelectionBtn.addEventListener('click', resetSelection);
    
    // 缩放控制
    elements.zoomInBtn.addEventListener('click', () => zoomImage(0.2));
    elements.zoomOutBtn.addEventListener('click', () => zoomImage(-0.2));
    elements.zoomResetBtn.addEventListener('click', resetZoom);
    elements.zoomFitBtn.addEventListener('click', fitToWindow);
    
    // 鼠标滚轮缩放
    elements.imageContainer.addEventListener('wheel', onMouseWheel, { passive: false });
    
    // 右键拖动图片
    elements.imageContainer.addEventListener('contextmenu', onContextMenu);
    elements.imageContainer.addEventListener('mousedown', onContainerMouseDown);
    elements.imageContainer.addEventListener('mousemove', onContainerMouseMove);
    elements.imageContainer.addEventListener('mouseup', onContainerMouseUp);
    elements.imageContainer.addEventListener('mouseleave', onContainerMouseUp);
}

// 禁用右键菜单
function onContextMenu(e) {
    if (currentImageData) {
        e.preventDefault();
    }
}

// ========== 设备管理 ==========

// 刷新设备列表
async function refreshDevices(silent = false) {
    if (!silent) {
        showStatus('正在检查设备...', 'info');
    }
    elements.deviceSelect.disabled = true;
    elements.captureBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.checkAdbDevices();
        
        if (result.success && result.devices.length > 0) {
            // 填充设备下拉列表
            elements.deviceSelect.innerHTML = '<option value="">选择设备</option>';
            result.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.id} (${device.status})`;
                elements.deviceSelect.appendChild(option);
            });
            elements.deviceSelect.disabled = false;
            if (!silent) {
                showStatus(`找到 ${result.devices.length} 个设备`, 'success');
            }
        } else {
            elements.deviceSelect.innerHTML = '<option value="">未检测到设备</option>';
            if (!silent) {
                showStatus('未检测到设备，请连接Android设备并开启USB调试', 'warning');
            }
        }
    } catch (error) {
        elements.deviceSelect.innerHTML = '<option value="">检查失败</option>';
        if (!silent) {
            showStatus(`错误: ${error.message}`, 'error');
        }
    }
}

// 设备选择变化
function onDeviceChange() {
    selectedDevice = elements.deviceSelect.value;
    elements.captureBtn.disabled = !selectedDevice;
}

// ========== 截图功能 ==========

// 截取屏幕
async function captureScreen() {
    if (!selectedDevice) {
        showStatus('请先选择设备', 'warning');
        return;
    }
    
    showStatus('正在截图...', 'info');
    elements.captureBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.captureScreen(selectedDevice);
        
        if (result.success) {
            currentImagePath = result.imagePath;
            await loadAndDisplayImage(currentImagePath);
            
            // 添加到历史记录（使用服务器返回的文件名和时间戳）
            addToHistory(result.imagePath, result.fileName, result.timestamp);
            
            // 启用保存原图按钮
            elements.saveOriginalBtn.disabled = false;
            
            showStatus('截图成功！使用鼠标在图片上框选需要裁剪的区域', 'success');
        } else {
            showStatus(`截图失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(` 截图失败: ${error.message}`, 'error');
    } finally {
        elements.captureBtn.disabled = false;
    }
}

// 加载并显示图片
function loadAndDisplayImage(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            currentImageData = img;
            
            // 计算初始缩放比例以适应容器
            const containerRect = elements.imageContainer.getBoundingClientRect();
            const maxWidth = containerRect.width - 40;
            const maxHeight = containerRect.height - 40;
            
            scale = Math.min(
                maxWidth / img.width,
                maxHeight / img.height,
                1
            );
            
            // 重置缩放级别
            zoomLevel = 1;
            
            // 绘制图片
            redrawCanvas();
            
            // 显示canvas和缩放控制
            const placeholder = elements.imageContainer.querySelector('.placeholder-text');
            if (placeholder) placeholder.style.display = 'none';
            elements.imageCanvas.style.display = 'block';
            elements.bottomControls.classList.add('active');
            elements.imageContainer.classList.add('has-image');
            
            // 更新缩放显示
            updateZoomDisplay();
            
            // 重置选区
            resetSelection();
            
            resolve();
        };
        img.onerror = reject;
        img.src = imagePath;
    });
}

// 重绘canvas
function redrawCanvas() {
    if (!currentImageData) return;
    
    // 计算当前显示尺寸
    const displayWidth = currentImageData.width * scale * zoomLevel;
    const displayHeight = currentImageData.height * scale * zoomLevel;
    
    // 设置canvas尺寸
    elements.imageCanvas.width = displayWidth;
    elements.imageCanvas.height = displayHeight;
    
    // 绘制图片
    const ctx = elements.imageCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentImageData, 0, 0, displayWidth, displayHeight);
    
    // 计算canvas在容器中的偏移
    updateCanvasOffset();
}

// 更新canvas偏移量
function updateCanvasOffset() {
    const canvasRect = elements.imageCanvas.getBoundingClientRect();
    const containerRect = elements.imageContainer.getBoundingClientRect();
    canvasOffset.x = canvasRect.left - containerRect.left;
    canvasOffset.y = canvasRect.top - containerRect.top;
}

// ========== 鼠标框选功能 ==========

// Canvas鼠标按下
function onCanvasMouseDown(e) {
    if (!currentImageData) return;
    
    // 只有左键才开始框选
    if (e.button !== 0) return;
    
    isSelecting = true;
    const rect = elements.imageCanvas.getBoundingClientRect();
    selectionStart.x = e.clientX - rect.left;
    selectionStart.y = e.clientY - rect.top;
    selectionEnd = { ...selectionStart };
    
    elements.selectionBox.style.display = 'none';
    elements.selectionOverlay.style.display = 'block';
    
    e.preventDefault();
}

// Canvas鼠标进入
function onCanvasMouseEnter(e) {
    if (currentImageData && crosshair) {
        crosshair.style.display = 'block';
    }
}

// Canvas鼠标移动
function onCanvasMouseMove(e) {
    if (!currentImageData) return;
    
    const rect = elements.imageCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 更新十字光标位置
    updateCrosshair(mouseX, mouseY, rect);
    
    // 如果正在框选，更新选区
    if (isSelecting) {
        selectionEnd.x = mouseX;
        selectionEnd.y = mouseY;
        
        // 限制在canvas范围内
        selectionEnd.x = Math.max(0, Math.min(selectionEnd.x, elements.imageCanvas.width));
        selectionEnd.y = Math.max(0, Math.min(selectionEnd.y, elements.imageCanvas.height));
        
        updateSelectionBox();
    }
}

// Canvas鼠标抬起
function onCanvasMouseUp(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // 如果选区太小，取消选择
    if (width < 10 || height < 10) {
        resetSelection();
        return;
    }
    
    // 显示选区并更新裁剪预览
    updateSelectionBox();
    updateCropPreview();
}

// Canvas鼠标离开
function onCanvasMouseLeave(e) {
    // 隐藏十字光标
    if (crosshair) {
        crosshair.style.display = 'none';
    }
    
    // 如果正在框选，停止框选
    if (isSelecting) {
        onCanvasMouseUp(e);
    }
}

// 更新十字光标位置
function updateCrosshair(mouseX, mouseY, canvasRect) {
    if (!crosshair || !currentImageData) return;
    
    // 转换为原始图片坐标
    const originalX = Math.round(mouseX / (scale * zoomLevel));
    const originalY = Math.round(mouseY / (scale * zoomLevel));
    
    // 更新十字线位置（现在相对于canvas-wrapper，不需要offset）
    crosshairH.style.top = mouseY + 'px';
    crosshairV.style.left = mouseX + 'px';
    
    // 更新坐标显示
    crosshairCoords.textContent = `${originalX}, ${originalY}`;
    
    // 计算坐标框的位置，避免超出边界
    let coordX = mouseX + 15;
    let coordY = mouseY + 15;
    
    // 如果坐标框会超出右边界，放到鼠标左边
    if (coordX + 100 > elements.imageCanvas.width) {
        coordX = mouseX - 100;
    }
    
    // 如果坐标框会超出下边界，放到鼠标上边
    if (coordY + 30 > elements.imageCanvas.height) {
        coordY = mouseY - 35;
    }
    
    crosshairCoords.style.left = coordX + 'px';
    crosshairCoords.style.top = coordY + 'px';
}

// 更新选区框
function updateSelectionBox() {
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // 现在相对于canvas-wrapper，不需要canvasOffset
    elements.selectionBox.style.left = left + 'px';
    elements.selectionBox.style.top = top + 'px';
    elements.selectionBox.style.width = width + 'px';
    elements.selectionBox.style.height = height + 'px';
    elements.selectionBox.style.display = 'block';
}

// 更新裁剪预览
function updateCropPreview() {
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // 转换为原始图片坐标
    const originalX = Math.round(left / (scale * zoomLevel));
    const originalY = Math.round(top / (scale * zoomLevel));
    const originalWidth = Math.round(width / (scale * zoomLevel));
    const originalHeight = Math.round(height / (scale * zoomLevel));
    
    // 更新尺寸信息
    elements.cropWidth.textContent = originalWidth;
    elements.cropHeight.textContent = originalHeight;
    elements.cropX.textContent = originalX;
    elements.cropY.textContent = originalY;
    
    // 在右侧预览canvas中绘制裁剪区域
    const previewMaxSize = 280;
    const previewScale = Math.min(
        previewMaxSize / originalWidth,
        previewMaxSize / originalHeight,
        1
    );
    
    elements.cropCanvas.width = originalWidth * previewScale;
    elements.cropCanvas.height = originalHeight * previewScale;
    
    const cropCtx = elements.cropCanvas.getContext('2d');
    cropCtx.drawImage(
        currentImageData,
        originalX, originalY, originalWidth, originalHeight,
        0, 0, elements.cropCanvas.width, elements.cropCanvas.height
    );
    
    // 显示预览和按钮
    elements.cropCanvas.classList.add('active');
    const emptyState = elements.cropPreviewContainer.querySelector('.empty-state');
    if (emptyState) emptyState.style.display = 'none';
    
    elements.saveCropBtn.disabled = false;
    elements.resetSelectionBtn.disabled = false;
}

// 重置选区
function resetSelection() {
    isSelecting = false;
    selectionStart = { x: 0, y: 0 };
    selectionEnd = { x: 0, y: 0 };
    
    elements.selectionBox.style.display = 'none';
    elements.selectionOverlay.style.display = 'none';
    elements.cropCanvas.classList.remove('active');
    
    const emptyState = elements.cropPreviewContainer.querySelector('.empty-state');
    if (emptyState) emptyState.style.display = 'block';
    
    elements.cropWidth.textContent = '-';
    elements.cropHeight.textContent = '-';
    elements.cropX.textContent = '-';
    elements.cropY.textContent = '-';
    
    elements.saveCropBtn.disabled = true;
    elements.resetSelectionBtn.disabled = true;
}

// ========== 保存功能 ==========

// 保存裁剪后的图片
async function saveCroppedImage() {
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    const cropData = {
        x: left / (scale * zoomLevel),
        y: top / (scale * zoomLevel),
        width: width / (scale * zoomLevel),
        height: height / (scale * zoomLevel)
    };
    
    showStatus('正在保存裁剪图片...', 'info');
    elements.saveCropBtn.disabled = true;
    
    try {
        const cropResult = await window.electronAPI.cropImage(currentImagePath, cropData);
        
        if (cropResult.success) {
            const saveResult = await window.electronAPI.saveImage(cropResult.croppedPath);
            
            if (saveResult.success) {
                showStatus(`裁剪图片已保存: ${saveResult.savedPath}`, 'success');
            } else {
                showStatus(`${saveResult.error}`, 'warning');
            }
        } else {
            showStatus(`裁剪失败: ${cropResult.error}`, 'error');
        }
    } catch (error) {
        showStatus(`保存失败: ${error.message}`, 'error');
    } finally {
        elements.saveCropBtn.disabled = false;
    }
}

// 保存原始图片
async function saveOriginalImage() {
    if (!currentImagePath) return;
    
    showStatus('正在保存原图...', 'info');
    elements.saveOriginalBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.saveImage(currentImagePath);
        
        if (result.success) {
            showStatus(` 原图已保存: ${result.savedPath}`, 'success');
        } else {
            showStatus(`${result.error}`, 'warning');
        }
    } catch (error) {
        showStatus(`保存失败: ${error.message}`, 'error');
    } finally {
        elements.saveOriginalBtn.disabled = false;
    }
}

// ========== 历史记录 ==========

// 从磁盘加载历史记录
async function loadHistoryFromDisk() {
    try {
        const result = await window.electronAPI.loadHistory();
        if (result.success && result.history) {
            historyData = result.history;
            updateHistoryList();
            
            // 显示截图保存目录
            const dirResult = await window.electronAPI.getScreenshotsDir();
            if (dirResult.success) {
                console.log('截图保存目录:', dirResult.path);
            }
        }
    } catch (error) {
        console.error('加载历史记录失败:', error);
    }
}

// 保存历史记录到磁盘
async function saveHistoryToDisk() {
    try {
        await window.electronAPI.saveHistory(historyData);
    } catch (error) {
        console.error('保存历史记录失败:', error);
    }
}

// 添加到历史记录
function addToHistory(imagePath, fileName, timestamp) {
    const historyItem = {
        path: imagePath,
        timestamp: timestamp,
        fileName: fileName,
        id: Date.now()
    };
    
    historyData.unshift(historyItem);
    
    // 限制历史记录数量
    if (historyData.length > 50) {
        historyData = historyData.slice(0, 50);
    }
    
    updateHistoryList();
    saveHistoryToDisk(); // 保存到磁盘
}

// 更新历史记录列表
function updateHistoryList() {
    if (historyData.length === 0) {
        elements.historyList.innerHTML = '<p class="empty-state">暂无截图记录</p>';
        return;
    }
    
    elements.historyList.innerHTML = '';
    
    historyData.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        if (index === 0) div.classList.add('active');
        
        div.innerHTML = `
            <div class="history-item-content">
                <div class="history-item-name">${item.fileName}</div>
                <div class="history-item-time">${item.timestamp}</div>
            </div>
        `;
        
        div.addEventListener('click', () => {
            loadHistoryItem(item);
            // 更新激活状态
            elements.historyList.querySelectorAll('.history-item').forEach(el => {
                el.classList.remove('active');
            });
            div.classList.add('active');
        });
        
        elements.historyList.appendChild(div);
    });
}

// 加载历史记录项
async function loadHistoryItem(item) {
    currentImagePath = item.path;
    await loadAndDisplayImage(item.path);
    elements.saveOriginalBtn.disabled = false;
    showStatus('已加载历史截图', 'success');
}

// 清空历史记录
function clearHistory() {
    if (historyData.length === 0) return;
    
    if (confirm('确定要清空所有历史记录吗？\n注意：这不会删除已保存的截图文件。')) {
        historyData = [];
        updateHistoryList();
        saveHistoryToDisk(); // 保存到磁盘
        showStatus('历史记录已清空', 'success');
    }
}

// ========== 缩放和拖动功能 ==========

// 缩放图片
function zoomImage(delta) {
    if (!currentImageData) return;
    
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel + delta));
    if (newZoom === zoomLevel) return;
    
    zoomLevel = newZoom;
    redrawCanvas();
    updateZoomDisplay();
    resetSelection();
}

// 鼠标滚轮缩放
function onMouseWheel(e) {
    if (!currentImageData) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomImage(delta);
}

// 重置缩放
function resetZoom() {
    if (!currentImageData) return;
    
    zoomLevel = 1;
    redrawCanvas();
    updateZoomDisplay();
    resetSelection();
}

// 适应窗口
function fitToWindow() {
    if (!currentImageData) return;
    
    const containerRect = elements.imageContainer.getBoundingClientRect();
    const maxWidth = containerRect.width - 40;
    const maxHeight = containerRect.height - 40;
    
    const newScale = Math.min(
        maxWidth / currentImageData.width,
        maxHeight / currentImageData.height,
        1
    );
    
    scale = newScale;
    zoomLevel = 1;
    redrawCanvas();
    updateZoomDisplay();
    resetSelection();
}

// 更新缩放显示
function updateZoomDisplay() {
    const percentage = Math.round(scale * zoomLevel * 100);
    elements.zoomLevel.textContent = `${percentage}%`;
}

// 容器鼠标按下（拖动）
function onContainerMouseDown(e) {
    if (!currentImageData) return;
    
    // 只有右键才开始拖动
    if (e.button !== 2) return;
    
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    scrollStart.x = elements.imageContainer.scrollLeft;
    scrollStart.y = elements.imageContainer.scrollTop;
    elements.imageContainer.classList.add('dragging');
    
    e.preventDefault();
}

// 容器鼠标移动（拖动）
function onContainerMouseMove(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    elements.imageContainer.scrollLeft = scrollStart.x - dx;
    elements.imageContainer.scrollTop = scrollStart.y - dy;
}

// 容器鼠标抬起（拖动）
function onContainerMouseUp(e) {
    isDragging = false;
    elements.imageContainer.classList.remove('dragging');
}

// ========== 工具函数 ==========

// 显示状态消息
function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    
    // 自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            elements.statusMessage.className = 'status-message';
        }, 5000);
    }
}
