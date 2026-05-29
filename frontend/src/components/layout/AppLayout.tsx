import { useState, useCallback, useRef, useEffect } from 'react';
import { Layout, Button, Space, Typography, Tooltip, Spin } from 'antd';
import {
  CodeOutlined,
  ApartmentOutlined,
  ApiOutlined,
  BellOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  ShareAltOutlined,
  ShopOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  SaveOutlined,
  DownloadOutlined,
  CloseOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  SwapOutlined,
  SkinOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
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
const { Text } = Typography;
const TD_PREVIEW_BACKGROUND = '/td-preview-background.jpg';

const marketPlans = [
  { name: 'Seedance 2.0', sub: '1080P 专享', points: '45,000', price: '¥2999', bonus: '首购加赠45000', desc: '最多生成1324秒视频' },
  { name: 'Seedance 2.0', sub: '1080P 专享', points: '60,000', price: '¥3999', bonus: '首购加赠60000', desc: '最多生成1765秒视频' },
  { name: 'Lib Image', sub: '', points: '7,500', price: '¥499', bonus: '首购加赠7500', desc: '最多生成7500张图片', green: true },
  { name: 'Lib Image', sub: '', points: '15,000', price: '¥999', bonus: '首购加赠15000', desc: '最多生成15000张图片', green: true },
  { name: 'Seedance 2.0', sub: '', points: '3,000', price: '¥199', bonus: '首购加赠3000', desc: '最多生成600秒视频' },
  { name: 'Seedance 2.0', sub: '', points: '7,500', price: '¥499', bonus: '首购加赠7500', desc: '最多生成1500秒视频' },
  { name: 'Seedance 2.0', sub: '', points: '15,000', price: '¥999', bonus: '首购加赠15000', desc: '最多生成3000秒视频' },
  { name: 'Seedance 2.0', sub: '', points: '30,000', price: '¥1999', bonus: '首购加赠30000', desc: '最多生成6000秒视频' },
];

type ViewMode = 'editor' | 'preview';

export type { NodeData, EdgeData };

function normalizeModel(model: string): string {
  if (model === 'chatgpt5.5') return 'gpt';
  if (model === 'gemini3.5') return 'gemini';
  if (model === 'deepSeekV4' || model === 'deepseekv4') return 'deepseek';
  return model;
}

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [memberMarketOpen, setMemberMarketOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('未命名');
  const projectMenuRef = useRef<HTMLDivElement>(null);

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
    resetProject,
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

  useEffect(() => {
    if (!projectMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!projectMenuRef.current?.contains(event.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [projectMenuOpen]);

  const handleReturnHome = useCallback(() => {
    setViewMode('preview');
    setSelectedNode(null);
    setPreviewReferenceActive(false);
    setFullscreenPreview(false);
    setChatCollapsed(true);
    setProjectMenuOpen(false);
    setProjectsPanelOpen(false);
  }, []);

  const handleOpenProjects = useCallback(() => {
    setProjectsPanelOpen(true);
    setProjectMenuOpen(false);
  }, []);

  const handleCreateProject = useCallback(() => {
    resetProject();
    setProjectTitle('未命名');
    setViewMode('preview');
    setSelectedNode(null);
    setPreviewReferenceActive(false);
    setProjectMenuOpen(false);
    setProjectsPanelOpen(false);
    setDeleteProjectConfirmOpen(false);
  }, [resetProject]);

  const handleRequestDeleteProject = useCallback(() => {
    setDeleteProjectConfirmOpen(true);
    setProjectMenuOpen(false);
  }, []);

  const handleConfirmDeleteProject = useCallback(() => {
    resetProject();
    setProjectTitle('未命名');
    setSelectedNode(null);
    setPreviewReferenceActive(false);
    setProjectsPanelOpen(false);
    setDeleteProjectConfirmOpen(false);
  }, [resetProject]);

  const handleGenerate = useCallback(
    (prompt: string, model: string, files: File[]) => {
      setViewMode('preview');
      setSelectedNode(null);
      setPreviewReferenceActive(false);
      startAutoFix(prompt, normalizeModel(model), files);
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
    setPreviewReferenceActive((active) => {
      const next = !active;
      if (next && finalCode) refreshPreview();
      return next;
    });
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
          <div className={styles.projectSwitcher} ref={projectMenuRef}>
            <button
              type="button"
              className={styles.logoButton}
              onClick={() => {
                setProjectMenuOpen((open) => !open);
                setUserMenuOpen(false);
                setMemberMarketOpen(false);
              }}
              aria-expanded={projectMenuOpen}
              aria-label="打开项目菜单"
            >
              <span className={styles.libLogoMark} aria-hidden="true" />
              <span className={styles.libLogoText}>艺术编程</span>
              <span className={styles.projectDivider} />
              <span className={styles.projectName}>{projectTitle}</span>
            </button>
            {projectMenuOpen && (
              <div className={styles.projectMenu}>
                <button type="button" onClick={handleReturnHome}>
                  <HomeOutlined />
                  <span>回到主页</span>
                </button>
                <button type="button" onClick={handleOpenProjects}>
                  <FolderOpenOutlined />
                  <span>全部项目</span>
                </button>
                <div className={styles.projectMenuDivider} />
                <button type="button" onClick={handleCreateProject}>
                  <PlusCircleOutlined />
                  <span>创建新项目</span>
                </button>
                <button type="button" className={styles.projectDeleteItem} onClick={handleRequestDeleteProject}>
                  <DeleteOutlined />
                  <span>删除项目</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <Space className={styles.headerRight}>
          <Tooltip title="CLI/Skills">
            <button type="button" className={styles.headerIconBtn}>
              <ApiOutlined />
            </button>
          </Tooltip>
          <Tooltip title="发布与分享">
            <button type="button" className={styles.headerIconBtn}>
              <ShareAltOutlined />
            </button>
          </Tooltip>
          <Tooltip title="消息通知">
            <button type="button" className={styles.headerIconBtn}>
              <BellOutlined />
              <span className={styles.notifyDot} />
            </button>
          </Tooltip>
          <button
            type="button"
            className={styles.marketBtn}
            onClick={() => {
              setMemberMarketOpen(true);
              setUserMenuOpen(false);
            }}
          >
            <ShopOutlined />
            <span>会员超市</span>
          </button>
          <div className={styles.memberWrap}>
            <button
              type="button"
              className={styles.memberBtn}
              onClick={() => {
                setUserMenuOpen((open) => !open);
                setMemberMarketOpen(false);
              }}
            >
              <CrownOutlined className={styles.memberCenterIcon} />
              <span>会员中心</span>
              <ThunderboltOutlined />
              <span>28</span>
              <span className={styles.avatarMark}>L</span>
            </button>
            {userMenuOpen && (
              <div className={styles.userMenu}>
                <div className={styles.userHero}>
                  <span className={styles.userAvatar}>L</span>
                  <div>
                    <strong>Misistty</strong>
                    <small>UUID ⧉  |  Access key ›</small>
                  </div>
                  <button type="button"><TeamOutlined /> 创建团队</button>
                </div>
                <div className={styles.vipCard}>
                  <div><strong>尊享版VIP</strong><span>2026-05-28到期</span></div>
                  <button type="button">升级会员</button>
                  <p>活动权益： Seedream 4.5 限时5折 有效期 1天 <span>查看更多</span></p>
                </div>
                <div className={styles.infoCard}>
                  <div><strong>积分余额 28 点 ›</strong><span>充值  |  设置消耗顺序</span></div>
                  <p>通用 28 点</p>
                </div>
                <div className={styles.infoCard}>
                  <div><span>存储空间</span><span>管理资产</span></div>
                  <p><strong>13.7G</strong> /500G</p>
                </div>
                <button type="button" className={styles.menuRow}><UserOutlined /> 个人中心</button>
                <button type="button" className={styles.menuRow}><FileTextOutlined /> 订阅与开发票</button>
                <button type="button" className={styles.menuRow}>
                  <SwapOutlined /> 模式切换
                  <span className={styles.themeSwitch}><SunOutlined /><MoonOutlined /></span>
                </button>
                <button type="button" className={styles.menuRow}><SkinOutlined /> AI 水印设置</button>
                <button type="button" className={styles.menuRow}><LogoutOutlined /> 退出登录</button>
              </div>
            )}
          </div>
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
            onGenerateText={handleGenerate}
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
                  generatedCode={code}
                  generatedNodes={nodes}
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

      {memberMarketOpen && (
        <div className={styles.marketOverlay}>
          <div className={styles.marketModal}>
            <button
              type="button"
              className={styles.marketClose}
              onClick={() => setMemberMarketOpen(false)}
              aria-label="关闭会员超市"
            >
              <CloseOutlined />
            </button>
            <div className={styles.marketHero}>
              <h2>Lib 会员超市 <span>限时闪购 买一赠一</span></h2>
              <p>会员专属模型超市，顶级模型画货必选</p>
              <button type="button"><SwapOutlined /> 设置消耗顺序</button>
            </div>
            <div className={styles.marketGrid}>
              {marketPlans.map((plan) => (
                <div
                  key={`${plan.name}-${plan.points}`}
                  className={`${styles.marketPlan} ${plan.green ? styles.marketPlanGreen : ''}`}
                >
                  <span className={styles.planBonus}>{plan.bonus}</span>
                  <h3>{plan.name}</h3>
                  {plan.sub && <strong>{plan.sub}</strong>}
                  <div className={styles.planPoints}><ThunderboltOutlined /> {plan.points}</div>
                  <p>{plan.desc}</p>
                  <button type="button" className={styles.planBuy}>
                    <span>{plan.price}</span>
                    <span>立即购买</span>
                  </button>
                  <small>高级版及以上会员可购买</small>
                </div>
              ))}
            </div>
            <p className={styles.marketNote}>* 模型超市内积分有效期为6个月，支付后不退不换。</p>
          </div>
        </div>
      )}

      {projectsPanelOpen && (
        <div className={styles.projectOverlay} onClick={() => setProjectsPanelOpen(false)}>
          <div className={styles.projectsPanel} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.projectPanelClose}
              onClick={() => setProjectsPanelOpen(false)}
              aria-label="关闭全部项目"
            >
              <CloseOutlined />
            </button>
            <div className={styles.projectsPanelHeader}>
              <FolderOpenOutlined />
              <div>
                <h2>全部项目</h2>
                <p>当前工作区项目</p>
              </div>
            </div>
            <button type="button" className={styles.projectCard} onClick={() => setProjectsPanelOpen(false)}>
              <span className={styles.projectCardIcon}><PlayCircleOutlined /></span>
              <span>
                <strong>{projectTitle}</strong>
                <small>{history.length} 条历史记录</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {deleteProjectConfirmOpen && (
        <div className={styles.projectOverlay} onClick={() => setDeleteProjectConfirmOpen(false)}>
          <div className={styles.deleteProjectDialog} onClick={(event) => event.stopPropagation()}>
            <DeleteOutlined />
            <h2>删除项目？</h2>
            <p>当前画布、代码、节点和历史记录会被清空。</p>
            <div>
              <button type="button" onClick={() => setDeleteProjectConfirmOpen(false)}>取消</button>
              <button type="button" onClick={handleConfirmDeleteProject}>删除项目</button>
            </div>
          </div>
        </div>
      )}

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
