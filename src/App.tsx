import { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  Card,
  Statistic,
  Row,
  Col,
  Badge,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  message,
  Input,
  Form,
  Descriptions,
  Switch,
  InputNumber,
  Divider,
} from "antd";
import {
  DashboardOutlined,
  PrinterOutlined,
  HistoryOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  CopyOutlined,
  SaveOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { useAppStore } from "./stores/appStore";
import {
  startWsServer,
  stopWsServer,
  getServerStatus,
  onServerStatus,
  listPrinters,
  getConfig,
  updateConfig,
  getAutostart,
  setAutostart,
  getLogDir,
  type AppConfig,
} from "./lib/tauri";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

// 状态颜色映射
const statusColors: Record<string, string> = {
  online: "green",
  offline: "default",
  starting: "processing",
  error: "red",
};

// 任务状态颜色
const jobStatusColors: Record<string, string> = {
  pending: "processing",
  printing: "processing",
  success: "success",
  error: "error",
};

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [logDir, setLogDir] = useState<string>("");
  const [form] = Form.useForm();

  const { serverStatus, setServerStatus, printers, setPrinters, jobs, connectionCount, config } =
    useAppStore();

  // 刷新打印机列表
  const refreshPrinters = async () => {
    try {
      const printerList = await listPrinters();
      // 转换字段名从 snake_case 到 camelCase
      setPrinters(
        printerList.map((p) => ({
          name: p.name,
          isDefault: p.is_default,
          status: p.status as "ready" | "busy" | "error" | "offline",
        }))
      );
    } catch (e) {
      message.error(`获取打印机列表失败: ${e}`);
    }
  };

  // 加载配置
  const loadConfig = async () => {
    try {
      const cfg = await getConfig();
      setAppConfig(cfg);
      form.setFieldsValue({
        port: cfg.server.port,
        host: cfg.server.host,
        auto_start: cfg.server.auto_start,
        start_minimized: cfg.ui.start_minimized,
        minimize_on_close: cfg.ui.minimize_on_close,
        history_limit: cfg.ui.history_limit,
      });

      // 加载开机自启动状态
      const autostart = await getAutostart();
      setAutostartEnabled(autostart);

      // 加载日志目录
      const logPath = await getLogDir();
      setLogDir(logPath);
    } catch (e) {
      message.error(`加载配置失败: ${e}`);
    }
  };

  // 处理开机自启动变更
  const handleAutostartChange = async (enabled: boolean) => {
    try {
      await setAutostart(enabled);
      setAutostartEnabled(enabled);
      message.success(enabled ? "已启用开机自启动" : "已禁用开机自启动");
    } catch (e) {
      message.error(`设置开机自启动失败: ${e}`);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    if (!appConfig) return;

    setConfigLoading(true);
    try {
      const values = form.getFieldsValue();
      const newConfig: AppConfig = {
        ...appConfig,
        server: {
          ...appConfig.server,
          port: values.port,
          host: values.host,
          auto_start: values.auto_start,
        },
        ui: {
          ...appConfig.ui,
          start_minimized: values.start_minimized,
          minimize_on_close: values.minimize_on_close,
          history_limit: values.history_limit,
        },
      };

      await updateConfig(newConfig);
      setAppConfig(newConfig);
      message.success("配置已保存，部分设置需要重启生效");
    } catch (e) {
      message.error(`保存配置失败: ${e}`);
    } finally {
      setConfigLoading(false);
    }
  };

  // 初始化：获取服务状态和打印机列表
  useEffect(() => {
    getServerStatus().then((status) => {
      setServerStatus(status.running ? "online" : "offline");
    });

    // 获取打印机列表
    refreshPrinters();

    // 加载配置
    loadConfig();

    // 监听服务状态变化
    const unlisten = onServerStatus((event) => {
      setServerStatus(event.status);
      if (event.status === "online") {
        message.success(`WebSocket 服务已启动，端口: ${event.port}`);
      } else {
        message.info("WebSocket 服务已停止");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setServerStatus]);

  // 启动/停止服务
  const toggleServer = async () => {
    setLoading(true);
    try {
      if (serverStatus === "online") {
        await stopWsServer();
        setServerStatus("offline");
      } else {
        setServerStatus("starting");
        await startWsServer();
        setServerStatus("online");
      }
    } catch (e) {
      message.error(`操作失败: ${e}`);
      setServerStatus("error");
    } finally {
      setLoading(false);
    }
  };

  // 复制连接地址
  const copyAddress = () => {
    const port = appConfig?.server.port || config.port;
    const address = `ws://localhost:${port}/ws`;
    navigator.clipboard.writeText(address);
    message.success("已复制连接地址");
  };

  // 任务表格列
  const jobColumns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => <Text code>{id.slice(0, 8)}</Text>,
    },
    {
      title: "类型",
      dataIndex: "templateType",
      key: "templateType",
      width: 80,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: "打印机",
      dataIndex: "printer",
      key: "printer",
      width: 150,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={jobStatusColors[status]}>{status}</Tag>
      ),
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (ts: number) => new Date(ts).toLocaleString(),
    },
  ];

  // 菜单项
  const menuItems = [
    { key: "dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
    { key: "printers", icon: <PrinterOutlined />, label: "打印机" },
    { key: "history", icon: <HistoryOutlined />, label: "历史记录" },
    { key: "settings", icon: <SettingOutlined />, label: "设置" },
  ];

  const port = appConfig?.server.port || config.port;

  // 渲染仪表盘
  const renderDashboard = () => (
    <div style={{ padding: 24 }}>
      <Title level={4}>服务状态</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务状态"
              value={serverStatus}
              valueStyle={{
                color:
                  serverStatus === "online"
                    ? "#52c41a"
                    : serverStatus === "error"
                    ? "#ff4d4f"
                    : "#666",
              }}
              prefix={
                <Badge
                  status={
                    statusColors[serverStatus] as
                      | "success"
                      | "error"
                      | "default"
                      | "processing"
                  }
                />
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前连接" value={connectionCount} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="可用打印机" value={printers.length} suffix="台" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日任务" value={jobs.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card title="连接信息" style={{ marginBottom: 24 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="WebSocket 地址">
            <Space>
              <Text code>ws://localhost:{port}/ws</Text>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={copyAddress}
              >
                复制
              </Button>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="健康检查">
            <Text code>http://localhost:{port}/health</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Space style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          icon={
            serverStatus === "online" ? (
              <PauseCircleOutlined />
            ) : (
              <PlayCircleOutlined />
            )
          }
          onClick={toggleServer}
          loading={loading || serverStatus === "starting"}
        >
          {serverStatus === "online" ? "停止服务" : "启动服务"}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={refreshPrinters}>刷新打印机</Button>
      </Space>

      <Title level={4}>最近任务</Title>
      <Table
        columns={jobColumns}
        dataSource={jobs.slice(0, 5)}
        rowKey="id"
        pagination={false}
        size="small"
        locale={{ emptyText: "暂无打印任务" }}
      />
    </div>
  );

  // 渲染打印机列表
  const renderPrinters = () => (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>打印机列表</Title>
        <Button icon={<ReloadOutlined />} onClick={refreshPrinters}>刷新</Button>
      </div>
      <Table
        columns={[
          { title: "名称", dataIndex: "name", key: "name" },
          {
            title: "默认",
            dataIndex: "isDefault",
            key: "isDefault",
            render: (v: boolean) => (v ? <Tag color="blue">默认</Tag> : null),
          },
          {
            title: "状态",
            dataIndex: "status",
            key: "status",
            render: (s: string) => (
              <Tag color={s === "ready" ? "green" : "orange"}>{s}</Tag>
            ),
          },
        ]}
        dataSource={printers}
        rowKey="name"
        locale={{ emptyText: "未检测到打印机" }}
      />
    </div>
  );

  // 渲染历史记录
  const renderHistory = () => (
    <div style={{ padding: 24 }}>
      <Title level={4}>打印历史</Title>
      <Table
        columns={jobColumns}
        dataSource={jobs}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "暂无历史记录" }}
      />
    </div>
  );

  // 渲染设置
  const renderSettings = () => (
    <div style={{ padding: 24 }}>
      <Title level={4}>服务设置</Title>
      <Card>
        <Form form={form} layout="vertical">
          <Title level={5}>服务器配置</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="监听端口" name="port">
                <InputNumber min={1024} max={65535} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="监听地址" name="host">
                <Input placeholder="0.0.0.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="启动时自动开始服务" name="auto_start" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Title level={5}>界面配置</Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="开机自启动">
                <Switch
                  checked={autostartEnabled}
                  onChange={handleAutostartChange}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="启动时最小化" name="start_minimized" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="关闭时最小化到托盘" name="minimize_on_close" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="历史记录保留数量" name="history_limit">
                <InputNumber min={10} max={1000} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={saveConfig}
                loading={configLoading}
              >
                保存配置
              </Button>
              <Text type="secondary">
                提示：端口修改需要重启服务生效
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="日志信息" style={{ marginTop: 16 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="日志目录">
            <Space>
              <Text code>{logDir || "加载中..."}</Text>
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  if (logDir) {
                    navigator.clipboard.writeText(logDir);
                    message.success("日志目录已复制到剪贴板");
                  }
                }}
              >
                复制路径
              </Button>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="日志文件">
            <Text code>rprint.log</Text>
          </Descriptions.Item>
          <Descriptions.Item label="日志级别">
            <Tag color="blue">INFO</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );

  // 页面路由
  const renderContent = () => {
    switch (currentPage) {
      case "printers":
        return renderPrinters();
      case "history":
        return renderHistory();
      case "settings":
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={200} theme="light">
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <PrinterOutlined style={{ fontSize: 24, marginRight: 8 }} />
          <Title level={4} style={{ margin: 0 }}>
            rprint
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => setCurrentPage(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Content style={{ background: "#f5f5f5", overflow: "auto" }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
