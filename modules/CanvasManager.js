// 画布管理模块
class CanvasManager {
    constructor() {
        this.currentImageData = null;
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.canvasOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.zoomLevel = 1;
        this.minZoom = 0.1;
        this.maxZoom = 50;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.scrollStart = { x: 0, y: 0 };
        this.elements = {};
        this.crosshair = null;
        this.crosshairH = null;
        this.crosshairV = null;
        this.crosshairCoords = null;
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
        this.crosshair = document.getElementById('crosshair');
        this.crosshairH = document.querySelector('.crosshair-h');
        this.crosshairV = document.querySelector('.crosshair-v');
        this.crosshairCoords = document.getElementById('crosshair-coords');
    }

    // 设置事件监听器
    setupEventListeners() {
        // Canvas鼠标事件
        this.elements.imageCanvas.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
        this.elements.imageCanvas.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
        this.elements.imageCanvas.addEventListener('mouseup', this.onCanvasMouseUp.bind(this));
        this.elements.imageCanvas.addEventListener('mouseleave', this.onCanvasMouseLeave.bind(this));
        this.elements.imageCanvas.addEventListener('mouseenter', this.onCanvasMouseEnter.bind(this));
        
        // 缩放控制
        this.elements.zoomInBtn.addEventListener('click', () => this.zoomImage(0.2));
        this.elements.zoomOutBtn.addEventListener('click', () => this.zoomImage(-0.2));
        this.elements.zoomResetBtn.addEventListener('click', () => this.resetZoom());
        this.elements.zoomFitBtn.addEventListener('click', () => this.fitToWindow());
        
        // 鼠标滚轮缩放
        this.elements.imageContainer.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
        
        // 右键拖动
        this.elements.imageContainer.addEventListener('contextmenu', this.onContextMenu.bind(this));
        this.elements.imageContainer.addEventListener('mousedown', this.onContainerMouseDown.bind(this));
        this.elements.imageContainer.addEventListener('mousemove', this.onContainerMouseMove.bind(this));
        this.elements.imageContainer.addEventListener('mouseup', this.onContainerMouseUp.bind(this));
        this.elements.imageContainer.addEventListener('mouseleave', this.onContainerMouseUp.bind(this));
        
        // 按钮事件
        this.elements.resetSelectionBtn.addEventListener('click', () => this.resetSelection());
    }

    // 加载并显示图片
    loadAndDisplayImage(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.currentImageData = img;
                window.currentImageData = img;
                
                // 计算初始缩放比例
                const containerRect = this.elements.imageContainer.getBoundingClientRect();
                const maxWidth = containerRect.width - 40;
                const maxHeight = containerRect.height - 40;
                
                this.scale = Math.min(
                    maxWidth / img.width,
                    maxHeight / img.height,
                    1
                );
                
                // 重置缩放级别
                this.zoomLevel = 1;
                
                // 绘制图片
                this.redrawCanvas();
                
                // 显示canvas
                const placeholder = this.elements.imageContainer.querySelector('.placeholder-text');
                if (placeholder) placeholder.style.display = 'none';
                this.elements.imageCanvas.style.display = 'block';
                this.elements.bottomControls.classList.add('active');
                this.elements.imageContainer.classList.add('has-image');
                
                // 更新缩放显示
                this.updateZoomDisplay();
                
                // 重置选区
                this.resetSelection();
                
                // 隐藏节点高亮
                window.NodeManager.hideNodeHighlight();
                
                resolve();
            };
            img.onerror = reject;
            img.src = imagePath;
        });
    }

    // 重绘canvas
    redrawCanvas() {
        if (!this.currentImageData) return;
        
        const displayWidth = this.currentImageData.width * this.scale * this.zoomLevel;
        const displayHeight = this.currentImageData.height * this.scale * this.zoomLevel;
        
        this.elements.imageCanvas.width = displayWidth;
        this.elements.imageCanvas.height = displayHeight;
        
        const ctx = this.elements.imageCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.currentImageData, 0, 0, displayWidth, displayHeight);
        
        this.updateCanvasOffset();
        
        // 如果有选中的节点，更新高亮位置
        if (window.NodeManager && window.NodeManager.selectedNode) {
            window.NodeManager.highlightNodeOnImage(window.NodeManager.selectedNode);
        }
    }

    // 更新canvas偏移量
    updateCanvasOffset() {
        const canvasRect = this.elements.imageCanvas.getBoundingClientRect();
        const containerRect = this.elements.imageContainer.getBoundingClientRect();
        this.canvasOffset.x = canvasRect.left - containerRect.left;
        this.canvasOffset.y = canvasRect.top - containerRect.top;
    }

    // Canvas鼠标按下
    onCanvasMouseDown(e) {
        if (!this.currentImageData || e.button !== 0) return;
        
        this.isSelecting = true;
        const rect = this.elements.imageCanvas.getBoundingClientRect();
        this.selectionStart.x = e.clientX - rect.left;
        this.selectionStart.y = e.clientY - rect.top;
        this.selectionEnd = { ...this.selectionStart };
        
        this.elements.selectionBox.style.display = 'none';
        this.elements.selectionOverlay.style.display = 'block';
        
        e.preventDefault();
    }

    // Canvas鼠标移动
    onCanvasMouseMove(e) {
        if (!this.currentImageData) return;
        
        const rect = this.elements.imageCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 更新十字光标
        this.updateCrosshair(mouseX, mouseY, rect);
        
        // 如果正在框选
        if (this.isSelecting) {
            this.selectionEnd.x = mouseX;
            this.selectionEnd.y = mouseY;
            
            this.selectionEnd.x = Math.max(0, Math.min(this.selectionEnd.x, this.elements.imageCanvas.width));
            this.selectionEnd.y = Math.max(0, Math.min(this.selectionEnd.y, this.elements.imageCanvas.height));
            
            this.updateSelectionBox();
        }
    }

    // Canvas鼠标抬起
    onCanvasMouseUp(e) {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
        
        // 如果选区太小（点击）
        if (width < 10 || height < 10) {
            this.resetSelection();
            
            // 尝试查找点击位置的节点
            if (window.NodeManager && window.NodeManager.uiHierarchyData) {
                const rect = this.elements.imageCanvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                
                const originalX = Math.round(clickX / (this.scale * this.zoomLevel));
                const originalY = Math.round(clickY / (this.scale * this.zoomLevel));
                
                const foundNode = window.NodeManager.findNodeByCoordinates(originalX, originalY);
                
                if (foundNode) {
                    window.NodeManager.expandAndSelectNodeInTree(foundNode);
                } else {
                    window.showStatus(`该位置未找到对应的UI节点 (坐标: ${originalX}, ${originalY})`, 'warning');
                }
            }
            
            return;
        }
        
        // 显示选区并更新裁剪预览
        this.updateSelectionBox();
        this.updateCropPreview();
    }

    // Canvas鼠标离开
    onCanvasMouseLeave(e) {
        if (this.crosshair) {
            this.crosshair.style.display = 'none';
        }
        
        if (this.isSelecting) {
            this.onCanvasMouseUp(e);
        }
    }

    // Canvas鼠标进入
    onCanvasMouseEnter(e) {
        if (this.currentImageData && this.crosshair) {
            this.crosshair.style.display = 'block';
        }
    }

    // 更新十字光标
    updateCrosshair(mouseX, mouseY, canvasRect) {
        if (!this.crosshair || !this.currentImageData) return;
        
        const originalX = Math.round(mouseX / (this.scale * this.zoomLevel));
        const originalY = Math.round(mouseY / (this.scale * this.zoomLevel));
        
        this.crosshairH.style.top = mouseY + 'px';
        this.crosshairV.style.left = mouseX + 'px';
        
        this.crosshairCoords.textContent = `${originalX}, ${originalY}`;
        
        let coordX = mouseX + 15;
        let coordY = mouseY + 15;
        
        if (coordX + 100 > this.elements.imageCanvas.width) {
            coordX = mouseX - 100;
        }
        
        if (coordY + 30 > this.elements.imageCanvas.height) {
            coordY = mouseY - 35;
        }
        
        this.crosshairCoords.style.left = coordX + 'px';
        this.crosshairCoords.style.top = coordY + 'px';
    }

    // 更新选区框
    updateSelectionBox() {
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
        
        this.elements.selectionBox.style.left = left + 'px';
        this.elements.selectionBox.style.top = top + 'px';
        this.elements.selectionBox.style.width = width + 'px';
        this.elements.selectionBox.style.height = height + 'px';
        this.elements.selectionBox.style.display = 'block';
    }

    // 更新裁剪预览
    updateCropPreview() {
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
        
        const originalX = Math.round(left / (this.scale * this.zoomLevel));
        const originalY = Math.round(top / (this.scale * this.zoomLevel));
        const originalWidth = Math.round(width / (this.scale * this.zoomLevel));
        const originalHeight = Math.round(height / (this.scale * this.zoomLevel));
        
        this.elements.cropWidth.textContent = originalWidth;
        this.elements.cropHeight.textContent = originalHeight;
        this.elements.cropX.textContent = originalX;
        this.elements.cropY.textContent = originalY;
        
        const previewMaxSize = 280;
        const previewScale = Math.min(
            previewMaxSize / originalWidth,
            previewMaxSize / originalHeight,
            1
        );
        
        this.elements.cropCanvas.width = originalWidth * previewScale;
        this.elements.cropCanvas.height = originalHeight * previewScale;
        
        const cropCtx = this.elements.cropCanvas.getContext('2d');
        cropCtx.drawImage(
            this.currentImageData,
            originalX, originalY, originalWidth, originalHeight,
            0, 0, this.elements.cropCanvas.width, this.elements.cropCanvas.height
        );
        
        this.elements.cropCanvas.classList.add('active');
        const emptyState = this.elements.cropPreviewContainer.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';
        
        this.elements.saveCropBtn.disabled = false;
        this.elements.resetSelectionBtn.disabled = false;
    }

    // 重置选区
    resetSelection() {
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        
        this.elements.selectionBox.style.display = 'none';
        this.elements.selectionOverlay.style.display = 'none';
        this.elements.cropCanvas.classList.remove('active');
        
        const emptyState = this.elements.cropPreviewContainer.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'block';
        
        this.elements.cropWidth.textContent = '-';
        this.elements.cropHeight.textContent = '-';
        this.elements.cropX.textContent = '-';
        this.elements.cropY.textContent = '-';
        
        this.elements.saveCropBtn.disabled = true;
        this.elements.resetSelectionBtn.disabled = true;
    }

    // 获取裁剪数据
    getCropData() {
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
        
        if (width < 10 || height < 10) return null;
        
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        
        return {
            x: left / (this.scale * this.zoomLevel),
            y: top / (this.scale * this.zoomLevel),
            width: width / (this.scale * this.zoomLevel),
            height: height / (this.scale * this.zoomLevel)
        };
    }

    // 缩放相关方法
    zoomImage(delta) {
        if (!this.currentImageData) return;
        
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
        if (newZoom === this.zoomLevel) return;
        
        this.zoomLevel = newZoom;
        this.redrawCanvas();
        this.updateZoomDisplay();
        this.resetSelection();
    }

    onMouseWheel(e) {
        if (!this.currentImageData) return;
        
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoomImage(delta);
    }

    resetZoom() {
        if (!this.currentImageData) return;
        
        this.zoomLevel = 1;
        this.redrawCanvas();
        this.updateZoomDisplay();
        this.resetSelection();
    }

    fitToWindow() {
        if (!this.currentImageData) return;
        
        const containerRect = this.elements.imageContainer.getBoundingClientRect();
        const maxWidth = containerRect.width - 40;
        const maxHeight = containerRect.height - 40;
        
        const newScale = Math.min(
            maxWidth / this.currentImageData.width,
            maxHeight / this.currentImageData.height,
            1
        );
        
        this.scale = newScale;
        this.zoomLevel = 1;
        this.redrawCanvas();
        this.updateZoomDisplay();
        this.resetSelection();
    }

    updateZoomDisplay() {
        const percentage = Math.round(this.scale * this.zoomLevel * 100);
        this.elements.zoomLevel.textContent = `${percentage}%`;
    }

    // 拖动相关方法
    onContextMenu(e) {
        if (this.currentImageData) {
            e.preventDefault();
        }
    }

    onContainerMouseDown(e) {
        if (!this.currentImageData || e.button !== 2) return;
        
        this.isDragging = true;
        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
        this.scrollStart.x = this.elements.imageContainer.scrollLeft;
        this.scrollStart.y = this.elements.imageContainer.scrollTop;
        this.elements.imageContainer.classList.add('dragging');
        
        e.preventDefault();
    }

    onContainerMouseMove(e) {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        
        let newScrollLeft = this.scrollStart.x - dx;
        let newScrollTop = this.scrollStart.y - dy;
        
        const container = this.elements.imageContainer;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const maxScrollTop = container.scrollHeight - container.clientHeight;
        
        newScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));
        newScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
        
        this.elements.imageContainer.scrollLeft = newScrollLeft;
        this.elements.imageContainer.scrollTop = newScrollTop;
    }

    onContainerMouseUp(e) {
        this.isDragging = false;
        this.elements.imageContainer.classList.remove('dragging');
    }

    // 获取当前缩放和比例信息
    getScaleInfo() {
        return {
            scale: this.scale,
            zoomLevel: this.zoomLevel,
            totalScale: this.scale * this.zoomLevel
        };
    }
}

// 导出单例
window.CanvasManager = new CanvasManager();
