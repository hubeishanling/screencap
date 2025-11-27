# Electron 桌面应用

一个使用 Electron 构建的现代化桌面应用程序。

## 📦 项目结构

```
screencap/
├── main.js           # Electron 主进程
├── preload.js        # 预加载脚本（安全上下文桥接）
├── index.html        # 应用界面
├── styles.css        # 样式文件
├── renderer.js       # 渲染进程脚本
├── package.json      # 项目配置
└── README.md         # 项目说明
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行应用

```bash
npm start
```

### 3. 开发模式（带调试）

```bash
npm run dev
```

## ✨ 功能特性

- ✅ **安全架构**: 使用 contextIsolation 和预加载脚本
- ✅ **IPC 通信**: 主进程与渲染进程安全通信
- ✅ **现代化界面**: 响应式设计，美观的 UI
- ✅ **跨平台**: 支持 Windows、macOS 和 Linux

## 🔧 技术栈

- **Electron**: 27.x
- **Node.js**: 需要 Node.js 16.x 或更高版本
- **安全配置**: 
  - Context Isolation: ✅
  - Node Integration: ❌
  - Remote Module: ❌

## 📝 开发指南

### 主进程 (main.js)

主进程负责：
- 创建和管理应用窗口
- 处理系统级别的操作
- 管理应用生命周期
- 处理来自渲染进程的 IPC 消息

### 渲染进程 (renderer.js)

渲染进程负责：
- 显示用户界面
- 处理用户交互
- 通过 IPC 与主进程通信

### 预加载脚本 (preload.js)

预加载脚本：
- 在渲染进程加载前运行
- 安全地暴露 API 给渲染进程
- 实现主进程和渲染进程之间的桥接

## 🔒 安全性

本应用遵循 Electron 安全最佳实践：

1. 启用上下文隔离 (contextIsolation)
2. 禁用 Node.js 集成 (nodeIntegration: false)
3. 使用预加载脚本安全地暴露 API
4. 设置 Content Security Policy (CSP)

## 📦 打包部署

安装 electron-builder:

```bash
npm install --save-dev electron-builder
```

在 package.json 中添加打包脚本和配置，然后运行：

```bash
npm run build
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
