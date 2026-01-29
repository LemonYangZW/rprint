//! rprint - 远程打印服务

mod config;
mod printer;
mod protocol;
mod renderer;
mod server;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};
use tokio::sync::RwLock;
use tracing::info;

use config::{load_config, save_config, AppConfig};
use printer::{create_printer_manager, PrinterManager};

/// 应用状态
pub struct AppState {
    /// WebSocket 服务是否运行中
    pub ws_running: Arc<RwLock<bool>>,
    /// 应用配置
    pub config: Arc<RwLock<AppConfig>>,
    /// 打印机管理器
    pub printer_manager: Arc<Box<dyn PrinterManager>>,
}

impl Default for AppState {
    fn default() -> Self {
        let config = load_config();
        Self {
            ws_running: Arc::new(RwLock::new(false)),
            config: Arc::new(RwLock::new(config)),
            printer_manager: Arc::new(create_printer_manager()),
        }
    }
}

/// Tauri 命令：获取应用信息
#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "rprint",
        "version": "0.1.0",
        "description": "Remote Print Service"
    })
}

/// Tauri 命令：获取配置
#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let config = state.config.read().await;
    serde_json::to_value(&*config).map_err(|e| e.to_string())
}

/// Tauri 命令：更新配置
#[tauri::command]
async fn update_config(
    state: tauri::State<'_, AppState>,
    new_config: AppConfig,
) -> Result<(), String> {
    // 保存到文件
    save_config(&new_config)?;

    // 更新内存中的配置
    let mut config = state.config.write().await;
    *config = new_config;

    info!("Configuration updated");
    Ok(())
}

/// Tauri 命令：启动 WebSocket 服务
#[tauri::command]
async fn start_ws_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut running = state.ws_running.write().await;
    if *running {
        return Err("Server already running".to_string());
    }

    let port = state.config.read().await.server.port;
    *running = true;
    drop(running);

    // 在后台启动服务
    let ws_running = state.ws_running.clone();
    tokio::spawn(async move {
        info!("Starting WebSocket server on port {}", port);

        if let Err(e) = server::start_server(port).await {
            tracing::error!("WebSocket server error: {}", e);
            let mut running = ws_running.write().await;
            *running = false;
        }
    });

    // 通知前端
    let _ = app.emit(
        "server-status",
        serde_json::json!({
            "status": "online",
            "port": port
        }),
    );

    Ok(format!("WebSocket server started on port {}", port))
}

/// Tauri 命令：停止 WebSocket 服务
#[tauri::command]
async fn stop_ws_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut running = state.ws_running.write().await;
    if !*running {
        return Err("Server not running".to_string());
    }

    // TODO: 实现优雅停止
    *running = false;

    let _ = app.emit(
        "server-status",
        serde_json::json!({
            "status": "offline"
        }),
    );

    Ok("Server stopped".to_string())
}

/// Tauri 命令：获取服务状态
#[tauri::command]
async fn get_server_status(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let running = *state.ws_running.read().await;
    let port = state.config.read().await.server.port;
    Ok(serde_json::json!({
        "running": running,
        "port": port
    }))
}

/// Tauri 命令：获取打印机列表
#[tauri::command]
fn list_printers(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let printers = state.printer_manager.list_printers()?;
    Ok(serde_json::to_value(&printers).map_err(|e| e.to_string())?)
}

/// Tauri 命令：获取默认打印机
#[tauri::command]
fn get_default_printer(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    state.printer_manager.get_default_printer()
}

/// Tauri 命令：打印原始数据 (ESC/POS, ZPL)
#[tauri::command]
fn print_raw(
    state: tauri::State<'_, AppState>,
    printer_name: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state.printer_manager.print_raw(&printer_name, &data)
}

/// Tauri 命令：打印文本
#[tauri::command]
fn print_text(
    state: tauri::State<'_, AppState>,
    printer_name: String,
    text: String,
) -> Result<(), String> {
    state.printer_manager.print_text(&printer_name, &text)
}

/// Tauri 命令：使用模板渲染并打印
#[tauri::command]
fn print_with_template(
    state: tauri::State<'_, AppState>,
    printer_name: String,
    template: String,
    data: serde_json::Value,
) -> Result<(), String> {
    // 渲染模板
    let rendered = renderer::render_template(&template, &data)?;
    // 打印渲染后的内容
    state.printer_manager.print_text(&printer_name, &rendered)
}

/// Tauri 命令：预览模板渲染结果（不打印）
#[tauri::command]
fn preview_template(template: String, data: serde_json::Value) -> Result<String, String> {
    renderer::render_template(&template, &data)
}

/// Tauri 命令：打印 HTML/PDF 内容
#[tauri::command]
async fn print_pdf(
    app: AppHandle,
    html_content: String,
    paper_size: Option<String>,
    silent: Option<bool>,
) -> Result<(), String> {
    use printer::pdf::{print_html, wrap_html_for_print, PdfPrintOptions};

    let paper = paper_size.unwrap_or_else(|| "A4".to_string());

    // 包装 HTML 内容以添加打印样式
    let wrapped_html = wrap_html_for_print(&html_content, &paper);

    let options = PdfPrintOptions {
        copies: 1,
        paper_size: paper,
        silent: silent.unwrap_or(false),
    };

    print_html(&app, &wrapped_html, options).await
}

/// Tauri 命令：使用模板渲染并打印为 PDF
#[tauri::command]
async fn print_template_as_pdf(
    app: AppHandle,
    template: String,
    data: serde_json::Value,
    paper_size: Option<String>,
    silent: Option<bool>,
) -> Result<(), String> {
    use printer::pdf::{print_html, wrap_html_for_print, PdfPrintOptions};

    // 渲染模板
    let rendered = renderer::render_template(&template, &data)?;

    let paper = paper_size.unwrap_or_else(|| "A4".to_string());

    // 包装 HTML 内容
    let wrapped_html = wrap_html_for_print(&rendered, &paper);

    let options = PdfPrintOptions {
        copies: 1,
        paper_size: paper,
        silent: silent.unwrap_or(false),
    };

    print_html(&app, &wrapped_html, options).await
}

/// Tauri 命令：设置开机自启动
#[tauri::command]
async fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();

    if enabled {
        autostart_manager.enable().map_err(|e| e.to_string())?;
        info!("Autostart enabled");
    } else {
        autostart_manager.disable().map_err(|e| e.to_string())?;
        info!("Autostart disabled");
    }

    Ok(())
}

/// Tauri 命令：获取开机自启动状态
#[tauri::command]
async fn get_autostart(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    autostart_manager.is_enabled().map_err(|e| e.to_string())
}

/// Tauri 命令：获取日志目录路径
#[tauri::command]
fn get_log_dir(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_log_dir()
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 日志插件 - 同时输出到控制台和文件
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("rprint".into()) }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        // 自启动插件
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_config,
            update_config,
            start_ws_server,
            stop_ws_server,
            get_server_status,
            list_printers,
            get_default_printer,
            print_raw,
            print_text,
            print_with_template,
            preview_template,
            print_pdf,
            print_template_as_pdf,
            set_autostart,
            get_autostart,
            get_log_dir
        ])
        .setup(|app| {
            // 加载配置
            let state: tauri::State<AppState> = app.state();
            let config = state.config.blocking_read();

            // 创建托盘菜单
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            // 创建托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("rprint - 远程打印服务")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 根据配置决定是否显示窗口
            if !config.ui.start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }

            // 如果配置了自动启动服务，则启动
            if config.server.auto_start {
                let app_handle = app.handle().clone();
                let port = config.server.port;
                let ws_running = state.ws_running.clone();

                tauri::async_runtime::spawn(async move {
                    // 设置运行状态
                    {
                        let mut running = ws_running.write().await;
                        *running = true;
                    }

                    let ws_running_inner = ws_running.clone();
                    tokio::spawn(async move {
                        log::info!("Auto-starting WebSocket server on port {}", port);

                        if let Err(e) = server::start_server(port).await {
                            log::error!("WebSocket server error: {}", e);
                            let mut running = ws_running_inner.write().await;
                            *running = false;
                        }
                    });

                    let _ = app_handle.emit(
                        "server-status",
                        serde_json::json!({
                            "status": "online",
                            "port": port
                        }),
                    );
                });
            }

            log::info!("rprint application started");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
