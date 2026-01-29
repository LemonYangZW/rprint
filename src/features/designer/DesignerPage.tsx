/**
 * DesignerPage - 可视化模板设计器主页面
 *
 * 三栏布局：
 * - 左侧：组件面板 (Palette)
 * - 中间：画布区域 (Canvas)
 * - 右侧：属性面板 (Properties)
 */

import React, { useCallback, useState } from "react";
import { Layout, Button, Space, Tooltip, Divider, Select, Modal, message } from "antd";
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  BorderOutlined,
  EyeOutlined,
  SaveOutlined,
  PrinterOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
} from "@ant-design/icons";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";

import { ComponentPalette } from "./components/Palette/ComponentPalette";
import { CanvasArea } from "./components/Canvas/CanvasArea";
import { PropertiesPanel } from "./components/Properties/PropertiesPanel";
import { RulerWrapper } from "./components/Rulers/RulerWrapper";
import { compileToPdfHtml } from "./compilers";
import {
  useDesignerStore,
  useCanUndo,
  useCanRedo,
  useDesignerActions,
} from "./stores";
import type { CanvasElement } from "./types";

const { Sider, Content } = Layout;

// 模板类型选项
const templateKindOptions = [
  { value: "pdf", label: "PDF / HTML" },
  { value: "zpl", label: "ZPL 标签" },
  { value: "escpos", label: "ESC/POS 小票" },
  { value: "text", label: "纯文本" },
];

// 缩放选项
const scaleOptions = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
  { value: 1.5, label: "150%" },
  { value: 2, label: "200%" },
];

export const DesignerPage: React.FC = () => {
  const config = useDesignerStore((state) => state.config);
  const elements = useDesignerStore((state) => state.elements);
  const selectedIds = useDesignerStore((state) => state.selectedIds);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const actions = useDesignerActions();

  const [draggedType, setDraggedType] = React.useState<CanvasElement["type"] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");

  // 预览编译结果
  const handlePreview = useCallback(() => {
    const result = compileToPdfHtml(elements, config);

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => {
        message.warning(`${w.code}: ${w.message}`);
      });
    }

    setPreviewContent(result.handlebars);
    setPreviewOpen(true);
  }, [elements, config]);

  // 复制到剪贴板
  const handleCopyTemplate = useCallback(() => {
    const result = compileToPdfHtml(elements, config);
    navigator.clipboard.writeText(result.handlebars);
    message.success("模板已复制到剪贴板");
  }, [elements, config]);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const type = event.active.data.current?.type as CanvasElement["type"];
    setDraggedType(type);
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedType(null);

      const { active, over } = event;
      if (!over || over.id !== "canvas-drop-area") return;

      const type = active.data.current?.type as CanvasElement["type"];
      const defaultSize = active.data.current?.defaultSize as { width: number; height: number };

      // 计算放置位置（相对于画布）
      // 这里简化处理，实际需要根据 over 的坐标计算
      const dropX = 50;
      const dropY = 50;

      const newElement: Omit<CanvasElement, "id"> = {
        type,
        x: dropX,
        y: dropY,
        width: defaultSize?.width || 100,
        height: defaultSize?.height || 30,
        rotation: 0,
        z: 0,
        locked: false,
        hidden: false,
        content: type === "text" ? "新文本" : "",
        style: {},
      };

      actions.addElement(newElement);
    },
    [actions]
  );

  // 键盘快捷键
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z: 撤销
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      }
      // Ctrl+Shift+Z 或 Ctrl+Y: 重做
      if ((e.ctrlKey && e.shiftKey && e.key === "z") || (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        actions.redo();
      }
      // Delete: 删除选中元素
      if (e.key === "Delete" && selectedIds.length > 0) {
        e.preventDefault();
        actions.removeElements(selectedIds);
      }
      // Ctrl+A: 全选
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        actions.selectAll();
      }
      // Ctrl+D: 复制
      if (e.ctrlKey && e.key === "d" && selectedIds.length > 0) {
        e.preventDefault();
        actions.duplicateElements(selectedIds);
      }
      // Escape: 取消选择
      if (e.key === "Escape") {
        actions.clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, selectedIds]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Layout style={{ height: "100vh", overflow: "hidden" }}>
        {/* 顶部工具栏 */}
        <div
          style={{
            height: 48,
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
          }}
        >
          {/* 模板类型选择 */}
          <Select
            value={config.kind}
            onChange={(kind) => actions.updateConfig({ kind })}
            options={templateKindOptions}
            style={{ width: 140 }}
            size="small"
          />

          <Divider type="vertical" />

          {/* 撤销/重做 */}
          <Space size={4}>
            <Tooltip title="撤销 (Ctrl+Z)">
              <Button
                icon={<UndoOutlined />}
                size="small"
                disabled={!canUndo}
                onClick={actions.undo}
              />
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Y)">
              <Button
                icon={<RedoOutlined />}
                size="small"
                disabled={!canRedo}
                onClick={actions.redo}
              />
            </Tooltip>
          </Space>

          <Divider type="vertical" />

          {/* 缩放 */}
          <Space size={4}>
            <Tooltip title="缩小">
              <Button
                icon={<ZoomOutOutlined />}
                size="small"
                onClick={() => actions.setScale(config.scale - 0.25)}
                disabled={config.scale <= 0.25}
              />
            </Tooltip>
            <Select
              value={config.scale}
              onChange={actions.setScale}
              options={scaleOptions}
              style={{ width: 80 }}
              size="small"
            />
            <Tooltip title="放大">
              <Button
                icon={<ZoomInOutlined />}
                size="small"
                onClick={() => actions.setScale(config.scale + 0.25)}
                disabled={config.scale >= 3}
              />
            </Tooltip>
          </Space>

          <Divider type="vertical" />

          {/* 显示选项 */}
          <Space size={4}>
            <Tooltip title="网格">
              <Button
                icon={<BorderOutlined />}
                size="small"
                type={config.showGrid ? "primary" : "default"}
                onClick={actions.toggleGrid}
              />
            </Tooltip>
            <Tooltip title="标尺">
              <Button
                icon={<EyeOutlined />}
                size="small"
                type={config.showRulers ? "primary" : "default"}
                onClick={actions.toggleRulers}
              />
            </Tooltip>
          </Space>

          <Divider type="vertical" />

          {/* 对齐工具 */}
          {selectedIds.length >= 2 && (
            <Space size={4}>
              <Tooltip title="左对齐">
                <Button
                  icon={<AlignLeftOutlined />}
                  size="small"
                  onClick={() => actions.alignElements(selectedIds, "left")}
                />
              </Tooltip>
              <Tooltip title="水平居中">
                <Button
                  icon={<AlignCenterOutlined />}
                  size="small"
                  onClick={() => actions.alignElements(selectedIds, "center")}
                />
              </Tooltip>
              <Tooltip title="右对齐">
                <Button
                  icon={<AlignRightOutlined />}
                  size="small"
                  onClick={() => actions.alignElements(selectedIds, "right")}
                />
              </Tooltip>
            </Space>
          )}

          <div style={{ flex: 1 }} />

          {/* 右侧操作 */}
          <Space>
            <Button icon={<SaveOutlined />} size="small" onClick={handleCopyTemplate}>
              导出模板
            </Button>
            <Button icon={<EyeOutlined />} size="small" onClick={handlePreview}>
              预览
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} size="small">
              打印
            </Button>
          </Space>
        </div>

        <Layout>
          {/* 左侧组件面板 */}
          <Sider width={200} theme="light" style={{ borderRight: "1px solid #f0f0f0" }}>
            <ComponentPalette />
          </Sider>

          {/* 中间画布区域 */}
          <Content
            style={{
              background: "#e8e8e8",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <RulerWrapper>
              <CanvasArea />
            </RulerWrapper>
          </Content>

          {/* 右侧属性面板 */}
          <Sider width={280} theme="light" style={{ borderLeft: "1px solid #f0f0f0" }}>
            <PropertiesPanel />
          </Sider>
        </Layout>

        {/* 拖拽预览 */}
        <DragOverlay>
          {draggedType && (
            <div
              style={{
                padding: "8px 16px",
                background: "#1890ff",
                color: "#fff",
                borderRadius: 4,
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              {draggedType === "text" && "文本"}
              {draggedType === "rect" && "矩形"}
              {draggedType === "line" && "线条"}
              {draggedType === "image" && "图片"}
              {draggedType === "barcode" && "条码"}
              {draggedType === "qrcode" && "二维码"}
            </div>
          )}
        </DragOverlay>
      </Layout>

      {/* 预览 Modal */}
      <Modal
        title="模板预览 (Handlebars HTML)"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={800}
        footer={[
          <Button key="copy" onClick={() => {
            navigator.clipboard.writeText(previewContent);
            message.success("已复制");
          }}>
            复制代码
          </Button>,
          <Button key="close" type="primary" onClick={() => setPreviewOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <pre
          style={{
            background: "#f5f5f5",
            padding: 16,
            borderRadius: 4,
            maxHeight: 400,
            overflow: "auto",
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {previewContent}
        </pre>
      </Modal>
    </DndContext>
  );
};

export default DesignerPage;
