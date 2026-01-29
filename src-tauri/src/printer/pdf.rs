//! PDF 打印模块
//!
//! 使用 Tauri WebView 渲染 HTML 后调用系统打印

use base64::{engine::general_purpose::STANDARD, Engine};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Runtime, WebviewUrl, WebviewWindowBuilder};
use tracing::{error, info};

/// 全局打印窗口计数器
static PRINT_WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// PDF 打印选项
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PdfPrintOptions {
    /// 打印份数
    pub copies: u32,
    /// 纸张大小 (A4, Letter, etc.)
    pub paper_size: String,
    /// 是否静默打印 (不显示对话框)
    pub silent: bool,
}

impl Default for PdfPrintOptions {
    fn default() -> Self {
        Self {
            copies: 1,
            paper_size: "A4".to_string(),
            silent: false,
        }
    }
}

/// 打印 HTML 内容
///
/// 创建一个隐藏的 WebView 窗口，加载 HTML 内容后执行 window.print()
pub async fn print_html<R: Runtime>(
    app: &AppHandle<R>,
    html_content: &str,
    options: PdfPrintOptions,
) -> Result<(), String> {
    // 生成唯一的窗口标签
    let window_id = PRINT_WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let window_label = format!("print-window-{}", window_id);

    info!("Creating print window: {}", window_label);

    // 将 HTML 内容编码为 data URI
    let html_base64 = STANDARD.encode(html_content.as_bytes());
    let data_uri = format!("data:text/html;base64,{}", html_base64);

    // 创建隐藏的 WebView 窗口
    let webview_window = WebviewWindowBuilder::new(
        app,
        &window_label,
        WebviewUrl::External(data_uri.parse().map_err(|e| format!("Invalid URL: {}", e))?),
    )
    .title("Print Preview")
    .inner_size(800.0, 600.0)
    .visible(false) // 隐藏窗口
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create print window: {}", e))?;

    // 等待页面加载完成
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // 构建打印 JavaScript
    let print_js = if options.silent {
        // 静默打印 - 直接调用 window.print()
        r#"
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                    // 打印后关闭窗口
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                }, 100);
            };
            // 如果页面已加载，直接打印
            if (document.readyState === 'complete') {
                window.print();
                setTimeout(function() {
                    window.close();
                }, 1000);
            }
        "#
        .to_string()
    } else {
        // 显示打印对话框
        r#"
            window.print();
        "#
        .to_string()
    };

    // 执行打印
    if let Err(e) = webview_window.eval(&print_js) {
        error!("Failed to execute print script: {}", e);
        // 即使出错也尝试关闭窗口
        let _ = webview_window.close();
        return Err(format!("Failed to print: {}", e));
    }

    // 等待打印对话框处理
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // 关闭打印窗口
    if let Err(e) = webview_window.close() {
        error!("Failed to close print window: {}", e);
    }

    info!("PDF print completed for window: {}", window_label);
    Ok(())
}

/// 规范化 CSS 长度单位
fn normalize_css_length(token: &str) -> Option<String> {
    let t = token.trim().to_lowercase();
    if t.len() < 3 {
        return None;
    }

    for unit in ["mm", "cm", "in"] {
        if let Some(num) = t.strip_suffix(unit) {
            let num = num.trim();
            if num.is_empty() {
                return None;
            }
            if num.parse::<f64>().is_ok() {
                return Some(format!("{}{}", num, unit));
            }
        }
    }

    None
}

/// 解析自定义纸张尺寸（如 "80mm 200mm" 或 "80mmx200mm"）
fn parse_custom_paper_css(paper_size: &str) -> Option<(String, String)> {
    let s = paper_size.trim().to_lowercase();
    if s.is_empty() {
        return None;
    }

    // 支持：80mm 200mm / 80mmx200mm
    let s = s.replace('x', " ");
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() != 2 {
        return None;
    }

    let w = normalize_css_length(parts[0])?;
    let h = normalize_css_length(parts[1])?;
    Some((w, h))
}

/// 将纸张尺寸转换为 CSS @page size 值
///
/// 支持格式：
/// - 预设：A4, Letter, Legal, A3, A5
/// - 方向：A4 landscape, Letter portrait
/// - 自定义：80mm 200mm, 80mmx200mm, 80mm 200mm landscape
fn paper_size_to_css(paper_size: &str) -> String {
    let tokens: Vec<String> = paper_size
        .trim()
        .split_whitespace()
        .map(|t| t.to_lowercase())
        .collect();

    if tokens.is_empty() {
        return "210mm 297mm".to_string(); // 默认 A4
    }

    // 支持 "A4 landscape" / "80mm 200mm landscape"
    let (base_tokens, landscape) = match tokens.last().map(|s| s.as_str()) {
        Some("landscape") => (&tokens[..tokens.len() - 1], true),
        Some("portrait") => (&tokens[..tokens.len() - 1], false),
        _ => (&tokens[..], false),
    };

    let base = base_tokens.join(" ");

    let mut css = match base.as_str() {
        "a4" => "210mm 297mm".to_string(),
        "letter" => "8.5in 11in".to_string(),
        "legal" => "8.5in 14in".to_string(),
        "a3" => "297mm 420mm".to_string(),
        "a5" => "148mm 210mm".to_string(),
        _ => {
            if let Some((w, h)) = parse_custom_paper_css(&base) {
                format!("{} {}", w, h)
            } else {
                "210mm 297mm".to_string() // 默认 A4
            }
        }
    };

    if landscape {
        if let Some((w, h)) = css.split_once(' ') {
            css = format!("{} {}", h, w);
        }
    }

    css
}

/// 生成打印用的 HTML 包装
///
/// 添加必要的打印样式和页面设置
pub fn wrap_html_for_print(content: &str, paper_size: &str) -> String {
    let paper_css = paper_size_to_css(paper_size);

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {{
            size: {paper_css};
            margin: 10mm;
        }}
        @media print {{
            body {{
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 0;
            padding: 20px;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }}
        th {{
            background-color: #f5f5f5;
        }}
    </style>
</head>
<body>
{content}
</body>
</html>"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrap_html_for_print() {
        let content = "<h1>Test</h1>";
        let wrapped = wrap_html_for_print(content, "A4");
        assert!(wrapped.contains("@page"));
        assert!(wrapped.contains("210mm 297mm"));
        assert!(wrapped.contains("<h1>Test</h1>"));
    }

    #[test]
    fn test_wrap_html_for_print_custom_size_mm() {
        let content = "<h1>Test</h1>";
        let wrapped = wrap_html_for_print(content, "80mm 200mm");
        assert!(wrapped.contains("80mm 200mm"));
    }

    #[test]
    fn test_wrap_html_for_print_preset_landscape() {
        let wrapped = wrap_html_for_print("<h1>Test</h1>", "A4 landscape");
        assert!(wrapped.contains("297mm 210mm"));
    }

    #[test]
    fn test_default_options() {
        let options = PdfPrintOptions::default();
        assert_eq!(options.copies, 1);
        assert_eq!(options.paper_size, "A4");
        assert!(!options.silent);
    }
}
