# ADB截图工具 - 打包说明

## 📦 打包步骤

### 1. 安装依赖
```bash
npm install
```

这会安装 `electron-builder` 打包工具。

### 2. 打包成 exe 文件
```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run build:win
```

或者使用：
```bash
npm run build
```

### 3. 查找打包结果
打包完成后，文件会在 `dist` 目录中：
- **绿色便携版**: `dist/ADB截图工具 1.0.0.exe` - 双击直接运行，无需安装
- **压缩包版本**: `dist/ADB截图工具-1.0.0-win.zip` - 解压后运行

## 📁 必需文件

确保项目根目录包含以下 ADB 文件：
- ✅ `adb.exe`
- ✅ `AdbWinApi.dll`
- ✅ `AdbWinUsbApi.dll`

这些文件会自动打包到最终的 exe 中。

## 🎯 打包配置说明

### package.json 配置项：

- **productName**: "ADB截图工具" - 应用显示名称
- **appId**: "com.screencap.app" - 应用唯一标识
- **output**: "dist" - 输出目录
- **extraFiles**: 额外打包的 ADB 文件

### 打包格式说明：

- **portable**: 绿色便携版，单个 exe 文件，双击即可运行
- **zip**: 压缩包版本，解压后运行，包含所有依赖文件

## 🔧 自定义配置

### 修改应用图标
1. 准备一个 `.ico` 文件（256x256 或更大）
2. 放在 `assets/icon.ico`
3. 重新打包

### 修改应用名称
在 `package.json` 中修改：
```json
"productName": "你的应用名称"
```

### 修改版本号
在 `package.json` 中修改：
```json
"version": "1.0.0"
```

## 📝 注意事项

1. **首次打包**可能需要下载一些依赖，请耐心等待
2. **打包时间**取决于电脑性能，通常需要 2-5 分钟
3. **杀毒软件**可能会误报，需要添加信任
4. **Sharp 模块**已配置为打包包含，确保图片处理功能正常

## 🚀 分发

打包完成后，可以分发：
- **推荐**: `ADB截图工具 1.0.0.exe` - 绿色便携版，用户双击即可使用
- **备选**: `ADB截图工具-1.0.0-win.zip` - 压缩包版本，用户解压后运行

### 使用说明：
- **便携版 exe**: 下载后直接双击运行，所有数据保存在用户文档目录
- **压缩包版本**: 解压到任意目录，运行里面的 exe 文件

## ❓ 常见问题

### 打包失败？
1. 删除 `node_modules` 和 `dist` 文件夹
2. 重新运行 `npm install`
3. 再次打包

### 打包后无法运行？
1. 检查 ADB 文件是否存在
2. 查看是否被杀毒软件拦截
3. 以管理员身份运行

### 打包后出现 "cannot find module sharp" 或 "cannot find detect libc" 错误？
这是 Sharp 模块的原生依赖问题，已通过以下配置解决：
1. **确保依赖完整安装**：删除 `node_modules` 文件夹，重新运行 `npm install`
2. **检查配置**：确保 `package.json` 中包含 Sharp 相关的 `files` 和 `asarUnpack` 配置
3. **清理并重新打包**：
   ```bash
   # 删除旧的打包文件
   rmdir /s /q dist
   # 重新打包
   npm run build:win
   ```

**配置说明**：
- `files` 中包含了 Sharp 及其 Windows 原生模块
- `asarUnpack` 确保原生 `.node` 文件不被打包进 asar 归档

### 任务管理器无法强制结束应用？
已添加多层进程清理机制：
1. **自动清理**：应用关闭时会自动清理所有子进程（包括 ADB）
2. **超时强制退出**：1秒后自动强制退出，防止卡死
3. **单实例锁**：防止多个实例同时运行
4. **紧急方案**：双击运行 `force-quit.bat` 强制结束所有相关进程

**如果应用卡死无法关闭：**
1. 双击项目根目录的 `force-quit.bat` 文件
2. 或在命令行运行：`taskkill /F /IM "ADB截图工具.exe" /T`
3. 同时结束 adb.exe：`taskkill /F /IM adb.exe /T`

### 修改后重新打包
```bash
npm run build:win
```
