/**
 * TemplateDoc v1 - 可视化模板文档类型定义
 *
 * 这是可视化编辑器的核心数据结构，用于描述模板的所有元素和配置。
 * 编译器会将 TemplateDoc 转换为 Handlebars 模板字符串。
 */

// ============================================
// 基础类型
// ============================================

export type TemplateKind = "pdf" | "zpl" | "escpos" | "text";
export type Unit = "mm" | "grid";

// Handlebars 表达式
export interface HbsExpr {
  /** 表达式内容，不含花括号：order_id / currency total */
  expr: string;
  /** 是否使用三花括号（不转义） */
  raw?: boolean;
}

// 文本内容类型
export type TextContent =
  | { kind: "static"; text: string }
  | { kind: "hbs"; hbs: HbsExpr }
  | { kind: "mixed"; parts: TextPart[] };

export type TextPart =
  | { kind: "text"; text: string }
  | { kind: "hbs"; hbs: HbsExpr };

// ============================================
// 几何类型
// ============================================

/** 毫米坐标矩形 (PDF/ZPL) */
export interface MmRect {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

/** 网格坐标矩形 (ESC/POS/Text) */
export interface GridRect {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

// ============================================
// 编辑器状态
// ============================================

export interface GuideLine {
  id: string;
  axis: "x" | "y";
  pos: number;
  locked?: boolean;
  label?: string;
}

export interface EditorState {
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
  rulers: {
    enabled: boolean;
  };
  grid: {
    enabled: boolean;
    sizeMm: number;
  };
  guides: {
    x: GuideLine[];
    y: GuideLine[];
  };
  snap: {
    enabled: boolean;
    toGrid: boolean;
    toGuides: boolean;
    toElements: boolean;
    toleranceMm: number;
  };
}

// ============================================
// 元数据
// ============================================

export interface TemplateMeta {
  id: string;
  name: string;
  kind: TemplateKind;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================
// 基础元素
// ============================================

export interface BaseElement {
  id: string;
  type: string;
  name?: string;
  z: number;
  locked?: boolean;
  hidden?: boolean;
  /** 条件显示（Handlebars 条件表达式） */
  visibleIf?: string;
}

// ============================================
// PDF/HTML 元素类型
// ============================================

export type PdfPaperPreset = "A3" | "A4" | "A5" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";

export type PdfPaper =
  | { preset: PdfPaperPreset; orientation?: Orientation }
  | { preset: "custom"; widthMm: number; heightMm: number; orientation?: Orientation };

export interface PdfCanvas {
  kind: "pdf";
  unit: "mm";
  paper: PdfPaper;
  marginMm: { top: number; right: number; bottom: number; left: number };
}

export interface PdfTextElement extends BaseElement {
  type: "text";
  rect: MmRect;
  rotateDeg?: number;
  content: TextContent;
  style: {
    fontFamily?: string;
    fontSizePt: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    align?: "left" | "center" | "right";
    verticalAlign?: "top" | "middle" | "bottom";
    lineHeight?: number;
  };
}

export interface PdfRectElement extends BaseElement {
  type: "rect";
  rect: MmRect;
  rotateDeg?: number;
  style: {
    strokeMm: number;
    strokeColor?: string;
    fillColor?: string;
    radiusMm?: number;
  };
}

export interface PdfLineElement extends BaseElement {
  type: "line";
  rect: MmRect;
  rotateDeg?: number;
  style: {
    strokeMm: number;
    strokeColor?: string;
    dash?: "solid" | "dash";
  };
}

export interface PdfImageElement extends BaseElement {
  type: "image";
  rect: MmRect;
  rotateDeg?: number;
  src: string;
  style?: { objectFit?: "contain" | "cover" | "fill" };
}

export interface PdfBarcodeElement extends BaseElement {
  type: "barcode";
  rect: MmRect;
  data: TextContent;
  format: "code128" | "ean13" | "qrcode";
}

export type PdfElement =
  | PdfTextElement
  | PdfRectElement
  | PdfLineElement
  | PdfImageElement
  | PdfBarcodeElement;

// ============================================
// ZPL 元素类型
// ============================================

export type ZplDpi = 203 | 300 | 600;
export type ZplRotation = "N" | "R" | "I" | "B";

export interface ZplCanvas {
  kind: "zpl";
  unit: "mm";
  dpi: ZplDpi;
  widthMm: number;
  heightMm: number;
  originMm?: { xMm: number; yMm: number };
}

export interface ZplTextElement extends BaseElement {
  type: "text";
  rect: MmRect;
  content: TextContent;
  style: {
    rotation?: ZplRotation;
    fontName: string;
    fontHeightDot: number;
    fontWidthDot: number;
  };
}

export interface ZplBoxElement extends BaseElement {
  type: "box";
  rect: MmRect;
  style: {
    thicknessDot: number;
    color?: "B" | "W";
  };
}

export interface ZplBarcodeElement extends BaseElement {
  type: "barcode";
  rect: MmRect;
  data: TextContent;
  style: {
    format: "code128";
    heightDot: number;
    moduleWidthDot?: number;
    printHri?: boolean;
  };
}

export interface ZplQrElement extends BaseElement {
  type: "qrcode";
  rect: MmRect;
  data: TextContent;
  style: {
    model?: 1 | 2;
    magnification: number;
    ecc?: "H" | "Q" | "M" | "L";
  };
}

export type ZplElement =
  | ZplTextElement
  | ZplBoxElement
  | ZplBarcodeElement
  | ZplQrElement;

// ============================================
// ESC/POS 元素类型 (网格模式)
// ============================================

export type TextAlign = "left" | "center" | "right";

export interface EscposCanvas {
  kind: "escpos";
  unit: "grid";
  cols: number;
  minRows: number;
  autoRows: boolean;
  cellMm?: { colWidthMm: number; rowHeightMm: number };
  encoding?: "utf8" | "gb18030";
  cut?: { enabled: boolean; feedLines: number; mode: "full" | "partial" };
}

export interface EscposTextElement extends BaseElement {
  type: "text";
  rect: GridRect;
  content: TextContent;
  style: {
    align?: TextAlign;
    bold?: boolean;
    underline?: boolean;
    doubleWidth?: boolean;
    doubleHeight?: boolean;
    invert?: boolean;
    wrap?: "clip" | "wrap";
  };
}

export interface EscposHLineElement extends BaseElement {
  type: "hline";
  rect: GridRect;
  char: string;
}

export type EscposElement = EscposTextElement | EscposHLineElement;

// ============================================
// Text 元素类型 (网格模式)
// ============================================

export interface TextCanvas {
  kind: "text";
  unit: "grid";
  cols: number;
  minRows: number;
  autoRows: boolean;
  cellMm?: { colWidthMm: number; rowHeightMm: number };
}

export interface TextTextElement extends BaseElement {
  type: "text";
  rect: GridRect;
  content: TextContent;
  style?: { align?: TextAlign; wrap?: "clip" | "wrap" };
}

export interface TextHLineElement extends BaseElement {
  type: "hline";
  rect: GridRect;
  char: string;
}

export type TextElement = TextTextElement | TextHLineElement;

// ============================================
// 文档类型
// ============================================

interface TemplateDocV1Base {
  schema: "rprint.template_doc";
  version: 1;
  meta: TemplateMeta;
  editor: EditorState;
}

export interface PdfTemplateDocV1 extends TemplateDocV1Base {
  meta: TemplateMeta & { kind: "pdf" };
  canvas: PdfCanvas;
  elements: PdfElement[];
}

export interface ZplTemplateDocV1 extends TemplateDocV1Base {
  meta: TemplateMeta & { kind: "zpl" };
  canvas: ZplCanvas;
  elements: ZplElement[];
}

export interface EscposTemplateDocV1 extends TemplateDocV1Base {
  meta: TemplateMeta & { kind: "escpos" };
  canvas: EscposCanvas;
  elements: EscposElement[];
}

export interface TextTemplateDocV1 extends TemplateDocV1Base {
  meta: TemplateMeta & { kind: "text" };
  canvas: TextCanvas;
  elements: TextElement[];
}

export type TemplateDocV1 =
  | PdfTemplateDocV1
  | ZplTemplateDocV1
  | EscposTemplateDocV1
  | TextTemplateDocV1;

// ============================================
// 编译结果
// ============================================

export interface CompileWarning {
  code: string;
  message: string;
  elementId?: string;
}

export interface CompileResult {
  kind: TemplateKind;
  handlebars: string;
  printHint?: {
    paperSize?: string;
  };
  warnings: CompileWarning[];
}

// ============================================
// 默认值工厂
// ============================================

export const defaultEditorState = (): EditorState => ({
  viewport: { zoom: 1, panX: 0, panY: 0 },
  rulers: { enabled: true },
  grid: { enabled: true, sizeMm: 5 },
  guides: { x: [], y: [] },
  snap: {
    enabled: true,
    toGrid: true,
    toGuides: true,
    toElements: true,
    toleranceMm: 2,
  },
});

export const defaultPdfCanvas = (): PdfCanvas => ({
  kind: "pdf",
  unit: "mm",
  paper: { preset: "A4" },
  marginMm: { top: 10, right: 10, bottom: 10, left: 10 },
});

export const defaultZplCanvas = (): ZplCanvas => ({
  kind: "zpl",
  unit: "mm",
  dpi: 203,
  widthMm: 100,
  heightMm: 50,
});

export const defaultEscposCanvas = (): EscposCanvas => ({
  kind: "escpos",
  unit: "grid",
  cols: 32,
  minRows: 10,
  autoRows: true,
});

export const defaultTextCanvas = (): TextCanvas => ({
  kind: "text",
  unit: "grid",
  cols: 80,
  minRows: 20,
  autoRows: true,
});
