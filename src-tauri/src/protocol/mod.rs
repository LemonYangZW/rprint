//! WebSocket 协议消息定义

use serde::{Deserialize, Serialize};

/// 客户端发送的消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// 打印请求
    Print(PrintRequest),
    /// 获取打印机列表
    GetPrinters,
    /// 获取服务状态
    GetStatus,
    /// 心跳
    Ping,
}

/// 服务端发送的消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// 打印结果
    PrintResult(PrintResult),
    /// 打印机列表
    Printers(PrintersResponse),
    /// 服务状态
    Status(StatusResponse),
    /// 心跳响应
    Pong,
    /// 错误
    Error(ErrorResponse),
}

/// 打印请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintRequest {
    /// 请求 ID
    pub id: String,
    /// 模板类型: pdf, escpos, zpl
    pub template_type: String,
    /// 模板内容 (HTML/ESC-POS/ZPL)
    pub template: String,
    /// 模板数据 (变量替换)
    pub data: serde_json::Value,
    /// 目标打印机名称 (可选，为空则使用默认)
    #[serde(default)]
    pub printer: Option<String>,
    /// 打印选项
    #[serde(default)]
    pub options: PrintOptions,
}

/// 打印选项
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PrintOptions {
    /// 打印份数
    #[serde(default = "default_copies")]
    pub copies: u32,
    /// 纸张大小
    #[serde(default)]
    pub paper_size: Option<String>,
}

fn default_copies() -> u32 {
    1
}

/// 打印结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintResult {
    /// 请求 ID
    pub id: String,
    /// 状态: success, error
    pub status: String,
    /// 消息
    #[serde(default)]
    pub message: Option<String>,
}

/// 打印机信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterInfo {
    /// 打印机名称
    pub name: String,
    /// 是否为默认打印机
    pub is_default: bool,
    /// 状态: ready, busy, error, offline
    pub status: String,
}

/// 打印机列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintersResponse {
    pub printers: Vec<PrinterInfo>,
}

/// 状态响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResponse {
    /// 服务状态: online
    pub status: String,
    /// 连接数
    pub connections: usize,
    /// 版本
    pub version: String,
}

/// 错误响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    /// 错误码
    pub code: String,
    /// 错误消息
    pub message: String,
}
