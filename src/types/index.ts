// 服务状态
export type ServerStatus = "online" | "offline" | "starting" | "error";

// 打印机信息
export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  status: "ready" | "busy" | "error" | "offline";
}

// 打印任务
export interface PrintJob {
  id: string;
  templateType: "pdf" | "escpos" | "zpl";
  printer: string;
  status: "pending" | "printing" | "success" | "error";
  message?: string;
  createdAt: number;
}

// WebSocket 消息
export interface WsMessage {
  type: string;
  id?: string;
  payload?: unknown;
}

// 打印请求
export interface PrintRequest {
  templateType: "pdf" | "escpos" | "zpl";
  template: string;
  data: Record<string, unknown>;
  printer?: string;
  options?: {
    copies?: number;
    paperSize?: string;
  };
}

// 服务配置
export interface ServerConfig {
  host: string;
  port: number;
  autoStart: boolean;
}
