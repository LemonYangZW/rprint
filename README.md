# rprint - 远程打印服务

[English](#english) | [中文](#中文)

---

## 中文

### 简介

rprint 是一个 Web 端远程打印服务客户端，通过 WebSocket 接收打印任务，让 Web 应用可以直接调用本地打印机，无需弹出浏览器打印对话框。

### 特性

- **WebSocket 服务**: 通过 WebSocket 接收来自 Web 应用的打印任务
- **多种打印格式**: 支持纯文本、ESC/POS（热敏小票）、ZPL（标签打印）
- **模板渲染**: 内置 Handlebars 模板引擎，支持丰富的格式化助手函数
- **系统托盘**: 最小化到系统托盘运行，不干扰日常工作
- **开机自启**: 支持 Windows 开机自动启动
- **配置持久化**: 所有设置自动保存，重启后保留

### 截图

![Dashboard](docs/screenshot-dashboard.png)

### 安装

#### 从 Release 下载

从 [Releases](https://github.com/LemonYangZW/rprint/releases) 页面下载最新版本：

- `rprint_x.x.x_x64-setup.exe` - NSIS 安装程序（推荐）
- `rprint_x.x.x_x64_en-US.msi` - MSI 安装包

#### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/LemonYangZW/rprint.git
cd rprint

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建发布版本
npm run tauri build
```

### 使用方法

#### 1. 启动应用

安装后运行应用，WebSocket 服务将自动在 `ws://localhost:9100/ws` 启动。

#### 2. 连接 WebSocket

```javascript
const ws = new WebSocket('ws://localhost:9100/ws');

ws.onopen = () => {
  console.log('已连接到 rprint');
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('打印结果:', response);
};
```

#### 3. 发送打印任务

```javascript
// 获取打印机列表
ws.send(JSON.stringify({
  type: 'list_printers'
}));

// 打印文本
ws.send(JSON.stringify({
  type: 'print',
  job: {
    printer: 'Microsoft Print to PDF',
    content_type: 'text',
    content: '测试打印内容'
  }
}));

// 使用模板打印
ws.send(JSON.stringify({
  type: 'print',
  job: {
    printer: 'EPSON TM-T88V',
    content_type: 'template',
    template: '订单号: {{order_id}}\n金额: {{currency amount}}',
    data: {
      order_id: '12345',
      amount: 99.5
    }
  }
}));
```

### 模板助手函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `currency` | 货币格式化 | `{{currency price}}` → `¥99.00` |
| `format_number` | 数字格式化 | `{{format_number num 2}}` → `3.14` |
| `date_format` | 日期格式化 | `{{date_format ts "%Y-%m-%d"}}` |
| `pad_left` | 左填充 | `{{pad_left str 10 " "}}` |
| `pad_right` | 右填充 | `{{pad_right str 10 " "}}` |
| `uppercase` | 转大写 | `{{uppercase text}}` |
| `lowercase` | 转小写 | `{{lowercase text}}` |
| `truncate` | 截断文本 | `{{truncate text 20}}` |

### 技术栈

- **前端**: React 18 + TypeScript + Ant Design + Zustand
- **后端**: Rust + Tauri 2.x + Axum (WebSocket)
- **打印**: Windows Print Spooler API

### 配置文件

配置文件位于: `%APPDATA%/rprint/config.json`

```json
{
  "server": {
    "port": 9100,
    "host": "0.0.0.0",
    "auto_start": true
  },
  "ui": {
    "start_minimized": true,
    "minimize_on_close": true
  }
}
```

### 日志

日志文件位于: `%APPDATA%/com.rprint.app/logs/rprint.log`

---

## English

### Introduction

rprint is a remote printing service client that receives print jobs via WebSocket, allowing web applications to directly call local printers without browser print dialogs.

### Features

- **WebSocket Service**: Receive print jobs from web applications via WebSocket
- **Multiple Formats**: Support for plain text, ESC/POS (thermal receipt), ZPL (label printing)
- **Template Rendering**: Built-in Handlebars template engine with rich formatting helpers
- **System Tray**: Runs minimized in system tray
- **Auto Start**: Windows startup support
- **Persistent Config**: All settings are automatically saved

### Installation

Download the latest version from [Releases](https://github.com/LemonYangZW/rprint/releases):

- `rprint_x.x.x_x64-setup.exe` - NSIS installer (recommended)
- `rprint_x.x.x_x64_en-US.msi` - MSI package

### Usage

1. Start the application - WebSocket service runs at `ws://localhost:9100/ws`
2. Connect from your web application
3. Send print jobs in JSON format

### Tech Stack

- **Frontend**: React 18 + TypeScript + Ant Design + Zustand
- **Backend**: Rust + Tauri 2.x + Axum (WebSocket)
- **Printing**: Windows Print Spooler API

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
