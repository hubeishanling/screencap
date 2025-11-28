const { contextBridge, ipcRenderer } = require('electron');

// 将受保护的方法暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // ADB截图相关
  checkAdbDevices: () => ipcRenderer.invoke('check-adb-devices'),
  captureScreen: (deviceId) => ipcRenderer.invoke('capture-screen', deviceId),
  
  // 图片裁剪和保存
  cropImage: (imagePath, cropData) => ipcRenderer.invoke('crop-image', imagePath, cropData),
  saveImage: (sourcePath) => ipcRenderer.invoke('save-image', sourcePath),
  
  // 文件对话框
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // 历史记录
  saveHistory: (historyData) => ipcRenderer.invoke('save-history', historyData),
  loadHistory: () => ipcRenderer.invoke('load-history'),
  getScreenshotsDir: () => ipcRenderer.invoke('get-screenshots-dir'),
  
  // UI节点抓取
  dumpUIHierarchy: (deviceId) => ipcRenderer.invoke('dump-ui-hierarchy', deviceId),
  loadUIXml: (xmlPath) => ipcRenderer.invoke('load-ui-xml', xmlPath),
  
  // 取色功能
  exportColorData: (colorData) => ipcRenderer.invoke('export-color-data', colorData)
});
