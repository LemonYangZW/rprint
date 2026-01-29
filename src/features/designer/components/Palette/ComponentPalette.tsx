/**
 * ComponentPalette - 组件面板
 *
 * 左侧边栏，包含可拖拽的组件项
 */

import React from "react";
import { Typography, Tooltip, Collapse } from "antd";
import {
  FontSizeOutlined,
  BorderOutlined,
  LineOutlined,
  PictureOutlined,
  BarcodeOutlined,
  QrcodeOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { useDraggable } from "@dnd-kit/core";
import type { PaletteItem } from "../../types";

const { Text } = Typography;

// 组件定义
const paletteItems: PaletteItem[] = [
  {
    type: "text",
    label: "文本",
    icon: "font",
    description: "添加文本内容，支持 Handlebars 变量",
    defaultWidth: 100,
    defaultHeight: 24,
  },
  {
    type: "rect",
    label: "矩形",
    icon: "rect",
    description: "添加矩形框或填充区域",
    defaultWidth: 80,
    defaultHeight: 60,
  },
  {
    type: "line",
    label: "线条",
    icon: "line",
    description: "添加水平或垂直线条",
    defaultWidth: 100,
    defaultHeight: 1,
  },
  {
    type: "image",
    label: "图片",
    icon: "image",
    description: "添加静态图片",
    defaultWidth: 80,
    defaultHeight: 80,
  },
  {
    type: "barcode",
    label: "条码",
    icon: "barcode",
    description: "添加一维条码 (Code128, EAN13)",
    defaultWidth: 120,
    defaultHeight: 40,
  },
  {
    type: "qrcode",
    label: "二维码",
    icon: "qrcode",
    description: "添加二维码",
    defaultWidth: 60,
    defaultHeight: 60,
  },
  {
    type: "hline",
    label: "分隔线",
    icon: "hline",
    description: "添加字符分隔线（适用于小票）",
    defaultWidth: 100,
    defaultHeight: 12,
  },
];

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  font: <FontSizeOutlined />,
  rect: <BorderOutlined />,
  line: <LineOutlined />,
  image: <PictureOutlined />,
  barcode: <BarcodeOutlined />,
  qrcode: <QrcodeOutlined />,
  hline: <MinusOutlined />,
};

// 可拖拽组件项
interface DraggableItemProps {
  item: PaletteItem;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: {
      type: item.type,
      defaultSize: { width: item.defaultWidth, height: item.defaultHeight },
    },
  });

  return (
    <Tooltip title={item.description} placement="right">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          cursor: "grab",
          borderRadius: 4,
          background: isDragging ? "#e6f7ff" : "transparent",
          border: isDragging ? "1px dashed #1890ff" : "1px solid transparent",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#f5f5f5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDragging ? "#e6f7ff" : "transparent";
        }}
      >
        <span style={{ fontSize: 16, color: "#666" }}>{iconMap[item.icon]}</span>
        <Text style={{ fontSize: 13 }}>{item.label}</Text>
      </div>
    </Tooltip>
  );
};

// 组件面板
export const ComponentPalette: React.FC = () => {
  // 按类别分组
  const basicItems = paletteItems.filter((i) =>
    ["text", "rect", "line", "image"].includes(i.type)
  );
  const codeItems = paletteItems.filter((i) =>
    ["barcode", "qrcode"].includes(i.type)
  );
  const specialItems = paletteItems.filter((i) => ["hline"].includes(i.type));

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <Text strong>组件</Text>
      </div>

      <Collapse
        defaultActiveKey={["basic", "codes", "special"]}
        ghost
        items={[
          {
            key: "basic",
            label: "基础",
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {basicItems.map((item) => (
                  <DraggableItem key={item.type} item={item} />
                ))}
              </div>
            ),
          },
          {
            key: "codes",
            label: "条码",
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {codeItems.map((item) => (
                  <DraggableItem key={item.type} item={item} />
                ))}
              </div>
            ),
          },
          {
            key: "special",
            label: "特殊",
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {specialItems.map((item) => (
                  <DraggableItem key={item.type} item={item} />
                ))}
              </div>
            ),
          },
        ]}
      />

      {/* 使用提示 */}
      <div
        style={{
          padding: 16,
          margin: 12,
          background: "#f6ffed",
          borderRadius: 4,
          border: "1px solid #b7eb8f",
        }}
      >
        <Text style={{ fontSize: 12, color: "#52c41a" }}>
          💡 拖拽组件到画布区域添加元素
        </Text>
      </div>
    </div>
  );
};

export default ComponentPalette;
