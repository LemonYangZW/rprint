import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// 打印机信息类型
export interface PrinterInfo {
  name: string;
  is_default: boolean;
  status: string;
}

// 配置类型
export interface AppConfig {
  server: ServerConfig;
  printer: PrinterConfig;
  ui: UiConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  auto_start: boolean;
}

export interface PrinterConfig {
  default_printer: string | null;
  pdf_printer: string | null;
  escpos_printer: string | null;
  zpl_printer: string | null;
}

export interface UiConfig {
  start_minimized: boolean;
  minimize_on_close: boolean;
  auto_launch: boolean;
  history_limit: number;
}

// Tauri 命令调用

export async function getAppInfo(): Promise<{
  name: string;
  version: string;
  description: string;
}> {
  return invoke("get_app_info");
}

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function updateConfig(config: AppConfig): Promise<void> {
  return invoke("update_config", { newConfig: config });
}

export async function startWsServer(): Promise<string> {
  return invoke("start_ws_server");
}

export async function stopWsServer(): Promise<string> {
  return invoke("stop_ws_server");
}

export async function getServerStatus(): Promise<{
  running: boolean;
  port: number;
}> {
  return invoke("get_server_status");
}

// 打印机命令

export async function listPrinters(): Promise<PrinterInfo[]> {
  return invoke("list_printers");
}

export async function getDefaultPrinter(): Promise<string | null> {
  return invoke("get_default_printer");
}

export async function printRaw(printerName: string, data: number[]): Promise<void> {
  return invoke("print_raw", { printerName, data });
}

export async function printText(printerName: string, text: string): Promise<void> {
  return invoke("print_text", { printerName, text });
}

export async function printWithTemplate(
  printerName: string,
  template: string,
  data: Record<string, unknown>
): Promise<void> {
  return invoke("print_with_template", { printerName, template, data });
}

// 事件监听

export interface ServerStatusEvent {
  status: "online" | "offline";
  port?: number;
}

export function onServerStatus(
  callback: (event: ServerStatusEvent) => void
): Promise<UnlistenFn> {
  return listen<ServerStatusEvent>("server-status", (event) => {
    callback(event.payload);
  });
}

// 自启动管理

export async function setAutostart(enabled: boolean): Promise<void> {
  return invoke("set_autostart", { enabled });
}

export async function getAutostart(): Promise<boolean> {
  return invoke("get_autostart");
}

// 日志管理

export async function getLogDir(): Promise<string> {
  return invoke("get_log_dir");
}
