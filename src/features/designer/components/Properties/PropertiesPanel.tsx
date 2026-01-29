/**
 * PropertiesPanel - 属性面板
 *
 * 右侧边栏，显示选中元素的属性并支持编辑：
 * - 位置和尺寸
 * - 样式属性
 * - 内容和数据绑定
 * - 层级和锁定状态
 */

import React, { useCallback } from "react";
import {
  Typography,
  InputNumber,
  Input,
  Switch,
  Divider,
  Space,
  Button,
  Tooltip,
  Collapse,
  Select,
} from "antd";
import {
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import {
  useDesignerStore,
  useSelectedElements,
  useDesignerActions,
} from "../../stores";

const { Text } = Typography;
const { TextArea } = Input;

// 元素类型中文映射
const elementTypeLabels: Record<string, string> = {
  text: "文本",
  rect: "矩形",
  line: "线条",
  image: "图片",
  barcode: "条码",
  qrcode: "二维码",
  hline: "分隔线",
};

export const PropertiesPanel: React.FC = () => {
  const selectedElements = useSelectedElements();
  const selectedIds = useDesignerStore((state) => state.selectedIds);
  const config = useDesignerStore((state) => state.config);
  const actions = useDesignerActions();

  // 更新元素属性
  const handleUpdateElement = useCallback(
    (id: string, changes: Record<string, unknown>) => {
      actions.updateElement(id, changes);
    },
    [actions]
  );

  // 如果没有选中元素，显示画布属性
  if (selectedElements.length === 0) {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <Text strong>画布属性</Text>
        </div>

        <div style={{ padding: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            {/* 模板类型 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                模板类型
              </Text>
              <Select
                value={config.kind}
                onChange={(kind) => actions.updateConfig({ kind })}
                style={{ width: "100%", marginTop: 4 }}
                size="small"
                options={[
                  { value: "pdf", label: "PDF / HTML" },
                  { value: "zpl", label: "ZPL 标签" },
                  { value: "escpos", label: "ESC/POS 小票" },
                  { value: "text", label: "纯文本" },
                ]}
              />
            </div>

            <Divider style={{ margin: "8px 0" }} />

            {/* 画布尺寸 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                宽度 ({config.unit})
              </Text>
              <InputNumber
                value={config.width}
                onChange={(v) => v && actions.updateConfig({ width: v })}
                style={{ width: "100%", marginTop: 4 }}
                size="small"
                min={10}
                max={1000}
              />
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                高度 ({config.unit})
              </Text>
              <InputNumber
                value={config.height}
                onChange={(v) => v && actions.updateConfig({ height: v })}
                style={{ width: "100%", marginTop: 4 }}
                size="small"
                min={10}
                max={2000}
              />
            </div>

            <Divider style={{ margin: "8px 0" }} />

            {/* 网格设置 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13 }}>显示网格</Text>
              <Switch
                checked={config.showGrid}
                onChange={actions.toggleGrid}
                size="small"
              />
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                网格大小 ({config.unit})
              </Text>
              <InputNumber
                value={config.gridSize}
                onChange={(v) => v && actions.updateConfig({ gridSize: v })}
                style={{ width: "100%", marginTop: 4 }}
                size="small"
                min={1}
                max={50}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13 }}>显示标尺</Text>
              <Switch
                checked={config.showRulers}
                onChange={actions.toggleRulers}
                size="small"
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13 }}>启用吸附</Text>
              <Switch
                checked={config.snapEnabled}
                onChange={actions.toggleSnap}
                size="small"
              />
            </div>
          </Space>
        </div>
      </div>
    );
  }

  // 多选时显示批量操作
  if (selectedElements.length > 1) {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <Text strong>多选 ({selectedElements.length} 个元素)</Text>
        </div>

        <div style={{ padding: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Button
              icon={<CopyOutlined />}
              size="small"
              block
              onClick={() => actions.duplicateElements(selectedIds)}
            >
              复制选中元素
            </Button>
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              block
              onClick={() => actions.removeElements(selectedIds)}
            >
              删除选中元素
            </Button>
          </Space>

          <Divider style={{ margin: "16px 0" }} />

          <Text type="secondary" style={{ fontSize: 12 }}>
            对齐工具
          </Text>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 4,
              marginTop: 8,
            }}
          >
            <Tooltip title="左对齐">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "left")}
              >
                左
              </Button>
            </Tooltip>
            <Tooltip title="水平居中">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "center")}
              >
                中
              </Button>
            </Tooltip>
            <Tooltip title="右对齐">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "right")}
              >
                右
              </Button>
            </Tooltip>
            <Tooltip title="顶对齐">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "top")}
              >
                上
              </Button>
            </Tooltip>
            <Tooltip title="垂直居中">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "middle")}
              >
                中
              </Button>
            </Tooltip>
            <Tooltip title="底对齐">
              <Button
                size="small"
                onClick={() => actions.alignElements(selectedIds, "bottom")}
              >
                下
              </Button>
            </Tooltip>
          </div>

          {selectedElements.length >= 3 && (
            <>
              <Text
                type="secondary"
                style={{ fontSize: 12, marginTop: 12, display: "block" }}
              >
                分布工具
              </Text>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <Button
                  size="small"
                  onClick={() =>
                    actions.distributeElements(selectedIds, "horizontal")
                  }
                >
                  水平分布
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    actions.distributeElements(selectedIds, "vertical")
                  }
                >
                  垂直分布
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 单选时显示详细属性
  const element = selectedElements[0];

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text strong>{elementTypeLabels[element.type] || element.type}</Text>
          <Space size={4}>
            <Tooltip title={element.locked ? "解锁" : "锁定"}>
              <Button
                size="small"
                type="text"
                icon={element.locked ? <LockOutlined /> : <UnlockOutlined />}
                onClick={() =>
                  handleUpdateElement(element.id, { locked: !element.locked })
                }
              />
            </Tooltip>
            <Tooltip title={element.hidden ? "显示" : "隐藏"}>
              <Button
                size="small"
                type="text"
                icon={
                  element.hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />
                }
                onClick={() =>
                  handleUpdateElement(element.id, { hidden: !element.hidden })
                }
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => actions.removeElement(element.id)}
              />
            </Tooltip>
          </Space>
        </div>
      </div>

      <Collapse
        defaultActiveKey={["position", "content", "layer"]}
        ghost
        items={[
          {
            key: "position",
            label: "位置和尺寸",
            children: (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    X
                  </Text>
                  <InputNumber
                    value={element.x}
                    onChange={(v) =>
                      v !== null && handleUpdateElement(element.id, { x: v })
                    }
                    style={{ width: "100%" }}
                    size="small"
                    step={1}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Y
                  </Text>
                  <InputNumber
                    value={element.y}
                    onChange={(v) =>
                      v !== null && handleUpdateElement(element.id, { y: v })
                    }
                    style={{ width: "100%" }}
                    size="small"
                    step={1}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    宽度
                  </Text>
                  <InputNumber
                    value={element.width}
                    onChange={(v) =>
                      v !== null &&
                      handleUpdateElement(element.id, { width: v })
                    }
                    style={{ width: "100%" }}
                    size="small"
                    min={1}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    高度
                  </Text>
                  <InputNumber
                    value={element.height}
                    onChange={(v) =>
                      v !== null &&
                      handleUpdateElement(element.id, { height: v })
                    }
                    style={{ width: "100%" }}
                    size="small"
                    min={1}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    旋转角度
                  </Text>
                  <InputNumber
                    value={element.rotation}
                    onChange={(v) =>
                      v !== null &&
                      handleUpdateElement(element.id, { rotation: v })
                    }
                    style={{ width: "100%" }}
                    size="small"
                    min={0}
                    max={360}
                    addonAfter="°"
                  />
                </div>
              </div>
            ),
          },
          {
            key: "content",
            label: "内容",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {(element.type === "text" || element.type === "hline") && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      文本内容
                    </Text>
                    <TextArea
                      value={element.content}
                      onChange={(e) =>
                        handleUpdateElement(element.id, {
                          content: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="输入文本内容，支持 {{变量}} 语法"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                )}

                {(element.type === "barcode" || element.type === "qrcode") && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      数据内容
                    </Text>
                    <Input
                      value={element.content}
                      onChange={(e) =>
                        handleUpdateElement(element.id, {
                          content: e.target.value,
                        })
                      }
                      placeholder="条码/二维码数据"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                )}

                {element.type === "image" && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      图片 URL
                    </Text>
                    <Input
                      value={element.content}
                      onChange={(e) =>
                        handleUpdateElement(element.id, {
                          content: e.target.value,
                        })
                      }
                      placeholder="图片地址"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                )}

                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    数据绑定
                  </Text>
                  <Input
                    value={element.dataBinding || ""}
                    onChange={(e) =>
                      handleUpdateElement(element.id, {
                        dataBinding: e.target.value || undefined,
                      })
                    }
                    placeholder="例如: order.customerName"
                    style={{ marginTop: 4 }}
                  />
                </div>
              </Space>
            ),
          },
          {
            key: "layer",
            label: "层级",
            children: (
              <Space wrap>
                <Tooltip title="置于顶层">
                  <Button
                    size="small"
                    icon={<VerticalAlignTopOutlined />}
                    onClick={() => actions.bringToFront(element.id)}
                  />
                </Tooltip>
                <Tooltip title="上移一层">
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => actions.bringForward(element.id)}
                  />
                </Tooltip>
                <Tooltip title="下移一层">
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => actions.sendBackward(element.id)}
                  />
                </Tooltip>
                <Tooltip title="置于底层">
                  <Button
                    size="small"
                    icon={<VerticalAlignBottomOutlined />}
                    onClick={() => actions.sendToBack(element.id)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
};

export default PropertiesPanel;
