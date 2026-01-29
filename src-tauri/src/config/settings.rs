//! 配置数据结构

use serde::{Deserialize, Serialize};

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    /// 服务配置
    #[serde(default)]
    pub server: ServerConfig,

    /// 打印机配置
    #[serde(default)]
    pub printer: PrinterConfig,

    /// 界面配置
    #[serde(default)]
    pub ui: UiConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            printer: PrinterConfig::default(),
            ui: UiConfig::default(),
        }
    }
}

/// 服务配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ServerConfig {
    /// 监听端口
    #[serde(default = "default_port")]
    pub port: u16,

    /// 监听地址
    #[serde(default = "default_host")]
    pub host: String,

    /// 启动时自动开始服务
    #[serde(default = "default_true")]
    pub auto_start: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            host: default_host(),
            auto_start: true,
        }
    }
}

/// 打印机配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrinterConfig {
    /// 默认打印机（为空则使用系统默认）
    #[serde(default)]
    pub default_printer: Option<String>,

    /// PDF 打印机
    #[serde(default)]
    pub pdf_printer: Option<String>,

    /// ESC/POS 打印机（热敏小票）
    #[serde(default)]
    pub escpos_printer: Option<String>,

    /// ZPL 打印机（标签）
    #[serde(default)]
    pub zpl_printer: Option<String>,
}

impl Default for PrinterConfig {
    fn default() -> Self {
        Self {
            default_printer: None,
            pdf_printer: None,
            escpos_printer: None,
            zpl_printer: None,
        }
    }
}

/// 界面配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiConfig {
    /// 启动时最小化到托盘
    #[serde(default = "default_true")]
    pub start_minimized: bool,

    /// 关闭时最小化到托盘（而非退出）
    #[serde(default = "default_true")]
    pub minimize_on_close: bool,

    /// 开机自启动
    #[serde(default)]
    pub auto_launch: bool,

    /// 保留历史记录数量
    #[serde(default = "default_history_limit")]
    pub history_limit: usize,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            start_minimized: true,
            minimize_on_close: true,
            auto_launch: false,
            history_limit: default_history_limit(),
        }
    }
}

// 默认值函数
fn default_port() -> u16 {
    9100
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_true() -> bool {
    true
}

fn default_history_limit() -> usize {
    100
}
