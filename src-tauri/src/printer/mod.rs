//! Windows 打印机模块

#[cfg(windows)]
mod windows_printer;

pub mod pdf;

use crate::protocol::PrinterInfo;

/// 打印机管理器 trait
pub trait PrinterManager: Send + Sync {
    /// 获取所有打印机列表
    fn list_printers(&self) -> Result<Vec<PrinterInfo>, String>;

    /// 获取默认打印机
    fn get_default_printer(&self) -> Result<Option<String>, String>;

    /// 打印原始数据 (ESC/POS, ZPL)
    fn print_raw(&self, printer_name: &str, data: &[u8]) -> Result<(), String>;

    /// 打印文本
    fn print_text(&self, printer_name: &str, text: &str) -> Result<(), String>;
}

/// 创建打印机管理器实例
pub fn create_printer_manager() -> Box<dyn PrinterManager> {
    #[cfg(windows)]
    {
        Box::new(windows_printer::WindowsPrinterManager::new())
    }
    #[cfg(not(windows))]
    {
        Box::new(DummyPrinterManager)
    }
}

/// 非 Windows 平台的虚拟实现
#[cfg(not(windows))]
struct DummyPrinterManager;

#[cfg(not(windows))]
impl PrinterManager for DummyPrinterManager {
    fn list_printers(&self) -> Result<Vec<PrinterInfo>, String> {
        Ok(vec![])
    }

    fn get_default_printer(&self) -> Result<Option<String>, String> {
        Ok(None)
    }

    fn print_raw(&self, _printer_name: &str, _data: &[u8]) -> Result<(), String> {
        Err("Not supported on this platform".to_string())
    }

    fn print_text(&self, _printer_name: &str, _text: &str) -> Result<(), String> {
        Err("Not supported on this platform".to_string())
    }
}
