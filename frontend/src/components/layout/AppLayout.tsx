import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Layout, Button, Space, Typography, Tooltip } from 'antd';
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
  ExportOutlined,
  SaveOutlined,
  DownloadOutlined,
  CloseOutlined,
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
import { InputPanel } from '../common/InputPanel';
import { CorrectionLog } from '../common/CorrectionLog';
import { ParamPanel } from '../common/ParamPanel';
import { useAutoFix } from '../../hooks/useAutoFix';
import type { NodeData } from '../../hooks/useAutoFix';
import type { EdgeData } from '../../hooks/useAutoFix';
import {
  CanvasSnapshotFrameSource,
  createDefaultVideoExportDocument,
  VideoExportController,
  VideoExportDialog,
  type VideoExportDocument,
  type VideoExportProgress,
} from '../../video-export-v13';
import styles from './AppLayout.module.css';

const { Header, Content } = Layout;
const { Text } = Typography;
const TD_PREVIEW_BACKGROUND = '';

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
type PageMode = 'home' | 'workspace';

export type { NodeData, EdgeData };

function normalizeModel(model: string): string {
  // Model names are now passed through directly to match backend zod schema
  // Supported: 'deepseekv4', 'chatgpt5.5', 'gemini3.5', 'mimo-v2.5-pro'
  if (model === 'chatgpt5.5') return 'chatgpt5.5';
  if (model === 'gemini3.5') return 'gemini3.5';
  if (model === 'mimo-v2.5-pro') return 'mimo-v2.5-pro';
  if (model === 'deepSeekV4' || model === 'deepseekv4' || model === 'deepseek') return 'deepseekv4';
  return model;
}

async function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('预览帧加载失败'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D 不可用');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
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
      const delta = dragging.current.startX - e.clientX;
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

const homeHeroCards = [
  {
    title: 'AI-Co-Art 导演台',
    sub: '节点、代码与预览串成连续创作流',
    image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: '共创计划',
    sub: '文本、图像、数据和交互一起进入画布',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: '实时视觉实验',
    sub: 'Three.js + GSAP 生成可运行作品',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
  },
];

const homeGalleryCards = [
  { title: '粒子文字海报', author: 'Tassi', image: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=640&q=80' },
  { title: '镜头路径森林', author: 'Forest', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=640&q=80' },
  { title: '交互角色草图', author: 'yomi', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=640&q=80' },
  { title: '数据驱动舞台', author: 'Zeno', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=640&q=80' },
  { title: '声音节奏球体', author: 'ddjiva', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=640&q=80' },
  { title: '手势骨骼光场', author: 'YY', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80' },
];

function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <main className={styles.homePage}>
      <section className={styles.homeHero}>
        <div className={styles.homeCarousel}>
          {homeHeroCards.map((card, index) => (
            <article key={card.title} className={`${styles.homeHeroCard} ${index === 1 ? styles.homeHeroCardActive : ''}`}>
              <img src={card.image} alt="" />
              <div>
                <strong>{card.title}</strong>
                <span>{card.sub}</span>
              </div>
            </article>
          ))}
        </div>
        <div className={styles.homeDots}>
          <span />
          <span className={styles.homeDotActive} />
          <span />
          <span />
        </div>
        <div className={styles.homeActions}>
          <button type="button" onClick={onStart}>
            <PlusCircleOutlined />
            <span>开始创作</span>
          </button>
          <button type="button" onClick={onStart}>
            <PlayCircleOutlined />
            <span>打开节点画布</span>
          </button>
        </div>
      </section>

      <section className={styles.homeGallery}>
        <div className={styles.homeGalleryHeader}>
          <h2>AI-Co-Art Show</h2>
          <div className={styles.homeSearch}>请输入搜索内容</div>
        </div>
        <div className={styles.homeFilters}>
          {['全部', 'Three.js', 'GSAP', '交互节点', '数据视觉', '艺术实验'].map((item) => (
            <button key={item} type="button">{item}</button>
          ))}
        </div>
        <div className={styles.homeGrid}>
          {homeGalleryCards.map((card) => (
            <article key={card.title} className={styles.homeWorkCard}>
              <img src={card.image} alt="" />
              <strong>{card.title}</strong>
              <span>{card.author}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function AppLayout() {
  const [pageMode, setPageMode] = useState<PageMode>('workspace');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [previewReferenceActive, setPreviewReferenceActive] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [memberMarketOpen, setMemberMarketOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('未命名');
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<NodeData[]>([]);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [videoExportDocument, setVideoExportDocument] = useState<VideoExportDocument>(() => createDefaultVideoExportDocument());
  const [videoExportProgress, setVideoExportProgress] = useState<VideoExportProgress | undefined>();
  const [videoCaptureRequestId, setVideoCaptureRequestId] = useState(0);
  const [videoCapture, setVideoCapture] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const videoExportControllerRef = useRef<VideoExportController | null>(null);
  const [inspectorWidth, onInspectorResizeStart, inspectorResizing] = useResizeHandle(
    Number(localStorage.getItem('context-inspector-width')) || 340,
    280,
    480,
  );

  const {
    phase,
    isProcessing,
    finalCode,
    finalNodes,
    finalEdges,
    correctionLog,
    adjustExplanation,
    previewKey,
    requestLog,
    history,
    startAutoFix,
    startPreviewTask,
    startPreviewAdjustmentTask,
    updateNodeParams,
    saveNodeParamsOnly,
    regenerateFromParams,
    adjustCode,
    refreshPreview,
    resetProject,
    syncFromCanvas,
    transformCode,
    imageToCode,
    generationKey,
  } = useAutoFix();

  useEffect(() => {
    localStorage.setItem('context-inspector-width', String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F12') return;
      event.preventDefault();
      setAdminMode((active) => !active);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    setPageMode('home');
    setViewMode('preview');
    setPreviewReferenceActive(false);
    setFullscreenPreview(false);
    setAdminMode(false);
    setProjectMenuOpen(false);
    setProjectsPanelOpen(false);
  }, []);

  const handleStartCreation = useCallback(() => {
    setPageMode('workspace');
    setViewMode('preview');
  }, []);

  const handleOpenProjects = useCallback(() => {
    setProjectsPanelOpen(true);
    setProjectMenuOpen(false);
  }, []);

  const handleCreateProject = useCallback(() => {
    resetProject();
    setProjectTitle('未命名');
    setPageMode('workspace');
    setViewMode('preview');
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
    setPreviewReferenceActive(false);
    setProjectsPanelOpen(false);
    setDeleteProjectConfirmOpen(false);
  }, [resetProject]);

  const handleGenerate = useCallback(
    (prompt: string, model: string, files: File[]) => {
      setPageMode('workspace');
      setViewMode('preview');
      setPreviewReferenceActive(true);
      startAutoFix(prompt, normalizeModel(model), files);
    },
    [startAutoFix],
  );

  const handleNodeGenerate = useCallback(
    (prompt: string, model: string, files: File[], apiPrompt?: string, baseCode?: string) => {
      setPageMode('workspace');
      setViewMode('preview');
      setPreviewReferenceActive(false);
      const normalizedModel = normalizeModel(model);
      if (baseCode?.trim()) {
        return startPreviewAdjustmentTask(baseCode, apiPrompt || prompt, normalizedModel);
      }
      return startPreviewTask(apiPrompt || prompt, normalizedModel, files);
    },
    [startPreviewAdjustmentTask, startPreviewTask],
  );

  const handleAdjust = useCallback(
    (prompt: string) => {
      setPageMode('workspace');
      setViewMode('preview');
      adjustCode(prompt);
    },
    [adjustCode],
  );

  const handleCodeTransform = useCallback(
    (sourceCode: string, instruction: string) => {
      setPageMode('workspace');
      setViewMode('preview');
      setPreviewReferenceActive(true);
      transformCode(sourceCode, instruction);
    },
    [transformCode],
  );

  const handleImageToCode = useCallback(
    (imageFile: File, instruction: string, model = 'deepseekv4') => {
      setPageMode('workspace');
      setViewMode('preview');
      setPreviewReferenceActive(true);
      const normalizedModel = normalizeModel(model);
      imageToCode(imageFile, instruction, normalizedModel);
    },
    [imageToCode],
  );

  const handleParamChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      updateNodeParams(nodeId, key, value);
    },
    [updateNodeParams],
  );

  const handleGraphChange = useCallback(
    (nodes: NodeData[], edges: EdgeData[]) => {
      syncFromCanvas(nodes, edges);
    },
    [syncFromCanvas],
  );

  const handleApplyAllParams = useCallback(() => {
    regenerateFromParams();
    setViewMode('preview');
  }, [regenerateFromParams]);

  const handlePreviewNodeActivate = useCallback(() => {
    setViewMode('preview');
    setPreviewReferenceActive(true);
  }, []);

  const handlePreviewNodeDeactivate = useCallback(() => {
    setPreviewReferenceActive(false);
  }, []);

  const handlePreviewFullscreen = useCallback(() => {
    setPreviewReferenceActive(false);
    setFullscreenPreview(true);
    if (finalCode) refreshPreview();
  }, [finalCode, refreshPreview]);

  const handleOpenVideoExport = useCallback(() => {
    setVideoExportOpen(true);
    setVideoCaptureRequestId(Date.now());
  }, []);

  const handleStartVideoExport = useCallback(() => {
    if (!videoCapture) {
      setVideoCaptureRequestId(Date.now());
      setVideoExportProgress({
        stage: 'error',
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        message: '请等待预览画面捕获完成后再导出视频',
      });
      return;
    }
    const controller = new VideoExportController({
      preview: {
        width: 1920,
        height: 1080,
        timelineDuration: videoExportDocument.range.durationSeconds,
      },
      async createFrameSource(document) {
        const canvas = await dataUrlToCanvas(videoCapture);
        return new CanvasSnapshotFrameSource(canvas, document.range.durationSeconds, document.size.fit);
      },
      onProgress: setVideoExportProgress,
    });
    videoExportControllerRef.current = controller;
    void controller.export(videoExportDocument).catch((error) => {
      setVideoExportProgress({
        stage: error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'error',
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        message: error instanceof Error ? error.message : '视频导出失败',
      });
    });
  }, [videoCapture, videoExportDocument]);

  const handleCancelVideoExport = useCallback(() => {
    videoExportControllerRef.current?.cancel();
  }, []);

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

  // 稳定化 previewNode 对象引用，避免每次渲染都创建新对象导致 NodeCanvas
  // 内部的 layoutedNodes useMemo 和同步 Effect 不必要地重复执行
  const activeRequest = requestLog.find((item) => item.status === 'active');
  const previewNode = useMemo(() => ({
    code,
    refreshKey: previewKey,
    referenceActive: previewReferenceActive,
    referenceBackgroundUrl: TD_PREVIEW_BACKGROUND,
    isProcessing,
    generationStatus: activeRequest ? {
      model: activeRequest.model,
      message: activeRequest.message,
      codeLength: activeRequest.code.length,
    } : undefined,
    onActivate: handlePreviewNodeActivate,
    onDeactivate: handlePreviewNodeDeactivate,
    onFullscreen: handlePreviewFullscreen,
    onSendAnnotation: handleImageToCode,
  }), [activeRequest, code, previewKey, previewReferenceActive, isProcessing, handlePreviewNodeActivate, handlePreviewNodeDeactivate, handlePreviewFullscreen, handleImageToCode]);

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.projectSwitcher} ref={projectMenuRef}>
            <button
              type="button"
              className={styles.logoButton}
              onClick={handleReturnHome}
              aria-label="回到 AI-Co-Art 首页"
            >
              <span className={styles.libLogoMark} aria-hidden="true" />
              <span className={styles.libLogoText}>AI-Co-Art</span>
            </button>
            <button
              type="button"
              className={styles.projectNameButton}
              onClick={() => {
                setProjectMenuOpen((open) => !open);
                setUserMenuOpen(false);
                setMemberMarketOpen(false);
              }}
              aria-expanded={projectMenuOpen}
              aria-label="打开项目菜单"
            >
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
        {pageMode === 'home' ? (
          <HomePage onStart={handleStartCreation} />
        ) : (
          <>
        <NodeToolbox />

        <div className={styles.workspace}>
          <div className={styles.canvasToolbar}>
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
            <Tooltip title="下载 H.264 MP4 视频">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleOpenVideoExport}
                disabled={!code}
              >
                下载视频
              </Button>
            </Tooltip>
          </div>

          <NodeCanvas
            nodes={nodes}
            edges={edges}
            previewNode={previewNode}
            generationKey={generationKey}
            onImageToCode={handleImageToCode}
            onGenerateText={handleNodeGenerate}
            onGraphChange={handleGraphChange}
            onParamChange={handleParamChange}
            onLiveParamsChange={handleApplyAllParams}
            onNodeSelect={(node) => {
              if (!node) {
                setSelectedNode(null);
                setSelectedNodes([]);
                setInspectorCollapsed(true);
                return;
              }
              if (node.type === 'preview' && selectedNode?.type === 'preview' && selectedNode.id === node.id && !inspectorCollapsed) {
                setSelectedNode(null);
                setSelectedNodes([]);
                setInspectorCollapsed(true);
                return;
              }
              setSelectedNode(node);
              setSelectedNodes([node]);
              setInspectorCollapsed(false);
            }}
            onNodeSelectionChange={(selection) => {
              setSelectedNodes(selection);
              if (selection.length === 1) setSelectedNode(selection[0]);
              if (selection.length > 1) {
                setSelectedNode(selection[0]);
                setInspectorCollapsed(false);
              }
            }}
          />

          <CorrectionLog log={correctionLog} phase={phase} />

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

        {!inspectorCollapsed && (
          <div
            className={`${styles.resizeHandle} ${inspectorResizing ? styles.resizing : ''}`}
            onMouseDown={onInspectorResizeStart}
          />
        )}
        <aside
          className={`${styles.contextInspector} ${inspectorCollapsed ? styles.contextInspectorCollapsed : ''}`}
          style={{ width: inspectorCollapsed ? 0 : inspectorWidth }}
        >
          {!inspectorCollapsed && (
            <button
              type="button"
              className={styles.inspectorCollapseBtn}
              onClick={() => setInspectorCollapsed(true)}
              aria-label="收起参数检查器"
            >
              <DoubleRightOutlined />
            </button>
          )}
          {!inspectorCollapsed && (
            <ParamPanel
              selectedNode={selectedNode}
              selectedNodes={selectedNodes}
              projectName={projectTitle}
              allNodes={nodes}
              allEdges={edges}
              onParamChange={handleParamChange}
              onApply={saveNodeParamsOnly}
              onApplyAll={handleApplyAllParams}
              adjustExplanation={adjustExplanation}
            />
          )}
        </aside>

        {adminMode && (
          <div className={`${styles.chatDock} ${styles.adminDock}`}>
            <div className={styles.adminModeTitle}>管理员模式 · F12 关闭</div>
            <div className={styles.chatColumn}>
              <InputPanel
                onGenerate={handleGenerate}
                onAdjust={handleAdjust}
                onCodeTransform={handleCodeTransform}
                onImageToCode={handleImageToCode}
                isProcessing={isProcessing}
                hasCode={!!code}
                requestLog={requestLog}
              />
            </div>
          </div>
        )}
          </>
        )}
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
            referenceActive={false}
            referenceBackgroundUrl=""
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

      {videoExportOpen && code && (
        <div className={styles.videoCaptureHost} aria-hidden="true">
          <PreviewWindow
            code={code}
            refreshKey={previewKey}
            referenceActive={false}
            referenceBackgroundUrl=""
            captureRequestId={videoCaptureRequestId}
            onCapture={(payload) => {
              if (payload.imageDataUrl) setVideoCapture(payload.imageDataUrl);
            }}
          />
        </div>
      )}

      <VideoExportDialog
        open={videoExportOpen}
        document={videoExportDocument}
        previewWidth={1920}
        previewHeight={1080}
        timelineDuration={videoExportDocument.range.durationSeconds}
        progress={videoExportProgress}
        onChange={setVideoExportDocument}
        onStart={handleStartVideoExport}
        onCancel={handleCancelVideoExport}
        onClose={() => setVideoExportOpen(false)}
      />

      {/* 已移除 VerifierIframe — 后台验证会导致长时间黑屏和不必要的自动修复 */}
    </Layout>
  );
}
