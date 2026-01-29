//! 模板渲染模块
//!
//! 支持三种模板类型：
//! - HTML (用于 PDF 打印)
//! - ESC/POS (热敏小票打印机)
//! - ZPL (标签打印机)

use handlebars::{
    handlebars_helper, Context, Handlebars, Helper, HelperResult, Output, RenderContext,
};
use serde_json::Value;
use tracing::debug;

/// 创建配置好的 Handlebars 实例
fn create_handlebars<'a>() -> Handlebars<'a> {
    let mut hbs = Handlebars::new();

    // 禁用 HTML 转义（对于 ESC/POS 和 ZPL 很重要）
    hbs.set_strict_mode(false);

    // 注册常用 helpers
    register_helpers(&mut hbs);

    hbs
}

/// 注册自定义 helpers
fn register_helpers(hbs: &mut Handlebars) {
    // 格式化数字（保留小数位）
    handlebars_helper!(format_number: |v: f64, decimals: u64| {
        format!("{:.1$}", v, decimals as usize)
    });
    hbs.register_helper("format_number", Box::new(format_number));

    // 格式化货币
    handlebars_helper!(currency: |v: f64| {
        format!("¥{:.2}", v)
    });
    hbs.register_helper("currency", Box::new(currency));

    // 日期格式化（简单实现）
    handlebars_helper!(date_format: |timestamp: i64, _format: str| {
        // 简化实现：直接返回时间戳的字符串表示
        // 生产环境应使用 chrono 库
        let secs = timestamp / 1000;
        let naive = chrono_lite_format(secs);
        naive
    });
    hbs.register_helper("date_format", Box::new(date_format));

    // 字符串填充（左填充）
    handlebars_helper!(pad_left: |s: str, width: u64, ch: str| {
        let ch = ch.chars().next().unwrap_or(' ');
        format!("{:>width$}", s, width = width as usize).replace(' ', &ch.to_string())
    });
    hbs.register_helper("pad_left", Box::new(pad_left));

    // 字符串填充（右填充）
    handlebars_helper!(pad_right: |s: str, width: u64, ch: str| {
        let ch = ch.chars().next().unwrap_or(' ');
        let s_len = s.chars().count();
        if s_len >= width as usize {
            s.to_string()
        } else {
            format!("{}{}", s, ch.to_string().repeat(width as usize - s_len))
        }
    });
    hbs.register_helper("pad_right", Box::new(pad_right));

    // 重复字符
    handlebars_helper!(repeat: |s: str, times: u64| {
        s.repeat(times as usize)
    });
    hbs.register_helper("repeat", Box::new(repeat));

    // 截断字符串
    handlebars_helper!(truncate: |s: str, max_len: u64| {
        let chars: Vec<char> = s.chars().collect();
        if chars.len() <= max_len as usize {
            s.to_string()
        } else {
            chars[..max_len as usize].iter().collect()
        }
    });
    hbs.register_helper("truncate", Box::new(truncate));

    // 大写
    handlebars_helper!(uppercase: |s: str| s.to_uppercase());
    hbs.register_helper("uppercase", Box::new(uppercase));

    // 小写
    handlebars_helper!(lowercase: |s: str| s.to_lowercase());
    hbs.register_helper("lowercase", Box::new(lowercase));

    // 条件相等
    hbs.register_helper("eq", Box::new(helper_eq));

    // 条件不等
    hbs.register_helper("ne", Box::new(helper_ne));

    // 大于
    hbs.register_helper("gt", Box::new(helper_gt));

    // 小于
    hbs.register_helper("lt", Box::new(helper_lt));

    // 数学运算：加法
    handlebars_helper!(add: |a: f64, b: f64| a + b);
    hbs.register_helper("add", Box::new(add));

    // 数学运算：减法
    handlebars_helper!(sub: |a: f64, b: f64| a - b);
    hbs.register_helper("sub", Box::new(sub));

    // 数学运算：乘法
    handlebars_helper!(mul: |a: f64, b: f64| a * b);
    hbs.register_helper("mul", Box::new(mul));

    // 数学运算：除法
    handlebars_helper!(div: |a: f64, b: f64| if b != 0.0 { a / b } else { 0.0 });
    hbs.register_helper("div", Box::new(div));
}

// 条件 helper: eq
fn helper_eq(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let a = h.param(0).and_then(|v| v.value().as_str());
    let b = h.param(1).and_then(|v| v.value().as_str());
    if a == b {
        out.write("true")?;
    }
    Ok(())
}

// 条件 helper: ne
fn helper_ne(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let a = h.param(0).and_then(|v| v.value().as_str());
    let b = h.param(1).and_then(|v| v.value().as_str());
    if a != b {
        out.write("true")?;
    }
    Ok(())
}

// 条件 helper: gt
fn helper_gt(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let a = h.param(0).and_then(|v| v.value().as_f64()).unwrap_or(0.0);
    let b = h.param(1).and_then(|v| v.value().as_f64()).unwrap_or(0.0);
    if a > b {
        out.write("true")?;
    }
    Ok(())
}

// 条件 helper: lt
fn helper_lt(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let a = h.param(0).and_then(|v| v.value().as_f64()).unwrap_or(0.0);
    let b = h.param(1).and_then(|v| v.value().as_f64()).unwrap_or(0.0);
    if a < b {
        out.write("true")?;
    }
    Ok(())
}

/// 简化的时间格式化（不引入 chrono 依赖）
fn chrono_lite_format(secs: i64) -> String {
    // 简单的时间格式化：YYYY-MM-DD HH:MM:SS
    // 生产环境应该使用 chrono 库
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // 简化的日期计算（从 1970-01-01 开始）
    let mut year = 1970i64;
    let mut remaining_days = days_since_epoch;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months: [i64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for days in days_in_months {
        if remaining_days < days {
            break;
        }
        remaining_days -= days;
        month += 1;
    }

    let day = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hours, minutes, seconds
    )
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// 渲染模板
pub fn render_template(template: &str, data: &Value) -> Result<String, String> {
    let hbs = create_handlebars();

    let result = hbs
        .render_template(template, data)
        .map_err(|e| format!("Template render error: {}", e))?;

    debug!("Rendered template: {} bytes", result.len());
    Ok(result)
}

/// ESC/POS 命令构建器
#[allow(dead_code)]
pub mod escpos {
    /// 初始化打印机
    pub const INIT: &[u8] = b"\x1B@";

    /// 居中对齐
    pub const ALIGN_CENTER: &[u8] = b"\x1Ba\x01";

    /// 左对齐
    pub const ALIGN_LEFT: &[u8] = b"\x1Ba\x00";

    /// 右对齐
    pub const ALIGN_RIGHT: &[u8] = b"\x1Ba\x02";

    /// 加粗开
    pub const BOLD_ON: &[u8] = b"\x1BE\x01";

    /// 加粗关
    pub const BOLD_OFF: &[u8] = b"\x1BE\x00";

    /// 双倍高度
    pub const DOUBLE_HEIGHT: &[u8] = b"\x1B!\x10";

    /// 双倍宽度
    pub const DOUBLE_WIDTH: &[u8] = b"\x1B!\x20";

    /// 正常大小
    pub const NORMAL_SIZE: &[u8] = b"\x1B!\x00";

    /// 切纸（部分切）
    pub const CUT_PARTIAL: &[u8] = b"\x1Dm";

    /// 切纸（全切）
    pub const CUT_FULL: &[u8] = b"\x1Di";

    /// 走纸 n 行
    pub fn feed_lines(n: u8) -> Vec<u8> {
        vec![0x1B, b'd', n]
    }

    /// 打印并走纸
    pub const FEED_AND_CUT: &[u8] = b"\x1Bd\x03\x1Dm";

    /// 蜂鸣器
    pub fn beep(times: u8, duration: u8) -> Vec<u8> {
        vec![0x1B, b'B', times, duration]
    }

    /// 构建简单的小票
    pub fn build_receipt(title: &str, items: &[(String, f64)], total: f64) -> Vec<u8> {
        let mut data = Vec::new();

        // 初始化
        data.extend_from_slice(INIT);

        // 标题（居中、加粗）
        data.extend_from_slice(ALIGN_CENTER);
        data.extend_from_slice(DOUBLE_HEIGHT);
        data.extend_from_slice(title.as_bytes());
        data.push(b'\n');
        data.extend_from_slice(NORMAL_SIZE);

        // 分隔线
        data.extend_from_slice(ALIGN_LEFT);
        data.extend_from_slice(b"--------------------------------\n");

        // 商品列表
        for (name, price) in items {
            let line = format!("{:<20} {:>10.2}\n", name, price);
            data.extend_from_slice(line.as_bytes());
        }

        // 分隔线
        data.extend_from_slice(b"--------------------------------\n");

        // 合计
        data.extend_from_slice(BOLD_ON);
        let total_line = format!("{:<20} {:>10.2}\n", "合计", total);
        data.extend_from_slice(total_line.as_bytes());
        data.extend_from_slice(BOLD_OFF);

        // 走纸并切纸
        data.extend_from_slice(FEED_AND_CUT);

        data
    }
}

/// ZPL 命令构建器
#[allow(dead_code)]
pub mod zpl {
    /// 标签开始
    pub const LABEL_START: &str = "^XA";

    /// 标签结束
    pub const LABEL_END: &str = "^XZ";

    /// 设置标签尺寸（宽度，长度，单位：点）
    pub fn label_size(width: u32, height: u32) -> String {
        format!("^PW{}^LL{}", width, height)
    }

    /// 字段原点（x, y 坐标）
    pub fn field_origin(x: u32, y: u32) -> String {
        format!("^FO{},{}", x, y)
    }

    /// 字体设置（字体名，高度，宽度）
    pub fn font(name: char, height: u32, width: u32) -> String {
        format!("^A{},{},{}", name, height, width)
    }

    /// 字段数据
    pub fn field_data(text: &str) -> String {
        format!("^FD{}^FS", text)
    }

    /// 条形码 Code 128
    pub fn barcode_128(x: u32, y: u32, height: u32, data: &str) -> String {
        format!("^FO{},{}^BY2^BCN,{},Y,N,N^FD{}^FS", x, y, height, data)
    }

    /// QR 码
    pub fn qrcode(x: u32, y: u32, magnification: u32, data: &str) -> String {
        format!(
            "^FO{},{}^BQN,2,{}^FDQA,{}^FS",
            x, y, magnification, data
        )
    }

    /// 构建简单的标签
    pub fn build_label(
        product_name: &str,
        barcode: &str,
        price: f64,
    ) -> String {
        let mut zpl = String::new();

        // 标签开始
        zpl.push_str(LABEL_START);
        zpl.push('\n');

        // 标签尺寸 (4x2 英寸 @ 203dpi = 812x406 点)
        zpl.push_str(&label_size(812, 406));
        zpl.push('\n');

        // 产品名称
        zpl.push_str(&field_origin(50, 50));
        zpl.push_str(&font('0', 40, 40));
        zpl.push_str(&field_data(product_name));
        zpl.push('\n');

        // 条形码
        zpl.push_str(&barcode_128(50, 120, 80, barcode));
        zpl.push('\n');

        // 价格
        zpl.push_str(&field_origin(50, 250));
        zpl.push_str(&font('0', 60, 60));
        zpl.push_str(&field_data(&format!("¥{:.2}", price)));
        zpl.push('\n');

        // 标签结束
        zpl.push_str(LABEL_END);

        zpl
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_render_simple() {
        let template = "Hello, {{name}}!";
        let data = json!({"name": "World"});
        let result = render_template(template, &data).unwrap();
        assert_eq!(result, "Hello, World!");
    }

    #[test]
    fn test_render_escpos() {
        let template = "\x1B@\x1Ba\x01Order: {{order_no}}\n\x1Bd\x03";
        let data = json!({"order_no": "12345"});
        let result = render_template(template, &data).unwrap();
        assert!(result.contains("Order: 12345"));
    }

    #[test]
    fn test_currency_helper() {
        let template = "Total: {{currency total}}";
        let data = json!({"total": 128.5});
        let result = render_template(template, &data).unwrap();
        assert_eq!(result, "Total: ¥128.50");
    }

    #[test]
    fn test_format_number_helper() {
        let template = "Value: {{format_number value 2}}";
        let data = json!({"value": 3.14159});
        let result = render_template(template, &data).unwrap();
        assert_eq!(result, "Value: 3.14");
    }

    #[test]
    fn test_pad_helpers() {
        let template = "[{{pad_left num 5 \"0\"}}]";
        let data = json!({"num": "42"});
        let result = render_template(template, &data).unwrap();
        assert_eq!(result, "[00042]");
    }

    #[test]
    fn test_repeat_helper() {
        let template = "{{repeat \"-\" 10}}";
        let data = json!({});
        let result = render_template(template, &data).unwrap();
        assert_eq!(result, "----------");
    }

    #[test]
    fn test_math_helpers() {
        let template = "Sum: {{add a b}}, Product: {{mul a b}}";
        let data = json!({"a": 3.0, "b": 4.0});
        let result = render_template(template, &data).unwrap();
        // 结果可能是整数或浮点数格式
        assert!(result.contains("Sum: 7") && result.contains("Product: 12"));
    }

    #[test]
    fn test_escpos_builder() {
        let items = vec![
            ("商品A".to_string(), 25.00),
            ("商品B".to_string(), 18.50),
        ];
        let receipt = escpos::build_receipt("测试小票", &items, 43.50);
        assert!(!receipt.is_empty());
        assert!(receipt.starts_with(escpos::INIT));
    }

    #[test]
    fn test_zpl_builder() {
        let label = zpl::build_label("测试商品", "1234567890123", 99.99);
        assert!(label.contains("^XA"));
        assert!(label.contains("^XZ"));
        assert!(label.contains("1234567890123"));
    }
}
