// 取色管理模块
class ColorPickerManager {
    constructor() {
        this.elements = {};
        this.isColorPickMode = false;
        this.colorPickType = 'single'; // 'single' or 'area'
        this.singleColorHistory = []; // 单点取色历史
        this.multiColorHistory = []; // 多点取色历史
        this.maxHistory = 50;
        this.areaColorPoints = [];
        this.pointCount = 25; // 范围取色的点数
        this.lastAreaData = null; // 保存最后一次框选的区域数据
        this.currentTab = 'single'; // 当前显示的tab
        this.selectedMultiColorIndex = -1; // 当前选中的多点取色记录索引
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
    }

    // 设置事件监听器
    setupEventListeners() {
        // 取色模式切换
        this.elements.colorPickBtn.addEventListener('click', () => this.toggleColorPickMode());
        this.elements.colorTypeSelect.addEventListener('change', (e) => {
            this.colorPickType = e.target.value;
            this.updateUIForPickType();
        });
        
        // 取色点数调整
        this.elements.gridSizeInput.addEventListener('input', (e) => {
            this.pointCount = parseInt(e.target.value);
            this.elements.gridSizeValue.textContent = this.pointCount;
        });
        
        // 清空取色历史
        this.elements.clearColorHistoryBtn.addEventListener('click', () => this.clearColorHistory());
        
        // 重新取色按钮
        this.elements.recolorAreaBtn.addEventListener('click', () => this.recolorLastArea());
        
        // Tab切换
        this.elements.singleColorTabBtn.addEventListener('click', () => this.switchTab('single'));
        this.elements.multiColorTabBtn.addEventListener('click', () => this.switchTab('multi'));
        
        // 单点取色历史列表事件
        this.elements.singleColorHistoryList.addEventListener('click', (e) => {
            if (e.target.closest('.copy-color-btn')) {
                const colorValue = e.target.closest('.copy-color-btn').dataset.color;
                this.copyToClipboard(colorValue, false);
            } else if (e.target.closest('.delete-color-btn')) {
                const index = parseInt(e.target.closest('.delete-color-btn').dataset.index);
                this.deleteColorItem(index, 'single');
            }
        });
        
        // 多点取色历史列表事件
        this.elements.multiColorHistoryList.addEventListener('click', (e) => {
            if (e.target.closest('.copy-all-btn')) {
                const index = parseInt(e.target.closest('.copy-all-btn').dataset.index);
                this.copyAllColors(index);
            } else if (e.target.closest('.delete-color-btn')) {
                const index = parseInt(e.target.closest('.delete-color-btn').dataset.index);
                this.deleteColorItem(index, 'multi');
            } else if (e.target.closest('.area-item')) {
                const index = parseInt(e.target.closest('.area-item').dataset.index);
                this.selectMultiColorRecord(index);
            }
        });
        
        // 复制多点找色代码
        this.elements.copyMultiCodeBtn.addEventListener('click', () => this.copyMultiColorCode());
    }

    // 切换取色模式
    toggleColorPickMode() {
        this.isColorPickMode = !this.isColorPickMode;
        
        if (this.isColorPickMode) {
            this.elements.colorPickBtn.classList.add('active');
            this.elements.colorPickBtn.textContent = '退出取色';
            this.enableColorPicking();
            window.showStatus('取色模式已启用，点击图片取色', 'info');
        } else {
            this.elements.colorPickBtn.classList.remove('active');
            this.elements.colorPickBtn.textContent = '取色模式';
            this.disableColorPicking();
            window.showStatus('取色模式已退出', 'info');
        }
    }

    // 启用取色
    enableColorPicking() {
        if (!window.CanvasManager.currentImageData) {
            window.showStatus('请先加载图片', 'warning');
            this.isColorPickMode = false;
            this.elements.colorPickBtn.classList.remove('active');
            this.elements.colorPickBtn.textContent = '🎨 取色模式';
            return;
        }
        
        // 修改canvas光标样式
        this.elements.imageCanvas.style.cursor = 'crosshair';
        
        // 添加取色事件监听
        this.colorPickClickHandler = this.onColorPickClick.bind(this);
        this.colorPickMoveHandler = this.onColorPickMove.bind(this);
        
        this.elements.imageCanvas.addEventListener('click', this.colorPickClickHandler);
        this.elements.imageCanvas.addEventListener('mousemove', this.colorPickMoveHandler);
    }

    // 禁用取色
    disableColorPicking() {
        this.elements.imageCanvas.style.cursor = 'crosshair';
        
        if (this.colorPickClickHandler) {
            this.elements.imageCanvas.removeEventListener('click', this.colorPickClickHandler);
        }
        if (this.colorPickMoveHandler) {
            this.elements.imageCanvas.removeEventListener('mousemove', this.colorPickMoveHandler);
        }
        
        // 隐藏颜色预览
        if (this.elements.colorPreview) {
            this.elements.colorPreview.style.display = 'none';
        }
    }

    // 取色点击事件
    onColorPickClick(e) {
        if (!this.isColorPickMode) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        if (this.colorPickType === 'single') {
            this.pickSingleColor(e);
        } else {
            // 范围取色需要使用现有的选区
            this.pickAreaColors();
        }
    }

    // 取色移动事件（显示颜色预览）
    onColorPickMove(e) {
        if (!this.isColorPickMode) return;
        
        const rect = this.elements.imageCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const color = this.getColorAtPosition(x, y);
        if (color) {
            this.updateColorPreview(color, x, y);
        }
    }

    // 单点取色
    pickSingleColor(e) {
        const rect = this.elements.imageCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const color = this.getColorAtPosition(x, y);
        if (color) {
            // 转换为原图坐标
            const scaleInfo = window.CanvasManager.getScaleInfo();
            const originalX = Math.round(x / scaleInfo.totalScale);
            const originalY = Math.round(y / scaleInfo.totalScale);
            
            this.singleColorHistory.unshift({
                type: 'single',
                x: originalX,
                y: originalY,
                color: color,
                timestamp: new Date().toLocaleString()
            });
            
            // 限制历史记录数量
            if (this.singleColorHistory.length > this.maxHistory) {
                this.singleColorHistory = this.singleColorHistory.slice(0, this.maxHistory);
            }
            
            this.updateColorHistoryUI();
            window.showStatus(`取色成功: ${color.hex} (${originalX}, ${originalY})`, 'success');
        }
    }

    // 范围取色
    pickAreaColors(areaData = null) {
        // 如果没有传入区域数据，从canvas获取
        const cropData = areaData || window.CanvasManager.getCropData();
        
        if (!cropData) {
            window.showStatus('请先框选区域进行范围取色', 'warning');
            return;
        }
        
        // 保存区域数据，用于重新取色
        this.lastAreaData = {
            x: Math.round(cropData.x),
            y: Math.round(cropData.y),
            width: Math.round(cropData.width),
            height: Math.round(cropData.height)
        };
        
        // 启用重新取色按钮
        if (this.elements.recolorAreaBtn) {
            this.elements.recolorAreaBtn.disabled = false;
        }
        
        const colors = [];
        const scaleInfo = window.CanvasManager.getScaleInfo();
        
        // 计算网格行列数，使其接近指定的点数
        const aspectRatio = cropData.width / cropData.height;
        const cols = Math.round(Math.sqrt(this.pointCount * aspectRatio));
        const rows = Math.round(this.pointCount / cols);
        
        const stepX = cropData.width / (cols + 1);
        const stepY = cropData.height / (rows + 1);
        
        // 在区域内均匀分布采样点
        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                const originalX = Math.round(cropData.x + col * stepX);
                const originalY = Math.round(cropData.y + row * stepY);
                
                // 转换为canvas坐标
                const canvasX = originalX * scaleInfo.totalScale;
                const canvasY = originalY * scaleInfo.totalScale;
                
                const color = this.getColorAtPosition(canvasX, canvasY);
                if (color) {
                    colors.push({
                        x: originalX,
                        y: originalY,
                        color: color
                    });
                }
            }
        }
        
        if (colors.length > 0) {
            const newRecord = {
                type: 'area',
                area: this.lastAreaData,
                colors: colors,
                pointCount: colors.length,
                timestamp: new Date().toLocaleString()
            };
            
            // 如果是重新取色（传入了areaData），查找是否有相同区域的记录
            if (areaData) {
                const existingIndex = this.findSameAreaRecord(this.lastAreaData);
                
                if (existingIndex !== -1) {
                    // 找到相同区域的记录，替换它
                    this.multiColorHistory[existingIndex] = newRecord;
                    window.showStatus(`重新取色成功: ${colors.length} 个采样点（已更新）`, 'success');
                } else {
                    // 没有找到相同区域的记录，添加新记录
                    this.multiColorHistory.unshift(newRecord);
                    if (this.multiColorHistory.length > this.maxHistory) {
                        this.multiColorHistory = this.multiColorHistory.slice(0, this.maxHistory);
                    }
                    window.showStatus(`范围取色成功: ${colors.length} 个采样点（新增）`, 'success');
                }
            } else {
                // 正常的范围取色，添加新记录
                this.multiColorHistory.unshift(newRecord);
                if (this.multiColorHistory.length > this.maxHistory) {
                    this.multiColorHistory = this.multiColorHistory.slice(0, this.maxHistory);
                }
                window.showStatus(`范围取色成功: ${colors.length} 个采样点`, 'success');
            }
            
            this.updateColorHistoryUI();
        }
    }
    
    // 查找相同区域的记录
    findSameAreaRecord(areaData) {
        for (let i = 0; i < this.multiColorHistory.length; i++) {
            const item = this.multiColorHistory[i];
            if (item.type === 'area') {
                // 判断区域是否相同（坐标和尺寸都相同）
                if (item.area.x === areaData.x &&
                    item.area.y === areaData.y &&
                    item.area.width === areaData.width &&
                    item.area.height === areaData.height) {
                    return i; // 返回索引
                }
            }
        }
        return -1; // 没有找到
    }

    // 重新取色
    recolorLastArea() {
        if (!window.CanvasManager.currentImageData) {
            window.showStatus('请先加载图片', 'warning');
            return;
        }
        
        // 先尝试使用保存的区域数据
        let areaData = this.lastAreaData;
        
        // 如果没有保存的区域数据，尝试从当前选区获取
        if (!areaData) {
            const cropData = window.CanvasManager.getCropData();
            if (cropData) {
                areaData = {
                    x: Math.round(cropData.x),
                    y: Math.round(cropData.y),
                    width: Math.round(cropData.width),
                    height: Math.round(cropData.height)
                };
            }
        }
        
        // 如果还是没有区域数据，提示用户
        if (!areaData) {
            window.showStatus('请先框选区域', 'warning');
            return;
        }
        
        // 使用区域数据进行取色
        this.pickAreaColors(areaData);
    }

    // 获取指定位置的颜色
    getColorAtPosition(x, y) {
        const canvas = this.elements.imageCanvas;
        const ctx = canvas.getContext('2d');
        
        // 确保坐标在canvas范围内
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
            return null;
        }
        
        try {
            const imageData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1);
            const data = imageData.data;
            
            return {
                r: data[0],
                g: data[1],
                b: data[2],
                a: data[3],
                rgb: `rgb(${data[0]}, ${data[1]}, ${data[2]})`,
                rgba: `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${(data[3] / 255).toFixed(2)})`,
                hex: this.rgbToHex(data[0], data[1], data[2])
            };
        } catch (err) {
            console.error('获取颜色失败:', err);
            return null;
        }
    }

    // RGB转HEX
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
    }

    // 更新颜色预览
    updateColorPreview(color, x, y) {
        if (!this.elements.colorPreview) return;
        
        // 计算原始图片坐标
        const scaleInfo = window.CanvasManager.getScaleInfo();
        const originalX = Math.round(x / scaleInfo.totalScale);
        const originalY = Math.round(y / scaleInfo.totalScale);
        
        this.elements.colorPreview.style.display = 'block';
        this.elements.colorPreview.style.left = (x + 20) + 'px';
        this.elements.colorPreview.style.top = (y + 20) + 'px';
        
        this.elements.colorPreviewSwatch.style.backgroundColor = color.rgb;
        this.elements.colorPreviewHex.textContent = color.hex;
        this.elements.colorPreviewRgb.textContent = `(${originalX}, ${originalY})`;
    }

    // Tab切换
    switchTab(tab) {
        this.currentTab = tab;
        
        // 更新tab按钮状态
        if (tab === 'single') {
            this.elements.singleColorTabBtn.classList.add('active');
            this.elements.multiColorTabBtn.classList.remove('active');
            this.elements.singleColorContainer.style.display = 'flex';
            this.elements.multiColorContainer.style.display = 'none';
        } else {
            this.elements.singleColorTabBtn.classList.remove('active');
            this.elements.multiColorTabBtn.classList.add('active');
            this.elements.singleColorContainer.style.display = 'none';
            this.elements.multiColorContainer.style.display = 'flex';
        }
    }

    // 更新取色历史UI
    updateColorHistoryUI() {
        // 更新单点取色列表
        if (this.singleColorHistory.length === 0) {
            this.elements.singleColorHistoryList.innerHTML = '<p class="empty-state">暂无单点取色记录<br>选择"单点取色"模式开始</p>';
        } else {
            let html = '';
            this.singleColorHistory.forEach((item, index) => {
                const number = this.singleColorHistory.length - index; // 从后往前编号
                const copyData = `${item.x}|${item.y}|${item.color.hex}`;
                html += `
                    <div class="color-history-item">
                        <div class="color-number">${number}</div>
                        <div class="color-swatch" style="background-color: ${item.color.hex}"></div>
                        <div class="color-info">
                            <div class="color-value">
                                <strong class="color-hex-large">${item.color.hex}</strong>
                                <div class="color-actions-inline">
                                    <button class="copy-color-btn btn-text" data-color="${copyData}" title="复制为 x|y|color 格式">复制</button>
                                    <button class="delete-color-btn btn-text" data-index="${index}" title="删除此条记录">删除</button>
                                </div>
                            </div>
                            <div class="color-coords">坐标: (${item.x}, ${item.y})</div>
                        </div>
                    </div>
                `;
            });
            this.elements.singleColorHistoryList.innerHTML = html;
        }
        
        // 更新多点取色列表
        if (this.multiColorHistory.length === 0) {
            this.elements.multiColorHistoryList.innerHTML = '<p class="empty-state">暂无多点取色记录<br>选择"范围取色"模式开始</p>';
        } else {
            let html = '';
            this.multiColorHistory.forEach((item, index) => {
                const number = this.multiColorHistory.length - index; // 从后往前编号
                const isSelected = index === this.selectedMultiColorIndex;
                html += `
                    <div class="color-history-item area-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                        <div class="area-header">
                            <div class="area-header-left">
                                <span class="color-number">${number}</span>
                                <strong>范围取色</strong>
                                <span class="area-badge">${item.colors.length} 点</span>
                            </div>
                            <div class="area-header-actions">
                                <button class="copy-all-btn btn-text" data-index="${index}" title="复制所有采样点">复制全部</button>
                                <button class="delete-color-btn btn-text" data-index="${index}" title="删除此条记录">删除</button>
                            </div>
                        </div>
                        <div class="area-info">
                            <div class="area-range-desc">
                                <span class="area-label">起点:</span> (${item.area.x}, ${item.area.y})
                                <span class="area-sep">→</span>
                                <span class="area-label">终点:</span> (${item.area.x + item.area.width}, ${item.area.y + item.area.height})
                            </div>
                            <div class="area-size-desc">
                                <span class="area-label">尺寸:</span> ${item.area.width} × ${item.area.height} px
                                <span class="area-sep">|</span>
                                <span class="area-label">采样:</span> ${item.colors.length} 个点
                            </div>
                        </div>
                        <div class="area-colors">
                            ${item.colors.slice(0, 5).map(c => {
                                const copyData = `${c.x}|${c.y}|${c.color.hex}`;
                                return `
                                    <div class="area-color-item">
                                        <div class="color-swatch-small" style="background-color: ${c.color.hex}"></div>
                                        <div class="area-color-text">
                                            <span class="color-hex-medium">${c.color.hex}</span>
                                            <span class="area-coords">(${c.x}, ${c.y})</span>
                                        </div>
                                        <button class="copy-color-btn btn-text-mini" data-color="${copyData}" title="复制单个点">复制</button>
                                    </div>
                                `;
                            }).join('')}
                            ${item.colors.length > 5 ? `<div class="more-colors">还有 ${item.colors.length - 5} 个采样点...</div>` : ''}
                        </div>
                    </div>
                `;
            });
            this.elements.multiColorHistoryList.innerHTML = html;
        }
    }

    // 清空取色历史
    clearColorHistory() {
        if (this.currentTab === 'single') {
            if (this.singleColorHistory.length === 0) return;
            if (confirm('确定要清空所有单点取色记录吗？')) {
                this.singleColorHistory = [];
                this.updateColorHistoryUI();
                window.showStatus('单点取色记录已清空', 'info');
            }
        } else {
            if (this.multiColorHistory.length === 0) return;
            if (confirm('确定要清空所有多点取色记录吗？')) {
                this.multiColorHistory = [];
                this.selectedMultiColorIndex = -1;
                this.updateColorHistoryUI();
                this.updateMultiColorCode();
                window.showStatus('多点取色记录已清空', 'info');
            }
        }
    }

    // 导出取色数据
    async exportColorData() {
        const totalItems = this.singleColorHistory.length + this.multiColorHistory.length;
        if (totalItems === 0) {
            window.showStatus('没有可导出的取色数据', 'warning');
            return;
        }
        
        const data = {
            exportTime: new Date().toLocaleString(),
            totalItems: totalItems,
            singleColorItems: this.singleColorHistory.map(item => ({
                type: 'single',
                position: { x: item.x, y: item.y },
                color: {
                    hex: item.color.hex,
                    rgb: item.color.rgb,
                    rgba: item.color.rgba
                },
                timestamp: item.timestamp
            })),
            multiColorItems: this.multiColorHistory.map(item => ({
                type: 'area',
                area: item.area,
                pointCount: item.pointCount || item.colors.length,
                colors: item.colors.map(c => ({
                    position: { x: c.x, y: c.y },
                    color: {
                        hex: c.color.hex,
                        rgb: c.color.rgb,
                        rgba: c.color.rgba
                    }
                })),
                timestamp: item.timestamp
            }))
        };
        
        try {
            const result = await window.electronAPI.exportColorData(data);
            if (result.success) {
                window.showStatus(`取色数据已导出到: ${result.filePath}`, 'success');
            } else {
                window.showStatus('导出失败: ' + result.error, 'error');
            }
        } catch (err) {
            window.showStatus('导出失败: ' + err.message, 'error');
        }
    }

    // 更新UI根据取色类型
    updateUIForPickType() {
        if (this.colorPickType === 'area') {
            this.elements.gridSizeControl.style.display = 'flex';
            window.showStatus(`范围取色模式: 请先框选区域，然后点击图片取色 (当前: ${this.pointCount} 点)`, 'info');
        } else {
            this.elements.gridSizeControl.style.display = 'none';
            window.showStatus('单点取色模式: 点击图片获取颜色', 'info');
        }
    }

    // 选中多点取色记录
    selectMultiColorRecord(index) {
        if (index < 0 || index >= this.multiColorHistory.length) return;
        
        this.selectedMultiColorIndex = index;
        this.updateColorHistoryUI();
        this.updateMultiColorCode();
    }
    
    // 生成多点找色代码
    generateMultiColorCode(item) {
        if (!item || item.colors.length === 0) {
            return '// 选择一条多点取色记录以生成代码';
        }
        
        // 第一个点作为主颜色和基准点
        const firstPoint = item.colors[0];
        const firstColor = firstPoint.color.hex;
        const baseX = firstPoint.x;
        const baseY = firstPoint.y;
        
        // 其他点相对于第一个点的坐标
        const relativePoints = item.colors.slice(1).map(c => {
            const relX = c.x - baseX;
            const relY = c.y - baseY;
            return `    [${relX}, ${relY}, "${c.color.hex}"]`;
        });
        
        // 生成代码
        const code = `let point = findMultiColors(img, "${firstColor}", [
${relativePoints.join(',\n')}
], {
    region: [${item.area.x}, ${item.area.y}, ${item.area.width}, ${item.area.height}],
    threshold: 15
});`;
        
        return code;
    }
    
    // 更新多点找色代码显示
    updateMultiColorCode() {
        if (this.selectedMultiColorIndex === -1 || this.selectedMultiColorIndex >= this.multiColorHistory.length) {
            this.elements.multiColorCode.innerHTML = '<code>// 选择一条多点取色记录以生成代码</code>';
            this.elements.copyMultiCodeBtn.disabled = true;
            return;
        }
        
        const item = this.multiColorHistory[this.selectedMultiColorIndex];
        const code = this.generateMultiColorCode(item);
        this.elements.multiColorCode.innerHTML = `<code>${this.escapeHtml(code)}</code>`;
        this.elements.copyMultiCodeBtn.disabled = false;
    }
    
    // 复制多点找色代码
    copyMultiColorCode() {
        if (this.selectedMultiColorIndex === -1 || this.selectedMultiColorIndex >= this.multiColorHistory.length) {
            window.showStatus('请先选择一条多点取色记录', 'warning');
            return;
        }
        
        const item = this.multiColorHistory[this.selectedMultiColorIndex];
        const code = this.generateMultiColorCode(item);
        this.copyToClipboard(code, false);
        window.showStatus('多点找色代码已复制', 'success');
    }
    
    // HTML转义
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // 复制所有颜色点
    copyAllColors(index) {
        if (index < 0 || index >= this.multiColorHistory.length) return;
        
        const item = this.multiColorHistory[index];
        if (item.type !== 'area') return;
        
        // 生成复制格式：每个点用引号包裹，用逗号分隔
        const allPointsData = item.colors.map(c => `"${c.x}|${c.y}|${c.color.hex}"`).join(',');
        
        this.copyToClipboard(allPointsData, true);
    }

    // 删除单条取色记录
    deleteColorItem(index, type) {
        if (type === 'single') {
            if (index < 0 || index >= this.singleColorHistory.length) return;
            
            if (confirm('确定要删除这条单点取色记录吗？')) {
                this.singleColorHistory.splice(index, 1);
                this.updateColorHistoryUI();
                window.showStatus('单点取色记录已删除', 'success');
            }
        } else {
            if (index < 0 || index >= this.multiColorHistory.length) return;
            
            if (confirm('确定要删除这条多点取色记录吗？')) {
                this.multiColorHistory.splice(index, 1);
                // 如果删除的是当前选中的，重置选中状态
                if (index === this.selectedMultiColorIndex) {
                    this.selectedMultiColorIndex = -1;
                } else if (index < this.selectedMultiColorIndex) {
                    this.selectedMultiColorIndex--;
                }
                this.updateColorHistoryUI();
                this.updateMultiColorCode();
                window.showStatus('多点取色记录已删除', 'success');
            }
        }
    }

    // 复制到剪贴板
    async copyToClipboard(text, isMultiple = false) {
        try {
            await navigator.clipboard.writeText(text);
            // 显示复制的格式化文本
            if (isMultiple) {
                const count = (text.match(/"/g) || []).length / 2;
                window.showStatus(`已复制 ${count} 个采样点`, 'success');
            } else {
                window.showStatus(`已复制: ${text}`, 'success');
            }
        } catch (err) {
            window.showStatus('复制失败', 'error');
        }
    }

    // 获取当前模式状态
    isActive() {
        return this.isColorPickMode;
    }

    // 当有选区可用时调用
    onSelectionAvailable() {
        // 启用重新取色按钮
        if (this.elements.recolorAreaBtn) {
            this.elements.recolorAreaBtn.disabled = false;
        }
    }
}

// 导出单例
window.ColorPickerManager = new ColorPickerManager();
