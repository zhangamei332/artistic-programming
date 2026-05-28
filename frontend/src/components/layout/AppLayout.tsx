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
  ExportOutlined,
  SaveOutlined,
  DownloadOutlined,
  CloseOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
} from '@ant-design/icons';
import { NodeCanvas } from '../nodes/NodeCanvas';
import { NodeToolbox } from '../nodes/NodeToolbox';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewWindow, exportStandaloneHTML } from '../preview/PreviewWindow';
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
const TD_PREVIEW_BACKGROUND = '/td-preview-background.jpg';

type ViewMode = 'editor' | 'preview';

export type { NodeData, EdgeData };

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
  const [previewReferenceActive, setPreviewReferenceActive] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);

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

  const handleGenerate = useCallback(
    (prompt: string, model: string, files: File[]) => {
      setViewMode('preview');
      setSelectedNode(null);
      setPreviewReferenceActive(false);
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
      setPreviewReferenceActive(false);
      transformCode(sourceCode, instruction);
    },
    [transformCode],
  );

  const handleImageToCode = useCallback(
    (imageFile: File, instruction: string) => {
      setViewMode('preview');
      setSelectedNode(null);
      setPreviewReferenceActive(false);
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
      setPreviewReferenceActive(false);
    },
    [restoreHistory],
  );

  const handleMoveToParent = useCallback(
    (entryId: string, newParentId: string | null) => {
      moveToParent(entryId, newParentId);

      if (newParentId) {
        const parentEntry = history.find((e) => e.id === newParentId);
        const childEntry = history.find((e) => e.id === entryId);
        if (parentEntry && childEntry) {
          restoreHistory(parentEntry);
          adjustCode(childEntry.prompt);
          setViewMode('preview');
          setSelectedNode(null);
          setPreviewReferenceActive(false);
        }
      }
    },
    [history, moveToParent, restoreHistory, adjustCode],
  );

  const handlePreviewNodeActivate = useCallback(() => {
    setViewMode('preview');
    setSelectedNode(null);
    setPreviewReferenceActive(true);
    if (finalCode) refreshPreview();
  }, [finalCode, refreshPreview]);

  const handlePreviewFullscreen = useCallback(() => {
    setPreviewReferenceActive(true);
    setFullscreenPreview(true);
    if (finalCode) refreshPreview();
  }, [finalCode, refreshPreview]);

  useEffect(() => {
    if (!fullscreenPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenPreview(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenPreview]);

  const code = finalCode || '';
  const nodes = finalNodes || [];
  const edges = finalEdges || [];

  const phaseText: Record<string, string> = {
    generating: 'AI 正在生成代码...',
    verifying: '正在沙箱中验证代码...',
    fixing: `正在修复第 ${currentAttempt} 个错误（最多 ${maxAttempts} 次）...`,
  };

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} className={styles.logo}>
            <PlayCircleOutlined /> 艺术编程
          </Title>
        </div>
        <Space className={styles.headerRight}>
          <Tooltip title="节点模式">
            <Button type="text" icon={<ApartmentOutlined />} className={styles.modeBtn} />
          </Tooltip>
          <Tooltip title="设置">
            <Button type="text" icon={<SettingOutlined />} className={styles.modeBtn} />
          </Tooltip>
        </Space>
      </Header>

      <Content className={styles.content}>
        <NodeToolbox />

        <div className={styles.workspace}>
          <div className={styles.canvasToolbar}>
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
            <Button
              type={viewMode === 'preview' ? 'primary' : 'default'}
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={handlePreviewNodeActivate}
            >
              预览节点
            </Button>
            <Button
              type={viewMode === 'editor' ? 'primary' : 'default'}
              size="small"
              icon={<CodeOutlined />}
              onClick={() => setViewMode((mode) => (mode === 'editor' ? 'preview' : 'editor'))}
            >
              代码
            </Button>
            <Tooltip title="刷新预览节点">
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshPreview} disabled={!code} />
            </Tooltip>
            <div className={styles.toolbarSep} />
            <Tooltip title="在新窗口打开独立预览">
              <Button
                size="small"
                icon={<ExportOutlined />}
                onClick={() => {
                  const html = exportStandaloneHTML(code);
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  window.open(URL.createObjectURL(blob), '_blank');
                }}
                disabled={!code}
              >
                新窗口
              </Button>
            </Tooltip>
            <Tooltip title="保存到 .live-preview/index.html">
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/preview/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ code }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert(`已保存到 ${data.path}`);
                    }
                  } catch {
                    alert('保存失败，请检查后端是否运行');
                  }
                }}
                disabled={!code}
              >
                Live
              </Button>
            </Tooltip>
            <Tooltip title="下载为独立 HTML 文件">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => {
                  const html = exportStandaloneHTML(code);
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `artistic-preview-${Date.now()}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!code}
              />
            </Tooltip>
          </div>

          <NodeCanvas
            key={generationKey}
            nodes={nodes}
            edges={edges}
            previewNode={{
              code,
              refreshKey: previewKey,
              referenceActive: previewReferenceActive,
              referenceBackgroundUrl: TD_PREVIEW_BACKGROUND,
              isProcessing,
              onActivate: handlePreviewNodeActivate,
              onFullscreen: handlePreviewFullscreen,
            }}
            onImageToCode={handleImageToCode}
            onExpandChat={() => setChatCollapsed(false)}
            onNodeSelect={handleNodeSelect}
            onGraphChange={handleGraphChange}
            onGenerateFromGraph={handleGenerateFromGraph}
          />

          <CorrectionLog log={correctionLog} phase={phase} />

          {isProcessing && (
            <div className={styles.loading}>
              <Spin size="large" indicator={<ThunderboltOutlined style={{ fontSize: 36 }} spin />} />
              <Text className={styles.loadingText}>{phaseText[phase] || '处理中...'}</Text>
              <Text className={styles.loadingSubText}>
                第 {currentAttempt}/{maxAttempts} 次尝试
              </Text>
            </div>
          )}

          {viewMode === 'editor' && (
            <div className={styles.codeOverlay}>
              <div className={styles.codeOverlayHeader}>
                <span>生成代码</span>
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => setViewMode('preview')}
                />
              </div>
              <CodeEditor code={code} onChange={() => {}} />
            </div>
          )}
        </div>

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
            onApplyAll={handleApplyAllParams}
            onConnectNodes={handleConnectNodes}
            onRemoveConnection={handleRemoveConnection}
            adjustExplanation={adjustExplanation}
          />
        </div>

        <div className={`${styles.chatDock} ${chatCollapsed ? styles.chatDockCollapsed : ''}`}>
          <button
            type="button"
            className={styles.chatCollapseBtn}
            onClick={() => setChatCollapsed((collapsed) => !collapsed)}
            aria-label={chatCollapsed ? '展开对话' : '收起对话'}
          >
            {chatCollapsed ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
          </button>
          {!chatCollapsed && (
            <>
              <div className={styles.chatColumn}>
                <InputPanel
                  onGenerate={handleGenerate}
                  onAdjust={handleAdjust}
                  onCodeTransform={handleCodeTransform}
                  onImageToCode={handleImageToCode}
                  isProcessing={isProcessing}
                  hasCode={!!code}
                />
              </div>
              <div className={styles.historyColumn}>
                <HistoryPanel
                  history={history}
                  onRestore={handleRestoreHistory}
                  onDelete={deleteHistory}
                  onMoveToParent={handleMoveToParent}
                  activeBaseId={activeBaseHistoryId}
                />
              </div>
            </>
          )}
        </div>
      </Content>

      {fullscreenPreview && (
        <div className={styles.fullscreenPreview}>
          <PreviewWindow
            code={code}
            refreshKey={previewKey}
            referenceActive
            referenceBackgroundUrl={TD_PREVIEW_BACKGROUND}
          />
          <button
            type="button"
            className={styles.fullscreenClose}
            onClick={() => setFullscreenPreview(false)}
            aria-label="退出全屏预览"
          >
            <CloseOutlined />
          </button>
        </div>
      )}

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
