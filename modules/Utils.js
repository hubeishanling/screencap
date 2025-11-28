// 工具函数模块
class Utils {
    constructor() {
        this.statusElement = null;
    }

    // 初始化状态消息元素
    initStatusElement(element) {
        this.statusElement = element;
    }

    // 显示状态消息
    showStatus(message, type = 'info') {
        if (!this.statusElement) return;
        
        this.statusElement.textContent = message;
        this.statusElement.className = `status-message ${type}`;
        
        // 自动隐藏成功消息
        if (type === 'success') {
            setTimeout(() => {
                this.statusElement.className = 'status-message';
            }, 5000);
        }
    }

    // 生成随机ID
    generateRandomId(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// 导出单例并设置全局快捷方法
window.Utils = new Utils();
window.showStatus = (message, type) => window.Utils.showStatus(message, type);
