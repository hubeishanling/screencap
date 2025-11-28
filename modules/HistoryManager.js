// 历史记录管理模块
class HistoryManager {
    constructor() {
        this.historyData = [];
        this.elements = {};
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
    }

    // 从磁盘加载历史记录
    async loadHistoryFromDisk() {
        try {
            const result = await window.electronAPI.loadHistory();
            if (result.success && result.history) {
                this.historyData = result.history;
                this.updateHistoryList();
                
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
    async saveHistoryToDisk() {
        try {
            await window.electronAPI.saveHistory(this.historyData);
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }

    // 添加到历史记录
    addToHistory(imagePath, fileName, timestamp, xmlPath = null, xmlFileName = null) {
        const historyItem = {
            path: imagePath,
            timestamp: timestamp,
            fileName: fileName,
            id: Date.now(),
            xmlPath: xmlPath,  // 节点数据路径
            xmlFileName: xmlFileName,  // 节点数据文件名
            hasNodes: !!xmlPath  // 标记是否有节点数据
        };
        
        this.historyData.unshift(historyItem);
        
        // 限制历史记录数量
        if (this.historyData.length > 50) {
            this.historyData = this.historyData.slice(0, 50);
        }
        
        this.updateHistoryList();
        this.saveHistoryToDisk();
    }

    // 更新历史记录列表
    updateHistoryList() {
        if (this.historyData.length === 0) {
            this.elements.historyList.innerHTML = '<p class="empty-state">暂无截图记录</p>';
            return;
        }
        
        this.elements.historyList.innerHTML = '';
        
        this.historyData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            if (index === 0) div.classList.add('active');
            
            // 添加节点数据标识
            const nodesBadge = item.hasNodes ? ' ' : '';
            
            div.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-name">${nodesBadge}${item.fileName}</div>
                    <div class="history-item-time">${item.timestamp}</div>
                </div>
            `;
            
            div.addEventListener('click', () => {
                this.loadHistoryItem(item);
                // 更新激活状态
                this.elements.historyList.querySelectorAll('.history-item').forEach(el => {
                    el.classList.remove('active');
                });
                div.classList.add('active');
            });
            
            this.elements.historyList.appendChild(div);
        });
    }

    // 加载历史记录项
    async loadHistoryItem(item) {
        window.currentImagePath = item.path;
        await window.CanvasManager.loadAndDisplayImage(item.path);
        this.elements.saveOriginalBtn.disabled = false;
        this.elements.colorPickBtn.disabled = false; // 启用取色按钮
        
        // 重置节点详情
        if (window.NodeManager) {
            window.NodeManager.clearNodeDetails();
        }
        
        // 如果有节点数据，加载并显示节点树
        if (item.hasNodes && item.xmlPath) {
            try {
                const result = await window.electronAPI.loadUIXml(item.xmlPath);
                
                if (result.success) {
                    // 解析XML数据并渲染
                    await window.NodeManager.loadUIXmlContent(result.xmlContent);
                    window.showStatus('已加载历史截图和节点信息 - 可点击图片查找对应节点', 'success');
                } else {
                    window.showStatus('已加载历史截图（节点数据加载失败）', 'warning');
                    window.NodeManager.clearNodesTree('节点数据文件不存在或已被删除');
                }
            } catch (error) {
                console.error('加载节点数据失败:', error);
                window.showStatus('已加载历史截图（节点数据加载失败）', 'warning');
                window.NodeManager.clearNodesTree('节点数据加载失败');
            }
        } else {
            // 没有节点数据，清空节点树
            window.NodeManager.clearNodesTree('该截图没有节点信息');
            window.showStatus('已加载历史截图', 'success');
        }
    }

    // 清空历史记录
    clearHistory() {
        if (this.historyData.length === 0) return;
        
        if (confirm('确定要清空所有历史记录吗？\n注意：这不会删除已保存的截图文件。')) {
            this.historyData = [];
            this.updateHistoryList();
            this.saveHistoryToDisk();
            window.showStatus('历史记录已清空', 'success');
        }
    }
}

// 导出单例
window.HistoryManager = new HistoryManager();
