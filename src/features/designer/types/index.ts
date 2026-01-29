/**
 * Designer Types - 设计器类型导出
 */

export * from "./template";

// ============================================
// 编辑器内部类型
// ============================================

/** 通用画布元素（编辑器内部使用） */
export interface CanvasElement {
  id: string;
  type: "text" | "rect" | "line" | "image" | "barcode" | "qrcode" | "hline";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  locked: boolean;
  hidden: boolean;
  content: string;
  style: Record<string, unknown>;
  dataBinding?: string;
}

/** 画布配置 */
export interface CanvasConfig {
  kind: "pdf" | "zpl" | "escpos" | "text";
  width: number;
  height: number;
  unit: "mm" | "grid";
  scale: number;
  gridSize: number;
  showGrid: boolean;
  showRulers: boolean;
  snapEnabled: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  snapToElements: boolean;
}

/** 历史记录 */
export interface HistoryState {
  past: CanvasElement[][];
  future: CanvasElement[][];
}

/** 组件面板项 */
export interface PaletteItem {
  type: CanvasElement["type"];
  label: string;
  icon: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
}

/** 对齐类型 */
export type AlignType =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

/** 拖放状态 */
export interface DragState {
  isDragging: boolean;
  dragType: CanvasElement["type"] | null;
  dropPosition: { x: number; y: number } | null;
}
