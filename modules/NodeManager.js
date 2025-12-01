// 节点管理模块
class NodeManager {
    constructor() {
        this.uiHierarchyData = null;
        this.selectedNode = null;
        this.elements = {};
        this.isResizingNodes = false;
    }

    // 初始化元素引用
    initElements(elements) {
        this.elements = elements;
        // 添加节点分隔条元素引用
        this.elements.nodeResizer = document.getElementById('node-resizer');
        this.elements.nodesTreeContainer = document.querySelector('.nodes-tree-container');
        this.elements.nodeDetailsContainer = document.querySelector('.node-details-container');
    }

    // 设置事件监听器
    setupEventListeners() {
        this.elements.nodeSearch.addEventListener('input', this.onNodeSearch.bind(this));
        this.elements.expandAllBtn.addEventListener('click', this.expandAllNodes.bind(this));
        this.elements.collapseAllBtn.addEventListener('click', this.collapseAllNodes.bind(this));
        
        // 节点分隔条拖动
        if (this.elements.nodeResizer) {
            this.elements.nodeResizer.addEventListener('mousedown', this.startNodeResize.bind(this));
        }
    }

    // 抓取UI层级结构
    async dumpUIHierarchy() {
        const selectedDevice = window.DeviceManager.getSelectedDevice();
        if (!selectedDevice) {
            window.showStatus('请先选择设备', 'warning');
            return;
        }
        
        window.showStatus('正在抓取UI层级信息和截图...', 'info');
        this.elements.dumpUIBtn.disabled = true;
        
        try {
            const result = await window.electronAPI.dumpUIHierarchy(selectedDevice);
            
            if (result.success) {
                // 保存当前截图路径
                window.currentImagePath = result.screenshotPath;
                
                // 加载并显示截图
                await window.CanvasManager.loadAndDisplayImage(window.currentImagePath);
                
                // 解析并渲染节点树
                await this.loadUIXmlContent(result.xmlContent);
                
                // 添加到历史记录
                window.HistoryManager.addToHistory(
                    result.screenshotPath, 
                    result.screenshotFileName, 
                    result.timestamp, 
                    result.xmlPath, 
                    result.xmlFileName
                );
                
                // 切换到节点信息标签页
                window.UIManager.switchTab('nodes');
                
                // 启用保存原图按钮
                this.elements.saveOriginalBtn.disabled = false;
                
                window.showStatus('UI层级信息和截图抓取成功！点击节点可在图片上查看位置', 'success');
            } else {
                window.showStatus(`抓取失败: ${result.error}`, 'error');
            }
        } catch (error) {
            window.showStatus(`抓取失败: ${error.message}`, 'error');
        } finally {
            this.elements.dumpUIBtn.disabled = false;
        }
    }

    // 加载并解析XML内容
    async loadUIXmlContent(xmlContent) {
        try {
            // 解析XML数据
            this.uiHierarchyData = this.parseUIXML(xmlContent);
            
            // 渲染节点树
            this.renderNodesTree(this.uiHierarchyData);
        } catch (error) {
            console.error('解析XML失败:', error);
            this.clearNodesTree('XML解析失败');
            throw error;
        }
    }

    // 解析UI层级XML
    parseUIXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML解析失败');
        }
        
        // 递归解析节点
        const parseNode = (xmlNode, depth = 0) => {
            const nodeData = {
                tag: xmlNode.tagName,
                attributes: {},
                children: [],
                depth: depth,
                id: this.generateRandomId(8)
            };
            
            // 提取所有属性
            for (let i = 0; i < xmlNode.attributes.length; i++) {
                const attr = xmlNode.attributes[i];
                nodeData.attributes[attr.name] = attr.value;
            }
            
            // 解析子节点
            for (let i = 0; i < xmlNode.children.length; i++) {
                const childNode = parseNode(xmlNode.children[i], depth + 1);
                nodeData.children.push(childNode);
            }
            
            return nodeData;
        };
        
        const rootNode = xmlDoc.documentElement;
        return parseNode(rootNode);
    }

    // 渲染节点树
    renderNodesTree(nodeData) {
        this.elements.nodesTree.innerHTML = '';
        
        if (!nodeData) {
            this.elements.nodesTree.innerHTML = '<p class="empty-state">无节点数据</p>';
            return;
        }
        
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-root';
        
        // 递归渲染节点
        const renderNode = (node, parentElement) => {
            const nodeItem = document.createElement('div');
            nodeItem.className = 'tree-node';
            nodeItem.dataset.nodeId = node.id;
            nodeItem.dataset.depth = node.depth;
            nodeItem._nodeData = node;
            
            const nodeContent = document.createElement('div');
            nodeContent.className = 'tree-node-content';
            
            // 缩进
            const indent = document.createElement('span');
            indent.className = 'tree-indent';
            indent.style.width = (node.depth * 20) + 'px';
            
            // 展开/折叠按钮
            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            if (node.children.length > 0) {
                toggle.textContent = '▶';
                toggle.classList.add('has-children');
            } else {
                toggle.textContent = '•';
            }
            
            // 节点标签
            const label = document.createElement('span');
            label.className = 'tree-label';
            
            let displayText = node.tag;
            const resId = node.attributes['resource-id'] || '';
            const text = node.attributes['text'] || '';
            const className = node.attributes['class'] || '';
            
            if (resId) {
                displayText += ` [${resId.split('/').pop()}]`;
            }
            if (text && text.length < 20) {
                displayText += ` "${text}"`;
            }
            if (!resId && className) {
                displayText += ` (${className.split('.').pop()})`;
            }
            
            label.textContent = displayText;
            
            nodeContent.appendChild(indent);
            nodeContent.appendChild(toggle);
            nodeContent.appendChild(label);
            nodeItem.appendChild(nodeContent);
            
            // 点击展开/折叠
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (node.children.length > 0) {
                    nodeItem.classList.toggle('expanded');
                    toggle.textContent = nodeItem.classList.contains('expanded') ? '▼' : '▶';
                }
            });
            
            // 点击选中节点
            nodeContent.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectNode(node, nodeItem);
            });
            
            parentElement.appendChild(nodeItem);
            
            // 渲染子节点
            if (node.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                nodeItem.appendChild(childrenContainer);
                
                node.children.forEach(child => {
                    renderNode(child, childrenContainer);
                });
            }
        };
        
        renderNode(nodeData, treeContainer);
        this.elements.nodesTree.appendChild(treeContainer);
    }

    // 选中节点
    selectNode(node, nodeElement) {
        this.selectedNode = node;
        
        // 更新选中状态
        this.elements.nodesTree.querySelectorAll('.tree-node').forEach(el => {
            el.classList.remove('selected');
        });
        nodeElement.classList.add('selected');
        
        // 显示节点详情
        this.displayNodeDetails(node);
        
        // 在图片上高亮显示
        this.highlightNodeOnImage(node);
    }

    // 显示节点详情
    displayNodeDetails(node) {
        if (!node) {
            this.elements.nodeDetails.innerHTML = '<p class="empty-state">请在左侧树中选择节点</p>';
            return;
        }
        
        let html = '<div class="node-details-content">';
        
        html += `<div class="detail-item"><strong>tag:</strong> <span>${node.tag}</span></div>`;
        
        // Android UI Automator 标准属性（按 uiautomator dump 输出顺序）
        const importantAttrs = [
            'index', 'text', 'resource-id', 'class', 'package', 'content-desc',
            'checkable', 'checked', 'clickable', 'enabled', 'focusable', 'focused', 
            'scrollable', 'long-clickable', 'password', 'selected', 'bounds'
        ];
        
        for (const attr of importantAttrs) {
            if (node.attributes[attr] !== undefined) {
                let value = node.attributes[attr];
                if (attr === 'bounds') {
                    value = `<code>${value}</code>`;
                }
                html += `<div class="detail-item"><strong>${attr}:</strong> <span>${value}</span></div>`;
            }
        }
        
        // 显示其他所有未列出的属性
        for (const attr in node.attributes) {
            if (!importantAttrs.includes(attr)) {
                html += `<div class="detail-item"><strong>${attr}:</strong> <span>${node.attributes[attr]}</span></div>`;
            }
        }
        
        html += `<div class="detail-item"><strong>children-count:</strong> <span>${node.children.length}</span></div>`;
        html += '</div>';
        
        this.elements.nodeDetails.innerHTML = html;
    }

    // 节点搜索
    onNodeSearch(e) {
        const searchText = e.target.value.toLowerCase().trim();
        
        this.selectedNode = null;
        this.elements.nodesTree.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        this.elements.nodeDetails.innerHTML = '<p class="empty-state">请在左侧树中选择节点</p>';
        this.elements.nodeHighlightOverlay.style.display = 'none';
        
        if (!searchText) {
            this.elements.nodesTree.querySelectorAll('.tree-node').forEach(node => {
                node.style.display = '';
                node.classList.remove('search-match');
            });
            return;
        }
        
        // 搜索并高亮匹配的节点
        this.elements.nodesTree.querySelectorAll('.tree-node').forEach(nodeElement => {
            const nodeData = nodeElement._nodeData;
            if (!nodeData) return;
            
            const matches = 
                nodeData.tag.toLowerCase().includes(searchText) ||
                (nodeData.attributes['resource-id'] || '').toLowerCase().includes(searchText) ||
                (nodeData.attributes['text'] || '').toLowerCase().includes(searchText) ||
                (nodeData.attributes['content-desc'] || '').toLowerCase().includes(searchText) ||
                (nodeData.attributes['class'] || '').toLowerCase().includes(searchText) ||
                (nodeData.attributes['package'] || '').toLowerCase().includes(searchText);
            
            if (matches) {
                nodeElement.style.display = '';
                nodeElement.classList.add('search-match');
                
                // 展开父节点
                let parent = nodeElement.parentElement;
                while (parent && parent.classList.contains('tree-children')) {
                    const parentNode = parent.parentElement;
                    if (parentNode && parentNode.classList.contains('tree-node')) {
                        parentNode.classList.add('expanded');
                        parentNode.style.display = '';
                        const toggle = parentNode.querySelector('.tree-toggle');
                        if (toggle) toggle.textContent = '▼';
                    }
                    parent = parentNode ? parentNode.parentElement : null;
                }
            } else {
                nodeElement.style.display = 'none';
                nodeElement.classList.remove('search-match');
            }
        });
    }

    // 展开所有节点
    expandAllNodes() {
        this.elements.nodesTree.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.tree-toggle.has-children')) {
                node.classList.add('expanded');
                const toggle = node.querySelector('.tree-toggle');
                if (toggle) toggle.textContent = '▼';
            }
        });
    }

    // 折叠所有节点
    collapseAllNodes() {
        this.elements.nodesTree.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('expanded');
            const toggle = node.querySelector('.tree-toggle');
            if (toggle && toggle.classList.contains('has-children')) {
                toggle.textContent = '▶';
            }
        });
    }

    // 在图片上高亮显示节点
    highlightNodeOnImage(node) {
        if (!window.currentImageData) {
            this.hideNodeHighlight();
            return;
        }
        
        const bounds = node.attributes['bounds'];
        if (!bounds) {
            this.hideNodeHighlight();
            return;
        }
        
        const boundsRect = this.parseBounds(bounds);
        if (!boundsRect) {
            this.hideNodeHighlight();
            return;
        }
        
        const scaleInfo = window.CanvasManager.getScaleInfo();
        const displayRect = {
            x: boundsRect.x * scaleInfo.totalScale,
            y: boundsRect.y * scaleInfo.totalScale,
            width: boundsRect.width * scaleInfo.totalScale,
            height: boundsRect.height * scaleInfo.totalScale
        };
        
        this.elements.nodeHighlightBox.style.left = displayRect.x + 'px';
        this.elements.nodeHighlightBox.style.top = displayRect.y + 'px';
        this.elements.nodeHighlightBox.style.width = displayRect.width + 'px';
        this.elements.nodeHighlightBox.style.height = displayRect.height + 'px';
        this.elements.nodeHighlightOverlay.style.display = 'block';
    }

    // 隐藏节点高亮
    hideNodeHighlight() {
        if (this.elements.nodeHighlightOverlay) {
            this.elements.nodeHighlightOverlay.style.display = 'none';
        }
    }

    // 解析bounds字符串
    parseBounds(boundsStr) {
        try {
            const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            if (!match) return null;
            
            const x1 = parseInt(match[1]);
            const y1 = parseInt(match[2]);
            const x2 = parseInt(match[3]);
            const y2 = parseInt(match[4]);
            
            return {
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1
            };
        } catch (error) {
            console.error('解析bounds失败:', error);
            return null;
        }
    }

    // 查找包含指定坐标的节点
    findNodeByCoordinates(x, y, node = this.uiHierarchyData, depth = 0) {
        if (!node) return null;
        
        const bounds = node.attributes['bounds'];
        
        // 如果没有bounds，在子节点中查找
        if (!bounds) {
            if (node.children && node.children.length > 0) {
                let bestMatch = null;
                let minArea = Infinity;
                
                for (let child of node.children) {
                    const foundChild = this.findNodeByCoordinates(x, y, child, depth + 1);
                    if (foundChild) {
                        const childBounds = foundChild.attributes['bounds'];
                        if (childBounds) {
                            const childRect = this.parseBounds(childBounds);
                            if (childRect) {
                                const area = childRect.width * childRect.height;
                                if (area < minArea) {
                                    minArea = area;
                                    bestMatch = foundChild;
                                }
                            }
                        }
                    }
                }
                return bestMatch;
            }
            return null;
        }
        
        const rect = this.parseBounds(bounds);
        if (!rect) return null;
        
        // 检查坐标是否在当前节点范围内
        if (x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height) {
            
            let bestMatch = node;
            let minArea = rect.width * rect.height;
            
            if (node.children && node.children.length > 0) {
                for (let child of node.children) {
                    const foundChild = this.findNodeByCoordinates(x, y, child, depth + 1);
                    if (foundChild) {
                        const childBounds = foundChild.attributes['bounds'];
                        if (childBounds) {
                            const childRect = this.parseBounds(childBounds);
                            if (childRect) {
                                const area = childRect.width * childRect.height;
                                if (area < minArea) {
                                    minArea = area;
                                    bestMatch = foundChild;
                                }
                            }
                        }
                    }
                }
            }
            
            return bestMatch;
        }
        
        return null;
    }

    // 在树中展开并选中节点
    expandAndSelectNodeInTree(targetNode) {
        if (!targetNode) return;
        
        const pathToNode = [];
        
        const findPath = (node, path = []) => {
            if (node.id === targetNode.id) {
                pathToNode.push(...path);
                return true;
            }
            
            if (node.children && node.children.length > 0) {
                for (let child of node.children) {
                    if (findPath(child, [...path, node])) {
                        return true;
                    }
                }
            }
            
            return false;
        };
        
        if (this.uiHierarchyData) {
            findPath(this.uiHierarchyData);
        }
        
        // 展开所有父节点
        pathToNode.forEach(parentNode => {
            const nodeElement = this.elements.nodesTree.querySelector(`[data-node-id="${parentNode.id}"]`);
            if (nodeElement) {
                nodeElement.classList.add('expanded');
                const toggle = nodeElement.querySelector('.tree-toggle');
                if (toggle && toggle.classList.contains('has-children')) {
                    toggle.textContent = '▼';
                }
            }
        });
        
        // 选中目标节点
        const targetElement = this.elements.nodesTree.querySelector(`[data-node-id="${targetNode.id}"]`);
        if (targetElement) {
            this.selectNode(targetNode, targetElement);
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.UIManager.switchTab('nodes');
        }
    }

    // 清空节点树
    clearNodesTree(message = '请点击"抓取节点"按钮获取UI层级信息') {
        this.uiHierarchyData = null;
        this.selectedNode = null;
        this.elements.nodesTree.innerHTML = `<p class="empty-state">${message}</p>`;
        this.hideNodeHighlight();
    }

    // 清空节点详情
    clearNodeDetails() {
        this.selectedNode = null;
        if (this.elements.nodeDetails) {
            this.elements.nodeDetails.innerHTML = '<p class="empty-state">请在左侧树中选择节点</p>';
        }
        // 移除所有节点的选中状态
        if (this.elements.nodesTree) {
            this.elements.nodesTree.querySelectorAll('.tree-node').forEach(node => {
                node.classList.remove('selected');
            });
        }
        // 隐藏高亮框
        this.hideNodeHighlight();
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

    // 开始拖动调整节点树和详情的大小
    startNodeResize(e) {
        this.isResizingNodes = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', this.doNodeResize.bind(this));
        document.addEventListener('mouseup', this.stopNodeResize.bind(this));
        
        e.preventDefault();
    }

    // 执行调整大小
    doNodeResize(e) {
        if (!this.isResizingNodes) return;
        
        const nodesPanel = this.elements.nodesPanel;
        if (!nodesPanel) return;
        
        const panelRect = nodesPanel.getBoundingClientRect();
        const mouseY = e.clientY;
        const relativeY = mouseY - panelRect.top;
        
        // 计算新的flex值比例
        const totalHeight = panelRect.height;
        const treeHeight = relativeY - 5; // 减去分隔条高度的一半
        const detailsHeight = totalHeight - relativeY - 5;
        
        // 设置最小高度限制
        const minHeight = 150;
        if (treeHeight < minHeight || detailsHeight < minHeight) {
            return;
        }
        
        // 计算flex比例
        const treeFlex = treeHeight / totalHeight * 5; // 5是总flex（原来是3+2）
        const detailsFlex = detailsHeight / totalHeight * 5;
        
        this.elements.nodesTreeContainer.style.flex = treeFlex;
        this.elements.nodeDetailsContainer.style.flex = detailsFlex;
    }

    // 停止拖动调整大小
    stopNodeResize() {
        this.isResizingNodes = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        document.removeEventListener('mousemove', this.doNodeResize.bind(this));
        document.removeEventListener('mouseup', this.stopNodeResize.bind(this));
    }
}

// 导出单例
window.NodeManager = new NodeManager();
