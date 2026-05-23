import { useState, useCallback, useRef, useEffect } from 'react';
import { Layout, Button, Space, Typography, Tooltip, Spin } from 'antd';
import {
  CodeOutlined,
  ApartmentOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
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
    saveNodeParamsOnly,
    adjustCode,
    refreshPreview,
    restoreHistory,
    deleteHistory,
    moveToParent,
    activeBaseHistoryId,
    currentAttempt,
    maxAttempts,
    syncFromCanvas,
    addEdge,
    removeEdge,
    generateFromGraph,
    transformCode,
    imageToCode,
  } = useAutoFix();

  // Resizable panel widths — each handle controls the panel to its LEFT
  const [sidebarWidth, onSidebarResize, sidebarResizing] = useResizeHandle(340, 220, 480);
  const [canvasWidth, onCanvasResize, canvasResizing] = useResizeHandle(380, 200, 700);

  const handleGenerate = useCallback(
    (prompt: string, model: string, files: File[]) => {
      setViewMode('preview');
      setSelectedNode(null);
      startAutoFix(prompt, model, files);
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

  const handleCodeTransform = useCallback(
    (sourceCode: string, instruction: string) => {
      setViewMode('preview');
      setSelectedNode(null);
      transformCode(sourceCode, instruction);
    },
    [transformCode],
  );

  const handleImageToCode = useCallback(
    (imageFile: File, instruction: string) => {
      setViewMode('preview');
      setSelectedNode(null);
      imageToCode(imageFile, instruction);
    },
    [imageToCode],
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

  const handleGraphChange = useCallback(
    (nodes: NodeData[], edges: EdgeData[]) => {
      syncFromCanvas(nodes, edges);
    },
    [syncFromCanvas],
  );

  const handleConnectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      addEdge(sourceId, targetId);
    },
    [addEdge],
  );

  const handleRemoveConnection = useCallback(
    (sourceId: string, targetId: string) => {
      removeEdge(sourceId, targetId);
    },
    [removeEdge],
  );

  const handleGenerateFromGraph = useCallback(() => {
    setViewMode('preview');
    generateFromGraph();
  }, [generateFromGraph]);

  const handleSaveLocalParams = useCallback(() => {
    saveNodeParamsOnly();
  }, [saveNodeParamsOnly]);

  const handleApplyAllParams = useCallback(() => {
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

  // 拖拽历史记录形成父子级时，触发代码合并重新生成
  const handleMoveToParent = useCallback(
    (entryId: string, newParentId: string | null) => {
      moveToParent(entryId, newParentId);

      if (newParentId) {
        const parentEntry = history.find((e) => e.id === newParentId);
        const childEntry = history.find((e) => e.id === entryId);
        if (parentEntry && childEntry) {
          // 以父级代码为基础，子级提示词作为调整指令，重新生成代码
          restoreHistory(parentEntry);
          adjustCode(childEntry.prompt);
          setViewMode('preview');
          setSelectedNode(null);
        }
      }
    },
    [history, moveToParent, restoreHistory, adjustCode],
  );

  const code = finalCode || '';
  const nodes = finalNodes || [];
  const edges = finalEdges || [];

  const phaseText: Record<string, string> = {
    generating: 'AI 正在生成代码...',
    verifying: '正在沙箱中验证代码...',
    fixing: `正在修复第 ${currentAttempt} 个错误 (最多 ${maxAttempts} 次)...`,
  };

  const isResizing = sidebarResizing || canvasResizing;

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
            onCodeTransform={handleCodeTransform}
            onImageToCode={handleImageToCode}
            isProcessing={isProcessing}
            hasCode={!!code}
          />
          <HistoryPanel
            history={history}
            onRestore={handleRestoreHistory}
            onDelete={deleteHistory}
            onMoveToParent={handleMoveToParent}
            activeBaseId={activeBaseHistoryId}
          />
        </div>

        {/* 手柄 A: 对话栏 ↔ 工具箱 — 控制对话栏宽度 */}
        <div className={styles.resizeHandle} onMouseDown={onSidebarResize} />

        {/* 节点工具箱 */}
        <NodeToolbox />

        {/* 节点画布 */}
        <div className={styles.centerPanel} style={{ width: canvasWidth }}>
          <NodeCanvas
            key={generationKey}
            nodes={nodes}
            edges={edges}
            onNodeSelect={handleNodeSelect}
            onGraphChange={handleGraphChange}
            onGenerateFromGraph={handleGenerateFromGraph}
          />
        </div>

        {/* 手柄 B: 画布 ↔ 参数抽屉 — 控制画布宽度 */}
        <div className={styles.resizeHandle} onMouseDown={onCanvasResize} />

        {/* 参数抽屉 — 选中节点时滑出 */}
        <div
          className={`${styles.paramDrawer} ${selectedNode ? styles.paramDrawerOpen : ''}`}
          style={{ width: selectedNode ? 290 : 0 }}
        >
          <ParamPanel
            selectedNode={selectedNode}
            allNodes={nodes}
            allEdges={edges}
            onParamChange={handleParamChange}
            onApply={handleSaveLocalParams}
            onConnectNodes={handleConnectNodes}
            onRemoveConnection={handleRemoveConnection}
            adjustExplanation={adjustExplanation}
          />
        </div>

        {/* 右侧：预览/代码 */}
        <div className={styles.rightPanel}>
          <div className={styles.rightToolbar}>
            <Tooltip title="应用所有节点的参数修改并刷新预览">
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={handleApplyAllParams}
                disabled={!code || isProcessing}
              >
                应用全部参数并预览
              </Button>
            </Tooltip>
            <div style={{ flex: 1 }} />
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
