import { useState, useCallback, useRef, useEffect } from 'react';
import { Layout, Button, Space, Typography, Tooltip, Spin } from 'antd';
import {
  CodeOutlined,
  ApartmentOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { NodeCanvas } from '../nodes/NodeCanvas';
import { NodeToolbox } from '../nodes/NodeToolbox';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewWindow } from '../preview/PreviewWindow';
import { VerifierIframe } from '../preview/VerifierIframe';
import { InputPanel } from '../common/InputPanel';
import { CorrectionLog } from '../common/CorrectionLog';
import { ParamPanel } from '../common/ParamPanel';
import { HistoryPanel } from '../common/HistoryPanel';
import { useAutoFix } from '../../hooks/useAutoFix';
import type { NodeData } from '../../hooks/useAutoFix';
import type { EdgeData, HistoryEntry } from '../../hooks/useAutoFix';
import styles from './AppLayout.module.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

type ViewMode = 'editor' | 'preview';

export type { NodeData, EdgeData };

/** Draggable resize handle — controls the width of the panel to its LEFT */
function useResizeHandle(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
): [number, (e: React.MouseEvent) => void, boolean] {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef<{ startX: number; startW: number } | null>(null);
  const [active, setActive] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { startX: e.clientX, startW: width };
    setActive(true);
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragging.current.startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, dragging.current.startW + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      dragging.current = null;
      setActive(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, maxWidth]);

  return [width, onMouseDown, active];
}

export function AppLayout() {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const {
    phase,
    isProcessing,
    finalCode,
    finalNodes,
    finalEdges,
    correctionLog,
    verificationCode,
    verificationKey,
    previewKey,
    generationKey,
    adjustExplanation,
    history,
    startAutoFix,
    onVerifierError,
    onVerifierSuccess,
    updateNodeParams,
    regenerateFromParams,
    adjustCode,
    refreshPreview,
    restoreHistory,
    deleteHistory,
    currentAttempt,
    maxAttempts,
  } = useAutoFix();

  // Resizable panel widths — each handle controls the panel to its LEFT
  const [sidebarWidth, onSidebarResize, sidebarResizing] = useResizeHandle(260, 180, 400);
  const [canvasWidth, onCanvasResize, canvasResizing] = useResizeHandle(380, 200, 700);
  const [paramWidth, onParamResize, paramResizing] = useResizeHandle(290, 200, 500);

  const handleGenerate = useCallback(
    (prompt: string, model: string) => {
      setViewMode('preview');
      setSelectedNode(null);
      startAutoFix(prompt, model);
    },
    [startAutoFix],
  );

  const handleAdjust = useCallback(
    (prompt: string) => {
      setViewMode('preview');
      adjustCode(prompt);
    },
    [adjustCode],
  );

  const handleNodeSelect = useCallback((node: NodeData | null) => {
    setSelectedNode(node);
  }, []);

  const handleParamChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      updateNodeParams(nodeId, key, value);
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        return { ...prev, params: { ...prev.params, [key]: value } };
      });
    },
    [updateNodeParams],
  );

  const handleApplyParams = useCallback(() => {
    regenerateFromParams();
    setViewMode('preview');
  }, [regenerateFromParams]);

  const handleRestoreHistory = useCallback(
    (entry: HistoryEntry) => {
      restoreHistory(entry);
      setViewMode('preview');
      setSelectedNode(null);
    },
    [restoreHistory],
  );

  const code = finalCode || '';
  const nodes = finalNodes || [];
  const edges = finalEdges || [];

  const phaseText: Record<string, string> = {
    generating: 'AI 正在生成代码...',
    verifying: '正在沙箱中验证代码...',
    fixing: `正在修复第 ${currentAttempt} 个错误 (最多 ${maxAttempts} 次)...`,
  };

  const isResizing = sidebarResizing || canvasResizing || paramResizing;

  return (
    <Layout className={`${styles.layout} ${isResizing ? styles.resizing : ''}`}>
      <Header className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} className={styles.logo}>
            <PlayCircleOutlined /> 艺术编程
          </Title>
        </div>
        <Space className={styles.headerRight}>
          <Tooltip title="节点模式">
            <Button
              type="text"
              icon={<ApartmentOutlined />}
              className={styles.modeBtn}
            />
          </Tooltip>
          <Tooltip title="设置">
            <Button
              type="text"
              icon={<SettingOutlined />}
              className={styles.modeBtn}
            />
          </Tooltip>
        </Space>
      </Header>

      <Content className={styles.content}>
        {/* 最左侧：对话栏 */}
        <div className={styles.leftSidebar} style={{ width: sidebarWidth }}>
          <InputPanel
            onGenerate={handleGenerate}
            onAdjust={handleAdjust}
            isProcessing={isProcessing}
            hasCode={!!code}
          />
          <HistoryPanel
            history={history}
            onRestore={handleRestoreHistory}
            onDelete={deleteHistory}
          />
        </div>

        {/* 手柄 A: 对话栏 ↔ 工具箱 — 控制对话栏宽度 */}
        <div className={styles.resizeHandle} onMouseDown={onSidebarResize} />

        {/* 节点工具箱 */}
        <NodeToolbox />

        {/* 手柄 B: 工具箱 ↔ 画布 — 控制画布宽度（从左边） */}
        <div className={styles.resizeHandle} onMouseDown={onCanvasResize} />

        {/* 节点画布 */}
        <div className={styles.centerPanel} style={{ width: canvasWidth }}>
          <NodeCanvas
            key={generationKey}
            nodes={nodes}
            edges={edges}
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* 手柄 C: 画布 ↔ 参数抽屉 — 控制画布宽度（从右边） */}
        <div className={styles.resizeHandle} onMouseDown={onCanvasResize} />

        {/* 参数抽屉 — 选中节点时滑出 */}
        <div
          className={`${styles.paramDrawer} ${selectedNode ? styles.paramDrawerOpen : ''}`}
          style={{ width: selectedNode ? paramWidth : 0 }}
        >
          <ParamPanel
            selectedNode={selectedNode}
            onParamChange={handleParamChange}
            onApply={handleApplyParams}
            adjustExplanation={adjustExplanation}
          />
        </div>

        {/* 手柄 D: 参数抽屉 ↔ 预览 — 控制参数抽屉宽度 */}
        <div className={styles.resizeHandle} onMouseDown={onParamResize} />

        {/* 右侧：预览/代码 */}
        <div className={styles.rightPanel}>
          <div className={styles.rightToolbar}>
            <Button
              type={viewMode === 'preview' ? 'primary' : 'default'}
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => setViewMode('preview')}
            >
              预览
            </Button>
            <Button
              type={viewMode === 'editor' ? 'primary' : 'default'}
              size="small"
              icon={<CodeOutlined />}
              onClick={() => setViewMode('editor')}
            >
              代码
            </Button>
            <div style={{ flex: 1 }} />
            <Tooltip title="刷新预览">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={refreshPreview}
                disabled={!code}
              />
            </Tooltip>
          </div>

          <CorrectionLog log={correctionLog} phase={phase} />

          <div className={styles.rightContent}>
            {isProcessing ? (
              <div className={styles.loading}>
                <Spin
                  size="large"
                  indicator={<ThunderboltOutlined style={{ fontSize: 36 }} spin />}
                />
                <Text className={styles.loadingText}>
                  {phaseText[phase] || '处理中...'}
                </Text>
                <Text className={styles.loadingSubText}>
                  第 {currentAttempt}/{maxAttempts} 次尝试
                </Text>
              </div>
            ) : viewMode === 'preview' ? (
              <PreviewWindow code={code} refreshKey={previewKey} />
            ) : (
              <CodeEditor code={code} onChange={() => {}} />
            )}
          </div>
        </div>
      </Content>

      {verificationCode && (
        <VerifierIframe
          key={verificationKey}
          code={verificationCode}
          onError={onVerifierError}
          onSuccess={onVerifierSuccess}
          onLoaded={() => {}}
        />
      )}
    </Layout>
  );
}
