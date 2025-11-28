// 截图管理模块
class ScreenshotManager {
    constructor() {
        this.elements = {};
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
    }

    // 截取屏幕
    async captureScreen() {
        const selectedDevice = window.DeviceManager.getSelectedDevice();
        if (!selectedDevice) {
            window.showStatus('请先选择设备', 'warning');
            return;
        }
        
        window.showStatus('正在截图...', 'info');
        this.elements.captureBtn.disabled = true;
        
        try {
            const result = await window.electronAPI.captureScreen(selectedDevice);
            
            if (result.success) {
                window.currentImagePath = result.imagePath;
                await window.CanvasManager.loadAndDisplayImage(result.imagePath);
                
                // 添加到历史记录
                window.HistoryManager.addToHistory(result.imagePath, result.fileName, result.timestamp);
                
                // 启用保存原图按钮和取色按钮
                this.elements.saveOriginalBtn.disabled = false;
                this.elements.colorPickBtn.disabled = false;
                
                window.showStatus('截图成功！使用鼠标在图片上框选需要裁剪的区域', 'success');
            } else {
                window.showStatus(`截图失败: ${result.error}`, 'error');
            }
        } catch (error) {
            window.showStatus(`截图失败: ${error.message}`, 'error');
        } finally {
            this.elements.captureBtn.disabled = false;
        }
    }

    // 保存裁剪后的图片
    async saveCroppedImage() {
        const cropData = window.CanvasManager.getCropData();
        if (!cropData) {
            window.showStatus('请先框选区域', 'warning');
            return;
        }
        
        window.showStatus('正在保存裁剪图片...', 'info');
        this.elements.saveCropBtn.disabled = true;
        
        try {
            const cropResult = await window.electronAPI.cropImage(window.currentImagePath, cropData);
            
            if (cropResult.success) {
                const saveResult = await window.electronAPI.saveImage(cropResult.croppedPath);
                
                if (saveResult.success) {
                    window.showStatus(`裁剪图片已保存: ${saveResult.savedPath}`, 'success');
                } else {
                    window.showStatus(`${saveResult.error}`, 'warning');
                }
            } else {
                window.showStatus(`裁剪失败: ${cropResult.error}`, 'error');
            }
        } catch (error) {
            window.showStatus(`保存失败: ${error.message}`, 'error');
        } finally {
            this.elements.saveCropBtn.disabled = false;
        }
    }

    // 保存原始图片
    async saveOriginalImage() {
        if (!window.currentImagePath) return;
        
        window.showStatus('正在保存原图...', 'info');
        this.elements.saveOriginalBtn.disabled = true;
        
        try {
            const result = await window.electronAPI.saveImage(window.currentImagePath);
            
            if (result.success) {
                window.showStatus(`原图已保存: ${result.savedPath}`, 'success');
            } else {
                window.showStatus(`${result.error}`, 'warning');
            }
        } catch (error) {
            window.showStatus(`保存失败: ${error.message}`, 'error');
        } finally {
            this.elements.saveOriginalBtn.disabled = false;
        }
    }
}

// 导出单例
window.ScreenshotManager = new ScreenshotManager();
