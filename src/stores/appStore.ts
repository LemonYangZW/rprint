import { create } from "zustand";
import type { ServerStatus, PrinterInfo, PrintJob, ServerConfig } from "../types";

interface AppState {
  // 服务状态
  serverStatus: ServerStatus;
  setServerStatus: (status: ServerStatus) => void;

  // 服务配置
  config: ServerConfig;
  setConfig: (config: Partial<ServerConfig>) => void;

  // 打印机列表
  printers: PrinterInfo[];
  setPrinters: (printers: PrinterInfo[]) => void;

  // 打印任务历史
  jobs: PrintJob[];
  addJob: (job: PrintJob) => void;
  updateJob: (id: string, updates: Partial<PrintJob>) => void;
  clearJobs: () => void;

  // 连接数
  connectionCount: number;
  setConnectionCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // 服务状态
  serverStatus: "offline",
  setServerStatus: (status) => set({ serverStatus: status }),

  // 服务配置
  config: {
    host: "0.0.0.0",
    port: 9100,
    autoStart: true,
  },
  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),

  // 打印机列表
  printers: [],
  setPrinters: (printers) => set({ printers }),

  // 打印任务历史
  jobs: [],
  addJob: (job) =>
    set((state) => ({ jobs: [job, ...state.jobs].slice(0, 100) })),
  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...updates } : job
      ),
    })),
  clearJobs: () => set({ jobs: [] }),

  // 连接数
  connectionCount: 0,
  setConnectionCount: (count) => set({ connectionCount: count }),
}));
