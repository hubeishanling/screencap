const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const sharp = require('sharp');
const os = require('os');

// 禁用GPU硬件加速，解决Windows上的GPU进程错误
app.disableHardwareAcceleration();

// 设置单实例锁，防止多个实例同时运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// 紧急退出处理 - 捕获所有可能的退出信号
process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号');
  process.exit(0);
});

// Windows 特定的退出处理
if (process.platform === 'win32') {
  process.on('message', (msg) => {
    if (msg === 'graceful-exit') {
      app.quit();
      setTimeout(() => process.exit(0), 500);
    }
  });
}

let mainWindow;
const tempDir = path.join(os.tmpdir(), 'screencap-electron');

// 截图保存目录（用户文档目录下）
const screenshotsDir = path.join(app.getPath('documents'), 'ADB_Screenshots');
const historyFile = path.join(app.getPath('userData'), 'screenshot-history.json');

// 使用项目中的 adb.exe
// 开发环境和打包后的路径处理
const isDev = !app.isPackaged;
const adbPath = isDev 
  ? path.join(__dirname, 'adb.exe')
  : path.join(process.resourcesPath, '..', 'adb.exe');

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    frame: true,
    backgroundColor: '#ffffff',
    show: false
  });

  // 加载应用的 index.html
  mainWindow.loadFile('index.html');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 打开开发者工具（开发时使用）
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);
  
  createWindow();

  app.on('activate', () => {
    // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，
    // 通常会重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口都关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 设置超时强制退出，防止进程卡死
    const forceQuitTimeout = setTimeout(() => {
      process.exit(0);
    }, 1000);
    
    // 尝试正常退出
    app.quit();
    
    // 如果正常退出成功，清除超时
    forceQuitTimeout.unref();
  }
});

// 应用退出前的清理工作
app.on('before-quit', (event) => {
  // 立即终止所有 ADB 子进程
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /IM adb.exe /T 2>nul', { 
        stdio: 'ignore',
        timeout: 500
      });
    } catch (err) {
      // 忽略错误
    }
  }
  
  // 快速清理临时文件（不阻塞退出）
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.slice(0, 10).forEach(file => {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch (err) {
          // 忽略
        }
      });
    }
  } catch (err) {
    // 忽略
  }
});

// 强制退出处理 - 最后的保险
app.on('will-quit', () => {
  // 再次确保 ADB 进程被终止
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /IM adb.exe /T 2>nul', { 
        stdio: 'ignore',
        timeout: 300
      });
    } catch (err) {
      // 忽略
    }
  }
  
  // 设置最终的强制退出
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// 确保目录存在
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// IPC 通信示例
ipcMain.handle('ping', async () => {
  return 'pong';
});

ipcMain.handle('get-app-info', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform
  };
});

// 检查ADB设备
ipcMain.handle('check-adb-devices', async () => {
  try {
    const output = execSync(`"${adbPath}" devices`, { encoding: 'utf-8' });
    const lines = output.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
    
    const devices = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        id: parts[0],
        status: parts[1] || 'unknown'
      };
    }).filter(device => device.status === 'device');
    
    return { success: true, devices };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('connect-device', async (event, address) => {
  try {
    if (!address || typeof address !== 'string') {
      return { success: false, error: '无效的地址' };
    }
    const output = execSync(`"${adbPath}" connect ${address}`, {
      encoding: 'utf-8',
      timeout: 5000
    });
    return { success: true, message: output.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pair-device', async (event, address, code) => {
  try {
    if (!address || typeof address !== 'string' || !code || typeof code !== 'string') {
      return { success: false, error: '参数无效' };
    }
    try {
      execSync(`"${adbPath}" start-server`, { encoding: 'utf-8', timeout: 7000 });
    } catch (_) {}
    const output = execSync(`"${adbPath}" pair ${address} ${code}`, {
      encoding: 'utf-8',
      timeout: 15000
    });
    return { success: true, message: output.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 扫描网络和USB设备
ipcMain.handle('scan-all-devices', async () => {
  try {
    const allDevices = [];
    
    // 1. 扫描USB设备
    try {
      const usbOutput = execSync(`"${adbPath}" devices`, { encoding: 'utf-8' });
      const usbLines = usbOutput.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
      
      const usbDevices = usbLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          id: parts[0],
          status: parts[1] || 'unknown',
          type: 'USB',
          displayName: `${parts[0]} (USB)`
        };
      }).filter(device => device.status === 'device');
      
      allDevices.push(...usbDevices);
    } catch (err) {
      console.error('USB设备扫描失败:', err);
    }
    
    // 2. 扫描局域网中的 AutoJs6 设备（HTTP 发现）
    try {
      const networkDevices = await scanNetworkDevices();
      allDevices.push(...networkDevices);
    } catch (err) {
      console.error('网络设备扫描失败:', err);
    }
    
    // 3. 扫描WiFi设备（使用 adb mdns services）
    try {
      const mdnsOutput = execSync(`"${adbPath}" mdns services`, { 
        encoding: 'utf-8',
        timeout: 5000 
      });
      
      const mdnsLines = mdnsOutput.split('\n').filter(line => line.trim());
      
      // 解析mdns输出，格式类似：
      // adb-XXXXXX-YYYYYY._adb-tls-connect._tcp	192.168.1.100:5555
      const wifiDevices = [];
      for (const line of mdnsLines) {
        const match = line.match(/adb-([^\s]+)\._adb[^\s]*\s+([0-9.]+):(\d+)/);
        if (match) {
          const deviceId = match[1];
          const ip = match[2];
          const port = match[3];
          const address = `${ip}:${port}`;
          
          // 尝试连接该设备
          try {
            execSync(`"${adbPath}" connect ${address}`, { 
              encoding: 'utf-8',
              timeout: 3000 
            });
            
            wifiDevices.push({
              id: address,
              status: 'device',
              type: 'WiFi',
              displayName: `${ip}:${port} (WiFi)`
            });
          } catch (connectErr) {
            // 连接失败，跳过
          }
        }
      }
      
      allDevices.push(...wifiDevices);
    } catch (err) {
      console.error('WiFi设备扫描失败:', err);
    }
    
    // 去重（同一设备可能同时有USB和WiFi连接）
    const uniqueDevices = [];
    const deviceIds = new Set();
    
    for (const device of allDevices) {
      if (!deviceIds.has(device.id)) {
        deviceIds.add(device.id);
        uniqueDevices.push(device);
      }
    }
    
    return { 
      success: true, 
      devices: uniqueDevices,
      count: {
        total: uniqueDevices.length,
        usb: allDevices.filter(d => d.type === 'USB').length,
        wifi: allDevices.filter(d => d.type === 'WiFi').length,
        network: allDevices.filter(d => d.type === 'Network').length
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 扫描局域网中的 AutoJs6 设备
async function scanNetworkDevices() {
  const http = require('http');
  const networkDevices = [];
  
  // 获取本机 IP 地址
  const localIp = getLocalIpAddress();
  if (!localIp) {
    console.log('无法获取本机IP地址');
    return networkDevices;
  }
  
  // 提取网段 (例如: 192.168.1.x)
  const ipParts = localIp.split('.');
  if (ipParts.length !== 4) {
    return networkDevices;
  }
  
  const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
  console.log(`扫描网段: ${subnet}.0/24`);
  
  // 并发扫描 IP 范围 (1-254)
  const scanPromises = [];
  const DISCOVERY_PORT = 9999;
  const TIMEOUT = 1000; // 1秒超时
  
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    
    // 跳过本机 IP
    if (ip === localIp) {
      continue;
    }
    
    const promise = new Promise((resolve) => {
      const options = {
        host: ip,
        port: DISCOVERY_PORT,
        path: '/',
        method: 'GET',
        timeout: TIMEOUT
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const deviceInfo = JSON.parse(data);
            if (deviceInfo.type === 'autojs6') {
              // 尝试通过 ADB 连接到该设备
              const adbAddress = `${deviceInfo.ip}:${deviceInfo.adbPort || 5555}`;
              
              try {
                execSync(`"${adbPath}" connect ${adbAddress}`, { 
                  encoding: 'utf-8',
                  timeout: 2000,
                  stdio: 'ignore'
                });
                
                resolve({
                  id: adbAddress,
                  status: 'device',
                  type: 'Network',
                  displayName: `${deviceInfo.deviceName || deviceInfo.deviceModel} (${deviceInfo.ip})`,
                  deviceInfo: deviceInfo
                });
              } catch (connectErr) {
                // 连接失败，但仍然记录设备
                resolve({
                  id: adbAddress,
                  status: 'offline',
                  type: 'Network',
                  displayName: `${deviceInfo.deviceName || deviceInfo.deviceModel} (${deviceInfo.ip}) [未连接]`,
                  deviceInfo: deviceInfo
                });
              }
            } else {
              resolve(null);
            }
          } catch (err) {
            resolve(null);
          }
        });
      });
      
      req.on('error', () => {
        resolve(null);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      
      req.end();
    });
    
    scanPromises.push(promise);
  }
  
  // 等待所有扫描完成
  const results = await Promise.all(scanPromises);
  
  // 过滤出有效设备
  for (const device of results) {
    if (device && device.status === 'device') {
      networkDevices.push(device);
    }
  }
  
  console.log(`找到 ${networkDevices.length} 个网络设备`);
  return networkDevices;
}

// 获取本机 IP 地址
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部（即本地回环）和非 IPv4 地址
      if (iface.family === 'IPv4' && !iface.internal) {
        // 优先返回 192.168.x.x 的地址
        if (iface.address.startsWith('192.168.')) {
          return iface.address;
        }
      }
    }
  }
  
  // 如果没有 192.168.x.x，返回第一个有效的 IPv4 地址
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return null;
}

// ADB截图
ipcMain.handle('capture-screen', async (event, deviceId) => {
  try {
    const timestamp = Date.now();
    const devicePath = '/sdcard/screenshot.png';
    
    // 生成随机文件名
    const randomId = generateRandomId(8);
    const fileName = `screenshot_${randomId}.png`;
    const savePath = path.join(screenshotsDir, fileName);
    
    // 构建ADB命令，如果有设备ID则使用 -s 参数指定设备
    const adbPrefix = deviceId ? `"${adbPath}" -s ${deviceId}` : `"${adbPath}"`;
    
    // 在设备上截图
    execSync(`${adbPrefix} shell screencap -p ${devicePath}`, { encoding: 'utf-8' });
    
    // 拉取到本地保存目录
    execSync(`${adbPrefix} pull ${devicePath} "${savePath}"`, { encoding: 'utf-8' });
    
    // 删除设备上的截图
    execSync(`${adbPrefix} shell rm ${devicePath}`, { encoding: 'utf-8' });
    
    return { 
      success: true, 
      imagePath: savePath,
      fileName: fileName,
      timestamp: new Date().toLocaleString('zh-CN')
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 生成随机ID
function generateRandomId(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 裁剪图片
ipcMain.handle('crop-image', async (event, imagePath, cropData) => {
  try {
    const { x, y, width, height } = cropData;
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `cropped_${timestamp}.png`);
    
    await sharp(imagePath)
      .extract({ 
        left: Math.round(x), 
        top: Math.round(y), 
        width: Math.round(width), 
        height: Math.round(height) 
      })
      .toFile(outputPath);
    
    return { success: true, croppedPath: outputPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 保存图片
ipcMain.handle('save-image', async (event, sourcePath) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存图片',
      defaultPath: path.join(app.getPath('pictures'), `screenshot_${Date.now()}.png`),
      filters: [
        { name: 'PNG图片', extensions: ['png'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, savedPath: result.filePath };
    }
    
    return { success: false, error: '用户取消保存' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 显示保存对话框
ipcMain.handle('show-save-dialog', async (event, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});

// 保存历史记录
ipcMain.handle('save-history', async (event, historyData) => {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 加载历史记录
ipcMain.handle('load-history', async () => {
  try {
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf-8');
      const history = JSON.parse(data);
      
      // 验证文件是否还存在
      const validHistory = history.filter(item => {
        return fs.existsSync(item.path);
      });
      
      return { success: true, history: validHistory };
    }
    return { success: true, history: [] };
  } catch (error) {
    return { success: false, error: error.message, history: [] };
  }
});

// 获取截图保存目录
ipcMain.handle('get-screenshots-dir', async () => {
  return { success: true, path: screenshotsDir };
});

// 读取节点XML文件
ipcMain.handle('load-ui-xml', async (event, xmlPath) => {
  try {
    if (!fs.existsSync(xmlPath)) {
      return { success: false, error: '节点数据文件不存在' };
    }
    
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    return { 
      success: true, 
      xmlContent: xmlContent
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 获取UI层级结构（节点抓取）
ipcMain.handle('dump-ui-hierarchy', async (event, deviceId) => {
  try {
    const timestamp = Date.now();
    const devicePath = '/sdcard/window_dump.xml';
    const deviceScreenPath = '/sdcard/screenshot.png';
    
    // 生成随机文件名
    const randomId = generateRandomId(8);
    const xmlFileName = `ui_dump_${randomId}.xml`;
    const screenshotFileName = `screenshot_${randomId}.png`;
    const xmlPath = path.join(screenshotsDir, xmlFileName);
    const screenshotPath = path.join(screenshotsDir, screenshotFileName);
    
    // 构建ADB命令，如果有设备ID则使用 -s 参数指定设备
    const adbPrefix = deviceId ? `"${adbPath}" -s ${deviceId}` : `"${adbPath}"`;
    
    // 同时截图和导出UI层级
    execSync(`${adbPrefix} shell screencap -p ${deviceScreenPath}`, { encoding: 'utf-8' });
    execSync(`${adbPrefix} shell uiautomator dump ${devicePath}`, { encoding: 'utf-8' });
    
    // 拉取截图和XML到本地
    execSync(`${adbPrefix} pull ${deviceScreenPath} "${screenshotPath}"`, { encoding: 'utf-8' });
    execSync(`${adbPrefix} pull ${devicePath} "${xmlPath}"`, { encoding: 'utf-8' });
    
    // 删除设备上的文件
    try {
      execSync(`${adbPrefix} shell rm ${deviceScreenPath}`, { encoding: 'utf-8' });
      execSync(`${adbPrefix} shell rm ${devicePath}`, { encoding: 'utf-8' });
    } catch (err) {
      // 忽略删除失败
    }
    
    // 读取XML文件内容
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    
    return { 
      success: true, 
      xmlContent: xmlContent,
      xmlPath: xmlPath,
      xmlFileName: xmlFileName,
      screenshotPath: screenshotPath,
      screenshotFileName: screenshotFileName,
      timestamp: new Date().toLocaleString('zh-CN')
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 导出取色数据
ipcMain.handle('export-color-data', async (event, colorData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出取色数据',
      defaultPath: path.join(app.getPath('documents'), `color_data_${Date.now()}.json`),
      filters: [
        { name: 'JSON文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(colorData, null, 2), 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, error: '用户取消导出' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
