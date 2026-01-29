/**
 * RulerWrapper - 标尺包装组件
 *
 * 使用 @scena/react-ruler 实现水平和垂直标尺
 * 支持：
 * - 与画布缩放同步
 * - mm 单位显示
 * - 滚动同步
 */

import React, { useRef, useEffect, useCallback } from "react";
import Ruler from "@scena/react-ruler";
import { useDesignerStore } from "../../stores";

// 单位转换：mm to px (假设 96 DPI)
const MM_TO_PX = 96 / 25.4;

interface RulerWrapperProps {
  children: React.ReactNode;
}

export const RulerWrapper: React.FC<RulerWrapperProps> = ({ children }) => {
  const horizontalRulerRef = useRef<Ruler>(null);
  const verticalRulerRef = useRef<Ruler>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const config = useDesignerStore((state) => state.config);
  const showRulers = config.showRulers;
  const scale = config.scale;

  // 标尺尺寸
  const rulerSize = 20;
  // unit: 逻辑刻度间隔（每 10mm 显示一个主刻度）
  // zoom: 像素/mm 比例
  const rulerUnit = 10; // 每 10mm 一个主刻度
  const rulerZoom = MM_TO_PX * scale; // 1mm = 3.78px × scale

  // 更新标尺
  const updateRulers = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const scrollTop = scrollContainerRef.current.scrollTop;

    horizontalRulerRef.current?.scroll(-scrollLeft);
    verticalRulerRef.current?.scroll(-scrollTop);
  }, []);

  // 监听滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateRulers);
    return () => container.removeEventListener("scroll", updateRulers);
  }, [updateRulers]);

  // 缩放变化时更新标尺
  useEffect(() => {
    horizontalRulerRef.current?.resize();
    verticalRulerRef.current?.resize();
  }, [scale]);

  if (!showRulers) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 顶部区域：角落 + 水平标尺 */}
      <div style={{ display: "flex", height: rulerSize, flexShrink: 0 }}>
        {/* 左上角 */}
        <div
          style={{
            width: rulerSize,
            height: rulerSize,
            background: "#f5f5f5",
            borderRight: "1px solid #ddd",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#999",
          }}
        >
          mm
        </div>

        {/* 水平标尺 */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Ruler
            ref={horizontalRulerRef}
            type="horizontal"
            unit={rulerUnit}
            zoom={rulerZoom}
            backgroundColor="#f5f5f5"
            textColor="#333"
            lineColor="#999"
            segment={10}
            mainLineSize="60%"
            longLineSize={8}
            shortLineSize={4}
            textOffset={[0, 6]}
            negativeRuler={false}
            textFormat={(scale) => `${scale}`}
            style={{
              width: "100%",
              height: rulerSize,
              borderBottom: "1px solid #ddd",
            }}
          />
        </div>
      </div>

      {/* 主区域：垂直标尺 + 内容 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 垂直标尺 */}
        <div style={{ width: rulerSize, overflow: "hidden", flexShrink: 0 }}>
          <Ruler
            ref={verticalRulerRef}
            type="vertical"
            unit={rulerUnit}
            zoom={rulerZoom}
            backgroundColor="#f5f5f5"
            textColor="#333"
            lineColor="#999"
            segment={10}
            mainLineSize="60%"
            longLineSize={8}
            shortLineSize={4}
            textOffset={[6, 0]}
            negativeRuler={false}
            textFormat={(scale) => `${scale}`}
            style={{
              width: rulerSize,
              height: "100%",
              borderRight: "1px solid #ddd",
            }}
          />
        </div>

        {/* 内容区域 */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflow: "auto",
            position: "relative",
          }}
          onScroll={updateRulers}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default RulerWrapper;
