# rprint - 远程打印服务架构设计

> 生成时间：2026-01-29
> 技术栈：Rust + Tauri + WebSocket

---

## 1. 项目概述

### 1.1 核心功能

- Web 端通过 WebSocket 发起打印请求，直接打印跳过浏览器对话框
- 客户端作为本地 WebSocket 服务，接收请求后调用本机打印机
- 支持混合打印场景：A4 PDF + 热敏小票 (ESC/POS) + 标签 (ZPL)

### 1.2 架构模式

**P2P 模式**（无中央服务器）

```
┌──────────────────────────────────────────────────────────────┐
│                        内网环境                              │
│                                                              │
│  ┌─────────────┐    WebSocket    ┌─────────────────────────┐ │
│  │  Web 浏览器  │ ──────────────► │   rprint 客户端         │ │
│  │             │  ws://IP:PORT   │   (Tauri 托盘程序)       │ │
│  │ - 手动输入IP │                 │   - WebSocket Server    │ │
│  │ - 发送模板   │ ◄────────────── │   - 模板渲染引擎        │ │
│  │ - 查看状态   │   打印状态推送   │   - 打印机调用          │ │
│  └─────────────┘                 └───────────┬─────────────┘ │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────────┐       │
│                                    │   本机打印机     │       │
│                                    └─────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **客户端框架** | Tauri 2.x | 轻量级桌面应用框架 |
| **后端语言** | Rust | 安全、高性能 |
| **前端界面** | React + TypeScript | 配置界面 |
| **UI 组件** | Ant Design | 企业级组件库 |
| **WebSocket** | axum + tokio | 异步 WS 服务 |
| **打印 API** | windows-rs | Win32 API 绑定 |
| **PDF 渲染** | Tauri WebView | HTML → 打印 |

---

## 3. 项目目录结构

```
rprint/
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri 配置
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # 库入口
│   │   ├── config/               # 配置管理
│   │   │   ├── mod.rs
│   │   │   └── settings.rs       # 设置持久化
│   │   ├── server/               # WebSocket 服务
│   │   │   ├── mod.rs
│   │   │   ├── ws_handler.rs     # WS 消息处理
│   │   │   └── protocol.rs       # 协议定义
│   │   ├── printer/              # 打印模块
│   │   │   ├── mod.rs
│   │   │   ├── manager.rs        # 打印机管理
│   │   │   ├── pdf.rs            # PDF 打印
│   │   │   ├── escpos.rs         # ESC/POS 热敏打印
│   │   │   └── zpl.rs            # ZPL 标签打印
│   │   ├── renderer/             # 模板渲染
│   │   │   ├── mod.rs
│   │   │   └── template.rs       # 变量替换
│   │   ├── tray/                 # 系统托盘
│   │   │   ├── mod.rs
│   │   │   └── menu.rs           # 托盘菜单
│   │   └── commands.rs           # Tauri 命令
│   └── icons/                    # 应用图标
├── src/                          # 前端界面 (React)
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── Settings/             # 设置页面
│   │   ├── PrinterList/          # 打印机列表
│   │   ├── JobHistory/           # 打印历史
│   │   └── StatusBar/            # 状态栏
│   ├── hooks/
│   │   └── useTauriCommand.ts    # Tauri 命令调用
│   ├── stores/
│   │   └── appStore.ts           # Zustand 状态
│   └── types/
│       └── index.ts              # 类型定义
├── package.json
├── vite.config.ts
└── README.md
```

---

## 4. 核心模块设计

### 4.1 WebSocket 服务 (server/)

**职责**：监听端口，接收打印请求，推送状态

```rust
// 消息协议
pub enum WsMessage {
    // 客户端 → 服务端
    Print(PrintRequest),
    GetPrinters,
    GetStatus,

    // 服务端 → 客户端
    PrintResult(PrintResult),
    PrinterList(Vec<PrinterInfo>),
    StatusUpdate(ServerStatus),
}

pub struct PrintRequest {
    pub id: String,
    pub template_type: TemplateType,  // Pdf, EscPos, Zpl
    pub template: String,              // HTML/ESC/POS/ZPL 模板
    pub data: serde_json::Value,       // 模板变量
    pub printer: Option<String>,       // 指定打印机（可选）
    pub options: PrintOptions,         // 份数、纸张等
}
```

### 4.2 打印模块 (printer/)

**职责**：封装 Windows 打印 API

| 类型 | 实现方式 |
|------|----------|
| **PDF** | WebView 渲染 HTML → 调用系统打印 |
| **ESC/POS** | 模板变量替换 → RAW 写入打印机 |
| **ZPL** | 模板变量替换 → RAW 写入打印机 |

### 4.3 配置管理 (config/)

**持久化存储**：`%APPDATA%/rprint/config.json`

```json
{
  "server": {
    "port": 9100,
    "host": "0.0.0.0"
  },
  "printer": {
    "default": "HP LaserJet Pro",
    "pdf_printer": "Microsoft Print to PDF",
    "escpos_printer": "POS-80",
    "zpl_printer": "Zebra ZD420"
  },
  "ui": {
    "start_minimized": true,
    "auto_start": false
  }
}
```

### 4.4 系统托盘 (tray/)

**菜单项**：
- 显示状态（在线/离线）
- 打开设置界面
- 查看打印历史
- 开机自启动（开关）
- 退出

---

## 5. WebSocket 协议

### 5.1 连接

```
ws://<IP>:<PORT>/ws
```

### 5.2 消息格式

**请求（Web → Client）**：

```json
{
  "type": "print",
  "id": "job_001",
  "payload": {
    "template_type": "pdf",
    "template": "<html><body><h1>订单 {{order_no}}</h1></body></html>",
    "data": {
      "order_no": "SO20260129-001",
      "customer": "张三",
      "total": 128.50
    },
    "printer": "HP LaserJet Pro",
    "options": {
      "copies": 1,
      "paper_size": "A4"
    }
  }
}
```

**响应（Client → Web）**：

```json
{
  "type": "result",
  "id": "job_001",
  "status": "success",
  "message": "打印成功"
}
```

**查询打印机列表**：

```json
// 请求
{ "type": "get_printers" }

// 响应
{
  "type": "printers",
  "data": [
    { "name": "HP LaserJet Pro", "is_default": true, "status": "ready" },
    { "name": "POS-80", "is_default": false, "status": "ready" }
  ]
}
```

---

## 6. 前端配置界面

### 6.1 页面规划

| 页面 | 功能 |
|------|------|
| **状态页** | 服务状态、连接数、最近打印任务 |
| **打印机管理** | 查看/刷新打印机列表、设置默认打印机 |
| **服务设置** | 端口配置、自启动开关 |
| **打印历史** | 查看历史任务、重新打印 |

### 6.2 技术方案

- **框架**：React 18 + TypeScript
- **UI 库**：Ant Design 5
- **状态管理**：Zustand
- **与 Rust 通信**：Tauri invoke API

---

## 7. 实施里程碑

### M0：项目初始化（1 天）

- [ ] 初始化 Tauri 项目
- [ ] 配置 Rust 工作区
- [ ] 配置前端（React + Vite + Ant Design）
- [ ] 基础托盘图标

### M1：WebSocket 服务（2-3 天）

- [ ] axum WebSocket 服务搭建
- [ ] 协议消息定义与序列化
- [ ] 连接管理与心跳
- [ ] 与前端的 Tauri 命令集成

### M2：打印机集成（3-5 天）

- [ ] Windows 打印机枚举（windows-rs）
- [ ] PDF 打印（WebView 方案）
- [ ] ESC/POS RAW 打印
- [ ] ZPL RAW 打印

### M3：模板渲染（2-3 天）

- [ ] HTML 模板变量替换
- [ ] ESC/POS 模板引擎
- [ ] ZPL 模板引擎

### M4：配置界面（2-3 天）

- [ ] 设置页面 UI
- [ ] 打印机管理页面
- [ ] 打印历史页面
- [ ] 配置持久化

### M5：完善与打包（1-2 天）

- [ ] 开机自启动
- [ ] 错误处理与日志
- [ ] Windows 安装包生成（NSIS/MSI）

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| PDF 打印兼容性 | 使用 WebView 打印，与浏览器行为一致 |
| RAW 打印权限 | 文档说明需要管理员权限或打印机共享配置 |
| 端口被占用 | 配置界面支持修改端口，启动时检测 |
| 防火墙拦截 | 首次启动提示添加防火墙规则 |

---

## 9. 依赖清单 (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
futures = "0.3"
windows = { version = "0.58", features = [
    "Win32_Graphics_Printing",
    "Win32_System_Com",
] }
handlebars = "5"  # 模板引擎
tracing = "0.1"
tracing-subscriber = "0.3"
```

---

_此文档由浮浮酱生成，作为 rprint 项目的架构设计基准喵～ ฅ'ω'ฅ_
