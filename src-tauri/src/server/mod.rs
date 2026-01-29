//! WebSocket 服务模块

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

use crate::printer::{create_printer_manager, PrinterManager};
use crate::protocol::{
    ClientMessage, ErrorResponse, PrintResult, PrintersResponse, ServerMessage, StatusResponse,
};
use crate::renderer::render_template;

/// 服务状态
#[derive(Clone)]
pub struct ServerState {
    /// 连接计数
    pub connection_count: Arc<RwLock<usize>>,
    /// 广播通道（用于通知所有连接）
    pub broadcast_tx: broadcast::Sender<String>,
    /// 打印机管理器
    pub printer_manager: Arc<Box<dyn PrinterManager>>,
}

impl ServerState {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        Self {
            connection_count: Arc::new(RwLock::new(0)),
            broadcast_tx,
            printer_manager: Arc::new(create_printer_manager()),
        }
    }
}

impl Default for ServerState {
    fn default() -> Self {
        Self::new()
    }
}

/// 启动 WebSocket 服务
pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = Arc::new(ServerState::new());

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("WebSocket server starting on ws://0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// 健康检查端点
async fn health_handler() -> impl IntoResponse {
    "OK"
}

/// WebSocket 处理器
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// 处理单个 WebSocket 连接
async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    // 增加连接计数
    {
        let mut count = state.connection_count.write().await;
        *count += 1;
        info!("New WebSocket connection. Total: {}", *count);
    }

    let (mut sender, mut receiver) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // 发送任务：处理广播消息
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // 接收任务：处理客户端消息
    let state_clone = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                let response = handle_message(&text, &state_clone).await;
                if let Err(e) = state_clone.broadcast_tx.send(response) {
                    warn!("Failed to broadcast: {}", e);
                }
            }
        }
    });

    // 等待任一任务完成
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // 减少连接计数
    {
        let mut count = state.connection_count.write().await;
        *count = count.saturating_sub(1);
        info!("WebSocket disconnected. Total: {}", *count);
    }
}

/// 处理客户端消息
async fn handle_message(text: &str, state: &Arc<ServerState>) -> String {
    let msg: Result<ClientMessage, _> = serde_json::from_str(text);

    let response = match msg {
        Ok(ClientMessage::Print(req)) => {
            info!(
                "Print request: id={}, type={}",
                req.id, req.template_type
            );

            // 执行打印
            let print_result = execute_print(&req, state);

            match print_result {
                Ok(_) => ServerMessage::PrintResult(PrintResult {
                    id: req.id,
                    status: "success".to_string(),
                    message: Some("打印任务已完成".to_string()),
                }),
                Err(e) => {
                    error!("Print failed: {}", e);
                    ServerMessage::PrintResult(PrintResult {
                        id: req.id,
                        status: "error".to_string(),
                        message: Some(e),
                    })
                }
            }
        }
        Ok(ClientMessage::GetPrinters) => {
            // 从 Windows API 获取真实打印机列表
            match state.printer_manager.list_printers() {
                Ok(printers) => ServerMessage::Printers(PrintersResponse { printers }),
                Err(e) => {
                    error!("Failed to list printers: {}", e);
                    ServerMessage::Error(ErrorResponse {
                        code: "PRINTER_ERROR".to_string(),
                        message: e,
                    })
                }
            }
        }
        Ok(ClientMessage::GetStatus) => {
            let count = *state.connection_count.read().await;
            ServerMessage::Status(StatusResponse {
                status: "online".to_string(),
                connections: count,
                version: "0.1.0".to_string(),
            })
        }
        Ok(ClientMessage::Ping) => ServerMessage::Pong,
        Err(e) => {
            error!("Failed to parse message: {}", e);
            ServerMessage::Error(ErrorResponse {
                code: "INVALID_MESSAGE".to_string(),
                message: format!("Invalid message format: {}", e),
            })
        }
    };

    serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string())
}

/// 执行打印任务
fn execute_print(
    req: &crate::protocol::PrintRequest,
    state: &Arc<ServerState>,
) -> Result<(), String> {
    // 确定目标打印机
    let printer_name = match &req.printer {
        Some(name) if !name.is_empty() => name.clone(),
        _ => state
            .printer_manager
            .get_default_printer()?
            .ok_or_else(|| "No default printer available".to_string())?,
    };

    // 渲染模板
    let rendered = render_template(&req.template, &req.data)?;

    // 根据模板类型执行打印
    match req.template_type.as_str() {
        "escpos" | "zpl" => {
            // 原始打印（ESC/POS 或 ZPL）
            let data = rendered.as_bytes().to_vec();

            // 根据 copies 打印多份
            for _ in 0..req.options.copies {
                state.printer_manager.print_raw(&printer_name, &data)?;
            }
        }
        "text" => {
            // 文本打印
            for _ in 0..req.options.copies {
                state.printer_manager.print_text(&printer_name, &rendered)?;
            }
        }
        "pdf" => {
            // PDF 打印 - TODO: 需要额外处理
            return Err("PDF printing not yet implemented".to_string());
        }
        _ => {
            return Err(format!("Unknown template type: {}", req.template_type));
        }
    }

    info!(
        "Print completed: printer={}, type={}, copies={}",
        printer_name, req.template_type, req.options.copies
    );

    Ok(())
}
