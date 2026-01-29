//! Windows 打印机 API 封装

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use tracing::{debug, error, info};
use windows::{
    core::{HSTRING, PCWSTR, PWSTR},
    Win32::{
        Foundation::HANDLE,
        Graphics::Printing::{
            ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW,
            OpenPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W,
            PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_2W,
        },
    },
};

use super::PrinterManager;
use crate::protocol::PrinterInfo;

/// Windows 打印机管理器
pub struct WindowsPrinterManager;

impl WindowsPrinterManager {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsPrinterManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PrinterManager for WindowsPrinterManager {
    fn list_printers(&self) -> Result<Vec<PrinterInfo>, String> {
        list_windows_printers()
    }

    fn get_default_printer(&self) -> Result<Option<String>, String> {
        get_default_printer_name()
    }

    fn print_raw(&self, printer_name: &str, data: &[u8]) -> Result<(), String> {
        print_raw_data(printer_name, data)
    }

    fn print_text(&self, printer_name: &str, text: &str) -> Result<(), String> {
        // 文本转换为字节后打印
        print_raw_data(printer_name, text.as_bytes())
    }
}

/// 获取 Windows 打印机列表
fn list_windows_printers() -> Result<Vec<PrinterInfo>, String> {
    let default_printer = get_default_printer_name().unwrap_or(None);

    unsafe {
        // 第一次调用获取需要的缓冲区大小
        let mut bytes_needed: u32 = 0;
        let mut count: u32 = 0;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        let _ = EnumPrintersW(
            flags,
            PCWSTR::null(),
            2, // PRINTER_INFO_2
            None,
            &mut bytes_needed,
            &mut count,
        );

        if bytes_needed == 0 {
            debug!("No printers found");
            return Ok(vec![]);
        }

        // 分配缓冲区
        let mut buffer: Vec<u8> = vec![0u8; bytes_needed as usize];

        let result = EnumPrintersW(
            flags,
            PCWSTR::null(),
            2,
            Some(&mut buffer),
            &mut bytes_needed,
            &mut count,
        );

        if result.is_err() {
            error!("EnumPrintersW failed");
            return Err("Failed to enumerate printers".to_string());
        }

        let printer_info_ptr = buffer.as_ptr() as *const PRINTER_INFO_2W;
        let printer_infos = std::slice::from_raw_parts(printer_info_ptr, count as usize);

        let printers: Vec<PrinterInfo> = printer_infos
            .iter()
            .filter_map(|info| {
                let name = pwstr_to_string(info.pPrinterName);
                if name.is_empty() {
                    return None;
                }

                let is_default = default_printer.as_ref().map_or(false, |d| d == &name);

                // 判断状态
                let status = if info.Status == 0 { "ready" } else { "busy" };

                Some(PrinterInfo {
                    name,
                    is_default,
                    status: status.to_string(),
                })
            })
            .collect();

        info!("Found {} printers", printers.len());
        Ok(printers)
    }
}

/// 获取默认打印机名称
fn get_default_printer_name() -> Result<Option<String>, String> {
    unsafe {
        // 获取需要的缓冲区大小
        let mut size: u32 = 0;
        let _ = GetDefaultPrinterW(PWSTR::null(), &mut size);

        if size == 0 {
            return Ok(None);
        }

        let mut buffer: Vec<u16> = vec![0u16; size as usize];
        let result = GetDefaultPrinterW(PWSTR(buffer.as_mut_ptr()), &mut size);

        if !result.as_bool() {
            return Ok(None);
        }

        // 找到 null 终止符
        let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        let name = OsString::from_wide(&buffer[..len])
            .to_string_lossy()
            .to_string();

        Ok(Some(name))
    }
}

/// 打印原始数据 (RAW)
fn print_raw_data(printer_name: &str, data: &[u8]) -> Result<(), String> {
    info!("Printing {} bytes to '{}'", data.len(), printer_name);

    unsafe {
        let printer_name_wide = HSTRING::from(printer_name);
        let mut handle: HANDLE = HANDLE::default();

        // 打开打印机
        let result = OpenPrinterW(
            PCWSTR(printer_name_wide.as_ptr()),
            &mut handle,
            None,
        );

        if result.is_err() || handle.is_invalid() {
            return Err(format!("Failed to open printer: {}", printer_name));
        }

        // 设置文档信息
        let doc_name = HSTRING::from("rprint document");
        let data_type = HSTRING::from("RAW");

        let doc_info = DOC_INFO_1W {
            pDocName: PWSTR(doc_name.as_ptr() as *mut u16),
            pOutputFile: PWSTR::null(),
            pDatatype: PWSTR(data_type.as_ptr() as *mut u16),
        };

        // 开始文档
        let job_id = StartDocPrinterW(handle, 1, &doc_info as *const DOC_INFO_1W);
        if job_id == 0 {
            let _ = ClosePrinter(handle);
            return Err("Failed to start document".to_string());
        }

        // 开始页面
        if !StartPagePrinter(handle).as_bool() {
            let _ = EndDocPrinter(handle);
            let _ = ClosePrinter(handle);
            return Err("Failed to start page".to_string());
        }

        // 写入数据
        let mut bytes_written: u32 = 0;
        let write_result = WritePrinter(
            handle,
            data.as_ptr() as *const _,
            data.len() as u32,
            &mut bytes_written,
        );

        if !write_result.as_bool() {
            let _ = EndPagePrinter(handle);
            let _ = EndDocPrinter(handle);
            let _ = ClosePrinter(handle);
            return Err("Failed to write to printer".to_string());
        }

        // 结束页面和文档
        let _ = EndPagePrinter(handle);
        let _ = EndDocPrinter(handle);
        let _ = ClosePrinter(handle);

        info!("Successfully printed {} bytes", bytes_written);
        Ok(())
    }
}

/// 将 PWSTR 转换为 String
fn pwstr_to_string(pwstr: PWSTR) -> String {
    if pwstr.is_null() {
        return String::new();
    }

    unsafe {
        let len = (0..).take_while(|&i| *pwstr.0.add(i) != 0).count();
        let slice = std::slice::from_raw_parts(pwstr.0, len);
        OsString::from_wide(slice).to_string_lossy().to_string()
    }
}
