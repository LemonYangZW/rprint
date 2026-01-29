/**
 * CanvasArea - 画布区域
 *
 * 中心区域，显示可编辑的画布，支持：
 * - 元素渲染和选择
 * - 拖放接收
 * - react-moveable 拖拽/缩放/旋转
 * - react-selecto 框选
 * - 网格和标尺显示
 */

import React, { useRef, useCallback, useEffect, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { useDesignerStore, useDesignerActions } from "../../stores";
import type { CanvasElement } from "../../types";

// 单位转换：mm to px (假设 96 DPI)
const MM_TO_PX = 96 / 25.4;

// 网格背景组件
const GridBackground: React.FC<{
  width: number;
  height: number;
  gridSize: number;
  scale: number;
}> = ({ width, height, gridSize, scale }) => {
  const scaledGridSize = gridSize * MM_TO_PX * scale;
  const patternId = `grid-pattern-${gridSize}-${scale}`;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: width * MM_TO_PX * scale,
        height: height * MM_TO_PX * scale,
        pointerEvents: "none",
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width={scaledGridSize}
          height={scaledGridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${scaledGridSize} 0 L 0 0 0 ${scaledGridSize}`}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

// 元素渲染组件
interface ElementRendererProps {
  element: CanvasElement;
  scale: number;
  isSelected: boolean;
}

const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  scale,
  isSelected,
}) => {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: element.x * MM_TO_PX * scale,
    top: element.y * MM_TO_PX * scale,
    width: element.width * MM_TO_PX * scale,
    height: element.height * MM_TO_PX * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "center center",
    cursor: element.locked ? "not-allowed" : "move",
    opacity: element.hidden ? 0.3 : 1,
    boxSizing: "border-box",
    userSelect: "none",
  };

  // 根据元素类型渲染
  switch (element.type) {
    case "text":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            fontSize: 12 * scale,
            padding: 2 * scale,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "transparent",
            border: isSelected ? "1px solid #1890ff" : "1px solid transparent",
          }}
        >
          {element.content || "文本"}
        </div>
      );

    case "rect":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            border: isSelected ? "2px solid #1890ff" : "1px solid #333",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "transparent",
          }}
        />
      );

    case "line":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            borderTop: "1px solid #333",
            height: Math.max(1, element.height * MM_TO_PX * scale),
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "transparent",
          }}
        />
      );

    case "image":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            border: isSelected ? "2px solid #1890ff" : "1px dashed #999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "#f5f5f5",
            fontSize: 10 * scale,
            color: "#999",
          }}
        >
          {element.content ? (
            <img
              src={element.content}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "100%", pointerEvents: "none" }}
            />
          ) : (
            "图片"
          )}
        </div>
      );

    case "barcode":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            border: isSelected ? "2px solid #1890ff" : "1px dashed #999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "#fafafa",
            fontSize: 10 * scale,
          }}
        >
          ||||| 条码 |||||
        </div>
      );

    case "qrcode":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            border: isSelected ? "2px solid #1890ff" : "1px dashed #999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "#fafafa",
            fontSize: 10 * scale,
          }}
        >
          [QR]
        </div>
      );

    case "hline":
      return (
        <div
          className="moveable-element"
          data-element-id={element.id}
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10 * scale,
            letterSpacing: 2,
            color: "#666",
            background: isSelected ? "rgba(24, 144, 255, 0.1)" : "transparent",
            border: isSelected ? "1px solid #1890ff" : "1px solid transparent",
          }}
        >
          ──────────
        </div>
      );

    default:
      return null;
  }
};

// 主画布区域组件
export const CanvasArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const selectoRef = useRef<Selecto>(null);

  const config = useDesignerStore((state) => state.config);
  const elements = useDesignerStore((state) => state.elements);
  const selectedIds = useDesignerStore((state) => state.selectedIds);
  const actions = useDesignerActions();

  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-drop-area",
  });

  // 获取选中元素的 DOM 节点
  const [selectedTargets, setSelectedTargets] = React.useState<HTMLElement[]>([]);

  // 合并 ref
  const setCanvasRefs = useCallback(
    (node: HTMLDivElement | null) => {
      canvasRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  useEffect(() => {
    if (!canvasRef.current) {
      setSelectedTargets([]);
      return;
    }
    // 确保在 DOM 更新后获取元素
    const targets = selectedIds
      .map((id) => canvasRef.current?.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
      .filter(Boolean);
    setSelectedTargets(targets);
  }, [selectedIds, elements]);

  // 当选择变化时更新 moveable
  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [selectedIds, elements, selectedTargets]);

  // 点击空白区域取消选择
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
        actions.clearSelection();
      }
    },
    [actions]
  );

  // 画布尺寸（像素）
  const canvasWidth = config.width * MM_TO_PX * config.scale;
  const canvasHeight = config.height * MM_TO_PX * config.scale;

  // 按 z-index 排序元素
  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => a.z - b.z),
    [elements]
  );

  // 网格吸附大小（像素）
  const snapGridSize = config.snapToGrid ? config.gridSize * MM_TO_PX * config.scale : 0;

  return (
    <div
      ref={containerRef}
      style={{
        minWidth: "100%",
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        position: "relative",
      }}
    >
      {/* 画布容器 */}
      <div
        ref={setCanvasRefs}
        className="canvas-container"
        style={{
          position: "relative",
          width: canvasWidth,
          height: canvasHeight,
          background: "#fff",
          boxShadow: isOver
            ? "0 0 0 3px #1890ff, 0 4px 12px rgba(0,0,0,0.15)"
            : "0 2px 8px rgba(0,0,0,0.1)",
          transition: "box-shadow 0.2s",
          flexShrink: 0,
        }}
        onClick={handleCanvasClick}
      >
        {/* 网格背景 */}
        {config.showGrid && (
          <GridBackground
            width={config.width}
            height={config.height}
            gridSize={config.gridSize}
            scale={config.scale}
          />
        )}

        {/* 渲染所有元素 */}
        {sortedElements.map((element) => (
          <ElementRenderer
            key={element.id}
            element={element}
            scale={config.scale}
            isSelected={selectedIds.includes(element.id)}
          />
        ))}

        {/* 拖放提示 */}
        {isOver && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(24, 144, 255, 0.05)",
              border: "2px dashed #1890ff",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <span
              style={{
                background: "#1890ff",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 14,
              }}
            >
              释放以添加组件
            </span>
          </div>
        )}

        {/* Moveable - 拖拽/缩放/旋转控制器 (放在画布容器内部) */}
        <Moveable
          ref={moveableRef}
          target={selectedTargets.length > 0 ? selectedTargets : null}
          draggable={true}
          resizable={true}
          rotatable={true}
          snappable={config.snapEnabled}
          snapGridWidth={snapGridSize}
          snapGridHeight={snapGridSize}
          bounds={{
            left: 0,
            top: 0,
            right: canvasWidth,
            bottom: canvasHeight,
          }}
          edge={false}
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          keepRatio={false}
          origin={false}
          padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
          // 拖拽事件
          onDragStart={({ target }) => {
            const id = target.getAttribute("data-element-id");
            if (id && !selectedIds.includes(id)) {
              actions.setSelection([id]);
            }
          }}
          onDrag={({ target, transform }) => {
            // Transient update: 直接操作 DOM 实现 60fps
            target.style.transform = transform;
          }}
          onDragEnd={({ target, lastEvent }) => {
            if (!lastEvent) return;
            const id = target.getAttribute("data-element-id");
            if (!id) return;

            // 计算新位置（从 transform 中提取 translate）
            const { translate } = lastEvent;
            const element = elements.find((el) => el.id === id);
            if (!element) return;

            const newX = element.x + translate[0] / (MM_TO_PX * config.scale);
            const newY = element.y + translate[1] / (MM_TO_PX * config.scale);

            actions.updateElement(id, { x: newX, y: newY });

            // 重置 transform
            target.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : "";
          }}
          // 缩放事件
          onResizeStart={({ target, setOrigin }) => {
            setOrigin(["%", "%"]);
            const id = target.getAttribute("data-element-id");
            if (id && !selectedIds.includes(id)) {
              actions.setSelection([id]);
            }
          }}
          onResize={({ target, width, height, drag }) => {
            // Transient update
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.transform = drag.transform;
          }}
          onResizeEnd={({ target, lastEvent }) => {
            if (!lastEvent) return;
            const id = target.getAttribute("data-element-id");
            if (!id) return;

            const element = elements.find((el) => el.id === id);
            if (!element) return;

            const { width, height, drag } = lastEvent;
            const { translate } = drag;

            const newX = element.x + translate[0] / (MM_TO_PX * config.scale);
            const newY = element.y + translate[1] / (MM_TO_PX * config.scale);
            const newWidth = width / (MM_TO_PX * config.scale);
            const newHeight = height / (MM_TO_PX * config.scale);

            actions.updateElement(id, {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            });

            // 重置样式
            target.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : "";
          }}
          // 旋转事件
          onRotateStart={({ target }) => {
            const id = target.getAttribute("data-element-id");
            if (id && !selectedIds.includes(id)) {
              actions.setSelection([id]);
            }
          }}
          onRotate={({ target, transform }) => {
            target.style.transform = transform;
          }}
          onRotateEnd={({ target, lastEvent }) => {
            if (!lastEvent) return;
            const id = target.getAttribute("data-element-id");
            if (!id) return;

            const { rotate } = lastEvent;
            actions.updateElement(id, { rotation: rotate });
          }}
          // 多选组操作
          onDragGroup={({ events }) => {
            events.forEach(({ target, transform }) => {
              target.style.transform = transform;
            });
          }}
          onDragGroupEnd={({ events }) => {
            const updates = events
              .map(({ target, lastEvent }) => {
                if (!lastEvent) return null;
                const id = target.getAttribute("data-element-id");
                if (!id) return null;

                const element = elements.find((el) => el.id === id);
                if (!element) return null;

                const { translate } = lastEvent;
                return {
                  id,
                  changes: {
                    x: element.x + translate[0] / (MM_TO_PX * config.scale),
                    y: element.y + translate[1] / (MM_TO_PX * config.scale),
                  },
                };
              })
              .filter(Boolean) as Array<{ id: string; changes: Partial<CanvasElement> }>;

            if (updates.length > 0) {
              actions.updateElements(updates);
            }

            // 重置 transform
            events.forEach(({ target }) => {
              const id = target.getAttribute("data-element-id");
              const element = elements.find((el) => el.id === id);
              target.style.transform = element?.rotation ? `rotate(${element.rotation}deg)` : "";
            });
          }}
        />
      </div>

      {/* Selecto - 框选器 */}
      <Selecto
        ref={selectoRef}
        dragContainer={".canvas-container"}
        selectableTargets={[".moveable-element"]}
        hitRate={0}
        selectByClick={true}
        selectFromInside={false}
        toggleContinueSelect={["shift"]}
        ratio={0}
        onDragStart={(e) => {
          const moveable = moveableRef.current;
          const target = e.inputEvent.target as HTMLElement;

          // 检查是否点击了 Moveable 控制器
          if (moveable?.isMoveableElement(target)) {
            e.stop();
            return;
          }

          // 检查是否点击了元素
          const clickedElement = target.closest(".moveable-element") as HTMLElement;
          if (clickedElement) {
            const elementId = clickedElement.getAttribute("data-element-id");

            // 如果点击的是已选中的元素，启动拖拽
            if (elementId && selectedIds.includes(elementId)) {
              e.stop();
              moveable?.dragStart(e.inputEvent);
            } else if (elementId) {
              // 如果点击的是未选中的元素，先选中它
              e.stop();
              actions.setSelection([elementId]);
            }
          }
        }}
        onSelectEnd={(e) => {
          const moveable = moveableRef.current;

          // 获取选中的元素 ID
          const ids = e.selected
            .map((el) => el.getAttribute("data-element-id"))
            .filter(Boolean) as string[];

          // 更新选中状态
          actions.setSelection(ids);

          // 如果是拖拽开始（框选后立即拖拽），等待 target 更新后启动拖拽
          if (e.isDragStart && ids.length > 0) {
            e.inputEvent.preventDefault();
            moveable?.waitToChangeTarget().then(() => {
              moveable?.dragStart(e.inputEvent);
            });
          }
        }}
      />
    </div>
  );
};

export default CanvasArea;
