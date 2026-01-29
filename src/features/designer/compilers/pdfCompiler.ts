/**
 * PDF/HTML Compiler - 将可视化元素编译为 HTML 模板
 *
 * 编译策略：
 * - 生成绝对定位的 HTML 结构
 * - 使用 mm 单位确保打印尺寸准确
 * - 支持 Handlebars 表达式
 */

import type { CanvasElement, CanvasConfig } from "../types";

export interface CompileWarning {
  code: string;
  message: string;
  elementId?: string;
}

export interface CompileResult {
  kind: "pdf" | "zpl" | "escpos" | "text";
  handlebars: string;
  printHint?: {
    paperSize?: string;
  };
  warnings: CompileWarning[];
}

/**
 * 将可视化元素编译为 PDF/HTML Handlebars 模板
 */
export function compileToPdfHtml(
  elements: CanvasElement[],
  config: CanvasConfig
): CompileResult {
  const warnings: CompileWarning[] = [];

  // 过滤隐藏元素并按 z 排序
  const visibleElements = elements
    .filter((el) => !el.hidden)
    .sort((a, b) => a.z - b.z);

  // 生成元素 HTML
  const elementsHtml = visibleElements
    .map((el) => compileElement(el, warnings))
    .join("\n");

  // 生成完整 HTML
  const html = `<div class="rprint-page" style="position:relative;width:${config.width}mm;height:${config.height}mm;overflow:hidden;">
${elementsHtml}
</div>`;

  // 计算纸张尺寸提示
  const paperSize = `${config.width}mm ${config.height}mm`;

  return {
    kind: "pdf",
    handlebars: html,
    printHint: { paperSize },
    warnings,
  };
}

/**
 * 编译单个元素为 HTML
 */
function compileElement(
  element: CanvasElement,
  warnings: CompileWarning[]
): string {
  const { id, type, x, y, width, height, rotation } = element;

  // 基础样式
  const baseStyles = [
    "position:absolute",
    `left:${x.toFixed(2)}mm`,
    `top:${y.toFixed(2)}mm`,
    `width:${width.toFixed(2)}mm`,
    `height:${height.toFixed(2)}mm`,
    "box-sizing:border-box",
  ];

  // 旋转
  if (rotation) {
    baseStyles.push(`transform:rotate(${rotation}deg)`);
    baseStyles.push("transform-origin:center center");
  }

  // 层级
  baseStyles.push(`z-index:${element.z}`);

  // 条件渲染包装
  const wrapWithCondition = (html: string): string => {
    if (element.dataBinding) {
      // 如果有数据绑定，包装在条件判断中
      return `{{#if ${element.dataBinding}}}\n${html}\n{{/if}}`;
    }
    return html;
  };

  switch (type) {
    case "text":
      return wrapWithCondition(compileTextElement(element, baseStyles, warnings));

    case "rect":
      return wrapWithCondition(compileRectElement(element, baseStyles));

    case "line":
      return wrapWithCondition(compileLineElement(element, baseStyles));

    case "image":
      return wrapWithCondition(compileImageElement(element, baseStyles, warnings));

    case "barcode":
      return wrapWithCondition(compileBarcodeElement(element, baseStyles, warnings));

    case "qrcode":
      return wrapWithCondition(compileQrcodeElement(element, baseStyles, warnings));

    case "hline":
      return wrapWithCondition(compileHlineElement(element, baseStyles));

    default:
      warnings.push({
        code: "UNKNOWN_ELEMENT_TYPE",
        message: `Unknown element type: ${type}`,
        elementId: id,
      });
      return `<!-- Unknown element type: ${type} -->`;
  }
}

/**
 * 编译文本元素
 */
function compileTextElement(
  element: CanvasElement,
  baseStyles: string[],
  _warnings: CompileWarning[]
): string {
  const styles = [...baseStyles];
  const elementStyle = element.style as Record<string, unknown>;

  // 字体样式
  if (elementStyle.fontFamily) {
    styles.push(`font-family:${elementStyle.fontFamily}`);
  }
  if (elementStyle.fontSizePt) {
    styles.push(`font-size:${elementStyle.fontSizePt}pt`);
  } else {
    styles.push("font-size:12pt"); // 默认字号
  }
  if (elementStyle.bold) {
    styles.push("font-weight:bold");
  }
  if (elementStyle.italic) {
    styles.push("font-style:italic");
  }
  if (elementStyle.underline) {
    styles.push("text-decoration:underline");
  }
  if (elementStyle.color) {
    styles.push(`color:${elementStyle.color}`);
  }
  if (elementStyle.align) {
    styles.push(`text-align:${elementStyle.align}`);
  }
  if (elementStyle.lineHeight) {
    styles.push(`line-height:${elementStyle.lineHeight}`);
  }

  // 溢出处理
  styles.push("overflow:hidden");
  styles.push("white-space:pre-wrap");
  styles.push("word-wrap:break-word");

  // 内容处理 - 支持 Handlebars 表达式
  const textContent = element.content || "";

  return `  <div data-id="${element.id}" style="${styles.join(";")}">${escapeHtml(textContent)}</div>`;
}

/**
 * 编译矩形元素
 */
function compileRectElement(
  element: CanvasElement,
  baseStyles: string[]
): string {
  const styles = [...baseStyles];
  const elementStyle = element.style as Record<string, unknown>;

  // 边框
  const strokeWidth = (elementStyle.strokeMm as number) || 0.3;
  const strokeColor = (elementStyle.strokeColor as string) || "#000000";
  styles.push(`border:${strokeWidth}mm solid ${strokeColor}`);

  // 填充
  if (elementStyle.fillColor) {
    styles.push(`background:${elementStyle.fillColor}`);
  }

  // 圆角
  if (elementStyle.radiusMm) {
    styles.push(`border-radius:${elementStyle.radiusMm}mm`);
  }

  return `  <div data-id="${element.id}" style="${styles.join(";")}"></div>`;
}

/**
 * 编译线条元素
 */
function compileLineElement(
  element: CanvasElement,
  baseStyles: string[]
): string {
  const styles = [...baseStyles];
  const elementStyle = element.style as Record<string, unknown>;

  const strokeWidth = (elementStyle.strokeMm as number) || 0.3;
  const strokeColor = (elementStyle.strokeColor as string) || "#000000";

  // 使用 border-top 实现水平线
  styles.push(`border-top:${strokeWidth}mm solid ${strokeColor}`);
  styles.push("height:0");

  return `  <div data-id="${element.id}" style="${styles.join(";")}"></div>`;
}

/**
 * 编译图片元素
 */
function compileImageElement(
  element: CanvasElement,
  baseStyles: string[],
  warnings: CompileWarning[]
): string {
  const styles = [...baseStyles];
  const elementStyle = element.style as Record<string, unknown>;

  // 图片适应模式
  const objectFit = (elementStyle.objectFit as string) || "contain";

  if (!element.content) {
    warnings.push({
      code: "EMPTY_IMAGE_SRC",
      message: "Image element has no source",
      elementId: element.id,
    });
    styles.push("background:#f0f0f0");
    styles.push("display:flex");
    styles.push("align-items:center");
    styles.push("justify-content:center");
    return `  <div data-id="${element.id}" style="${styles.join(";")}">图片</div>`;
  }

  return `  <img data-id="${element.id}" src="${escapeHtml(element.content)}" style="${styles.join(";")};object-fit:${objectFit}" />`;
}

/**
 * 编译条码元素
 *
 * 注意：实际条码渲染需要前端使用 JsBarcode 等库预渲染为 SVG/图片
 * 或者使用 CSS/HTML 模拟（不推荐用于实际打印）
 */
function compileBarcodeElement(
  element: CanvasElement,
  baseStyles: string[],
  warnings: CompileWarning[]
): string {
  const styles = [...baseStyles];

  // 条码内容（可能包含 Handlebars 表达式）
  const barcodeData = element.content || "123456789";

  warnings.push({
    code: "BARCODE_PLACEHOLDER",
    message: "Barcode element compiled as placeholder. Use JsBarcode for actual barcode rendering.",
    elementId: element.id,
  });

  // 生成占位符（实际应用中应使用条码库生成 SVG）
  styles.push("display:flex");
  styles.push("align-items:center");
  styles.push("justify-content:center");
  styles.push("background:#fafafa");
  styles.push("border:1px dashed #ccc");
  styles.push("font-family:monospace");
  styles.push("font-size:10pt");

  return `  <div data-id="${element.id}" style="${styles.join(";")}">||||| ${escapeHtml(barcodeData)} |||||</div>`;
}

/**
 * 编译二维码元素
 */
function compileQrcodeElement(
  element: CanvasElement,
  baseStyles: string[],
  warnings: CompileWarning[]
): string {
  const styles = [...baseStyles];

  const qrData = element.content || "https://example.com";

  warnings.push({
    code: "QRCODE_PLACEHOLDER",
    message: "QR code element compiled as placeholder. Use qrcode library for actual QR code rendering.",
    elementId: element.id,
  });

  styles.push("display:flex");
  styles.push("align-items:center");
  styles.push("justify-content:center");
  styles.push("background:#fafafa");
  styles.push("border:1px dashed #ccc");
  styles.push("font-size:10pt");

  return `  <div data-id="${element.id}" style="${styles.join(";")}">[ QR: ${escapeHtml(qrData)} ]</div>`;
}

/**
 * 编译分隔线元素
 */
function compileHlineElement(
  element: CanvasElement,
  baseStyles: string[]
): string {
  const styles = [...baseStyles];

  styles.push("display:flex");
  styles.push("align-items:center");
  styles.push("justify-content:center");
  styles.push("overflow:hidden");
  styles.push("font-family:monospace");
  styles.push("letter-spacing:2px");
  styles.push("color:#666");

  // 使用重复字符填充
  const char = element.content?.[0] || "-";
  const repeatCount = Math.floor(element.width * 3); // 大约每 mm 3 个字符
  const line = char.repeat(repeatCount);

  return `  <div data-id="${element.id}" style="${styles.join(";")}">$${line}</div>`;
}

/**
 * HTML 转义（保留 Handlebars 表达式）
 */
function escapeHtml(text: string): string {
  // 先提取 Handlebars 表达式
  const hbsPattern = /(\{\{\{?[^}]+\}\}\}?)/g;
  const parts: Array<{ type: "text" | "hbs"; value: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = hbsPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "hbs", value: match[1] });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  // 仅对非 Handlebars 部分进行转义
  return parts
    .map((part) => {
      if (part.type === "hbs") {
        return part.value;
      }
      return part.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    })
    .join("");
}

export default compileToPdfHtml;
