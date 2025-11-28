// 设备管理模块
class DeviceManager {
    constructor() {
        this.selectedDevice = null;
        this.elements = {};
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
    }

    // 刷新设备列表
    async refreshDevices(silent = false) {
        if (!silent) {
            window.showStatus('正在检查设备...', 'info');
        }
        this.elements.deviceSelect.disabled = true;
        this.elements.captureBtn.disabled = true;
        
        try {
            const result = await window.electronAPI.checkAdbDevices();
            
            if (result.success && result.devices.length > 0) {
                // 填充设备下拉列表
                this.elements.deviceSelect.innerHTML = '<option value="">选择设备</option>';
                result.devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = `${device.id} (${device.status})`;
                    this.elements.deviceSelect.appendChild(option);
                });
                this.elements.deviceSelect.disabled = false;
                if (!silent) {
                    window.showStatus(`找到 ${result.devices.length} 个设备`, 'success');
                }
            } else {
                this.elements.deviceSelect.innerHTML = '<option value="">未检测到设备</option>';
                if (!silent) {
                    window.showStatus('未检测到设备，请连接Android设备并开启USB调试', 'warning');
                }
            }
        } catch (error) {
            this.elements.deviceSelect.innerHTML = '<option value="">检查失败</option>';
            if (!silent) {
                window.showStatus(`错误: ${error.message}`, 'error');
            }
        }
    }

    // 设备选择变化
    onDeviceChange() {
        this.selectedDevice = this.elements.deviceSelect.value;
        this.elements.captureBtn.disabled = !this.selectedDevice;
        this.elements.dumpUIBtn.disabled = !this.selectedDevice;
    }

    // 获取当前选中的设备
    getSelectedDevice() {
        return this.selectedDevice;
    }
}

// 导出单例
window.DeviceManager = new DeviceManager();
