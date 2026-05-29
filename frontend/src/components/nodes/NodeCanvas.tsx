import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  AppstoreOutlined,
  AimOutlined,
  BgColorsOutlined,
  BorderOuterOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  CopyOutlined,
  DownOutlined,
  DownloadOutlined,
  GroupOutlined,
  LinkOutlined,
  MinusOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ShareAltOutlined,
  UngroupOutlined,
} from '@ant-design/icons';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  Handle,
  Position,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from 'reactflow';
import dagre from 'dagre';
import { nodeTypesMap, categoryFromNodeType } from './TDNodes';
import type { TDNodeData } from './TDNodes';
import { PreviewWindow } from '../preview/PreviewWindow';
import 'reactflow/dist/style.css';
import styles from './NodeCanvas.module.css';

const PREVIEW_NODE_ID = '__preview_node__';
const INTERNAL_NODE_PREFIX = '__';
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 80;
const IMAGE_SOURCE_NODE_WIDTH = 460;
const IMAGE_SOURCE_NODE_HEIGHT = 330;
const GROUP_PADDING = 48;
const GROUP_NODE_TYPE = 'groupFrame';

const GROUP_COLORS = [
  'transparent',
  'rgba(255, 63, 58, 0.16)',
  'rgba(255, 149, 0, 0.16)',
  'rgba(255, 204, 0, 0.16)',
  'rgba(52, 199, 89, 0.16)',
  'rgba(50, 215, 205, 0.16)',
  'rgba(10, 132, 255, 0.16)',
  'rgba(94, 92, 230, 0.16)',
  'rgba(255, 45, 146, 0.16)',
  'rgba(174, 174, 178, 0.16)',
];

const NODE_MODEL_POINT_COST: Record<string, number> = {
  'chatgpt5.5': 26,
  'gemini3.5': 32,
  deepSeekV4: 18,
};

interface SelectionFrameState {
  x: number;
  y: number;
  w: number;
  h: number;
  nodeIds: string[];
}

interface GroupFrameNodeData {
  label: string;
  color: string;
  nodeCount: number;
}

export interface NodeData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
}

interface NodeCanvasProps {
  nodes: NodeData[];
  edges?: EdgeData[];
  previewNode?: {
    code: string;
    refreshKey?: number;
    referenceActive: boolean;
    referenceBackgroundUrl: string;
    isProcessing: boolean;
    onActivate: () => void;
    onFullscreen: () => void;
  };
  onImageToCode?: (imageFile: File, instruction: string) => void;
  onGenerateText?: (prompt: string, model: string, files: File[]) => void;
  onExpandChat?: () => void;
  onNodeSelect?: (node: NodeData | null) => void;
  /** Called whenever the graph changes so the parent can sync global state */
  onGraphChange?: (nodes: NodeData[], edges: EdgeData[]) => void;
  /** Called when user clicks "生成节点代码并预览" button */
  onGenerateFromGraph?: () => void;
}

interface PreviewNodeData {
  label: string;
  nodeType: 'preview';
  code: string;
  refreshKey?: number;
  referenceActive: boolean;
  referenceBackgroundUrl: string;
  isProcessing: boolean;
  onActivate: () => void;
  onFullscreen: () => void;
  onStartReferenceDrag?: (sourceId: string) => void;
  onOpenReferenceMenu?: (sourceId: string, clientX: number, clientY: number) => void;
}

interface ImageSourceNodeData {
  label: string;
  nodeType: 'imageSource';
  file?: File;
  previewUrl?: string;
  openPromptToken?: number;
  onFileChange: (nodeId: string, file: File, previewUrl: string) => void;
  onSubmit: (file: File | undefined, instruction: string, model: string, resolution: string) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextSourceNodeData {
  label: string;
  nodeType: 'textSource';
  fileName: string;
  content: string;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface ImageToCodeNodeData {
  label: string;
  nodeType: 'imageToCode';
  linkedFile?: File;
  linkedPreviewUrl?: string;
  onSubmit: (file: File | undefined, instruction: string, model: string, resolution: string) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextChoiceNodeData {
  label: string;
  nodeType: 'textChoice';
  onCreateEditor: (sourceId: string, x: number, y: number) => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextEditorNodeData {
  label: string;
  nodeType: 'textEditor';
  onSubmit: (prompt: string, model: string, files: File[]) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface AddMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  sourceId?: string;
}

interface ReferenceMenuState extends AddMenuState {
  sourceId: string;
}

interface CanvasMapNodeItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: 'preview' | 'image' | 'text' | 'group' | 'default';
  imageUrl?: string;
}

interface CanvasMapLineItem {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface CanvasMapFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CANVAS_MAP_WIDTH = 224;
const CANVAS_MAP_HEIGHT = 164;
const CANVAS_MAP_PADDING = 14;

function isInternalNodeId(id: string): boolean {
  return id.startsWith(INTERNAL_NODE_PREFIX);
}

function isTextFile(file: File): boolean {
  return file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
}

function nodeWidth(node: Node): number {
  if (typeof node.width === 'number') return node.width;
  const styleWidth = node.style?.width;
  return typeof styleWidth === 'number' ? styleWidth : DEFAULT_NODE_WIDTH;
}

function nodeHeight(node: Node): number {
  if (typeof node.height === 'number') return node.height;
  const styleHeight = node.style?.height;
  return typeof styleHeight === 'number' ? styleHeight : DEFAULT_NODE_HEIGHT;
}

function isGroupNode(node: Node): boolean {
  return node.type === GROUP_NODE_TYPE || node.type === 'group';
}

function canSelectForGroup(node: Node): boolean {
  return !node.parentNode && node.id !== PREVIEW_NODE_ID;
}

function nodesBounds(nodes: Node[]): { x: number; y: number; w: number; h: number } | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth(node)));
  const maxY = Math.max(...nodes.map((node) => node.position.y + nodeHeight(node)));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Convert ReactFlow nodes back to plain NodeData (reverse of createFlowNodes) */
function flowNodesToNodeData(rfNodes: Node[]): NodeData[] {
  return rfNodes.filter((n) => !isInternalNodeId(n.id)).map((n) => {
    const data = n.data as TDNodeData;
    return {
      id: n.id,
      type: data.nodeType || '',
      label: data.label || '',
      params: data.params || {},
      position: n.positionAbsolute || n.position,
    };
  });
}

/** Convert ReactFlow edges back to plain EdgeData (reverse of createFlowEdges) */
function flowEdgesToEdgeData(rfEdges: Edge[]): EdgeData[] {
  return rfEdges
    .filter((e) => !isInternalNodeId(e.source) && !isInternalNodeId(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));
}

function dagreLayout(rfNodes: Node[], rfEdges: Edge[]): Node[] {
  if (rfEdges.length === 0) return rfNodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 180, marginx: 40, marginy: 40 });

  for (const node of rfNodes) {
    g.setNode(node.id, { width: 150, height: 80 });
  }
  for (const edge of rfEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return rfNodes.map((node) => {
    const pos = g.node(node.id);
    if (pos) {
      return { ...node, position: { x: pos.x - 75, y: pos.y - 40 } };
    }
    return node;
  });
}

function createFlowNodes(apiNodes: NodeData[]): Node[] {
  return apiNodes.map((n) => {
    const cat = categoryFromNodeType(n.type);
    return {
      id: n.id,
      type: cat,
      position: n.position,
      data: {
        label: n.label,
        nodeType: n.type,
        params: n.params,
      } satisfies TDNodeData,
    };
  });
}

function createFlowEdges(apiEdges: EdgeData[]): Edge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#999', strokeWidth: 2 },
  }));
}

const PreviewFlowNode = memo((props: NodeProps<PreviewNodeData>) => {
  const { id, data } = props;

  const handleActivate = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onActivate();
  }, [data]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    data.onFullscreen();
  }, [data]);

  const handleExport = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleFullscreenClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    data.onFullscreen();
  }, [data]);

  return (
    <div
      className={`${styles.previewNode} nowheel ${data.referenceActive ? styles.previewNodeActive : ''}`}
      onClick={handleActivate}
      onWheel={handleWheel}
      onWheelCapture={handleWheel}
    >
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      {data.onStartReferenceDrag && data.onOpenReferenceMenu && (
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag?.(id)}
          onClick={(event) => data.onOpenReferenceMenu?.(id, event.clientX + 64, event.clientY)}
        />
      )}
      <div className={styles.previewTitle}>
        <span>{data.label}</span>
        <span>{data.isProcessing ? 'RUNNING' : 'PREVIEW'}</span>
      </div>
      <div className={styles.previewViewport}>
        <div className={`${styles.previewToolbar} nodrag`}>
          <button type="button" title="下载并导出 MP4" onClick={handleExport}>⇩</button>
          <button type="button" title="全屏扩大" onClick={handleFullscreenClick}>↗</button>
        </div>
        <PreviewWindow
          code={data.code}
          refreshKey={data.refreshKey}
          referenceActive={data.referenceActive}
          referenceBackgroundUrl={data.referenceBackgroundUrl}
        />
        <div className={`${styles.previewHitArea} nowheel nodrag`} />
      </div>
    </div>
  );
});

const ImageSourceFlowNode = memo((props: NodeProps<ImageSourceNodeData>) => {
  const { id, data } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('chatgpt5.5');
  const [resolution, setResolution] = useState('16:9 · 2K');
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const acceptFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    data.onFileChange(id, file, URL.createObjectURL(file));
  }, [data, id]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }, [acceptFile]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [expanded, id, updateNodeInternals]);

  useEffect(() => {
    if (data.openPromptToken) {
      setExpanded(true);
    }
  }, [data.openPromptToken]);

  const submit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onSubmit(data.file, prompt, model, resolution);
  }, [data, prompt, model, resolution]);

  const toggleExpanded = useCallback(() => {
    setExpanded((open) => !open);
  }, []);

  return (
    <div
      className={`${styles.imageSourceNode} ${expanded ? styles.imageSourceNodeExpanded : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <div className={styles.imageSourceFrame} onClick={toggleExpanded}>
        <Handle type="target" position={Position.Left} className={styles.largeHandle} />
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag(id)}
          onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
        />
        <div className={styles.imageNodeTitle}>图片节点</div>
        <button
          type="button"
          className={`${styles.uploadPill} nodrag`}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          上传
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) acceptFile(file);
            event.target.value = '';
          }}
        />
        {data.previewUrl ? (
          <img src={data.previewUrl} alt={data.file?.name || 'image'} className={styles.imagePreview} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <div className={styles.imageGlyph}>▰</div>
            <div className={styles.imageHint}>拖入图片或点击上传</div>
          </div>
        )}
      </div>
      {expanded && (
        <div className={styles.imagePromptPanel} onClick={(event) => event.stopPropagation()}>
          <button type="button" className={`${styles.expandNodeBtn} nodrag`} onClick={data.onExpandChat}>
            ↗
          </button>
          <div className={styles.nodePromptTools}>
            <button type="button">风格</button>
            <button type="button">标记</button>
            <button type="button">聚焦</button>
            {data.previewUrl && (
              <img src={data.previewUrl} alt="linked" className={styles.linkedThumb} />
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className={styles.imagePrompt}
            placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
          />
          <div className={styles.nodeBottomBar}>
            <button type="button" onClick={() => setModelOpen((open) => !open)}>
              {model}
            </button>
            <button type="button" onClick={() => setResolutionOpen((open) => !open)}>
              {resolution}
            </button>
            <button type="button">摄像机</button>
            <span>1张</span>
            <button type="button" className={styles.submitNodeBtn} onClick={submit}>
              ↑
            </button>
          </div>
          {modelOpen && (
            <div className={styles.modelMenu}>
              {['chatgpt5.5', 'gemini3.5', 'deepSeekV4'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === model ? styles.menuSelected : ''}
                  onClick={() => {
                    setModel(item);
                    setModelOpen(false);
                  }}
                >
                  <span>{item}</span>
                  <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
                </button>
              ))}
            </div>
          )}
          {resolutionOpen && (
            <div className={styles.resolutionMenu}>
              <div className={styles.menuCaption}>分辨率</div>
              <div className={styles.segmentRow}>
                {['1K', '2K', '4K'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={resolution.includes(item) ? styles.menuSelected : ''}
                    onClick={() => setResolution((current) => current.replace(/1K|2K|4K/, item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className={styles.menuCaption}>比例</div>
              <div className={styles.ratioGrid}>
                {['自适应', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={resolution.startsWith(item) ? styles.menuSelected : ''}
                    onClick={() => {
                      const size = resolution.match(/1K|2K|4K/)?.[0] || '2K';
                      setResolution(`${item} · ${size}`);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const TextSourceFlowNode = memo((props: NodeProps<TextSourceNodeData>) => {
  const { id, data } = props;
  const excerpt = data.content.trim().slice(0, 180);

  return (
    <div className={styles.textSourceNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <div className={styles.textSourceTitle}>文本节点</div>
      <div className={styles.textSourceName}>{data.fileName}</div>
      <div className={styles.textSourceExcerpt}>{excerpt || '空文本文件'}</div>
    </div>
  );
});

const ImageToCodeFlowNode = memo((props: NodeProps<ImageToCodeNodeData>) => {
  const { id, data } = props;
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('chatgpt5.5');
  const [resolution, setResolution] = useState('16:9 · 2K');
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const submit = useCallback(() => {
    data.onSubmit(data.linkedFile, prompt, model, resolution);
  }, [data, prompt, model, resolution]);

  return (
    <div className={styles.imageToCodeNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <button type="button" className={`${styles.expandNodeBtn} nodrag`} onClick={data.onExpandChat}>
        ↗
      </button>
      <div className={styles.nodePromptTools}>
        <button type="button">风格</button>
        <button type="button">标记</button>
        <button type="button">聚焦</button>
        {data.linkedPreviewUrl && (
          <img src={data.linkedPreviewUrl} alt="linked" className={styles.linkedThumb} />
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className={styles.imagePrompt}
        placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
      />
      <div className={styles.nodeBottomBar}>
        <button type="button" onClick={() => setModelOpen((open) => !open)}>
          {model}
        </button>
        <button type="button" onClick={() => setResolutionOpen((open) => !open)}>
          {resolution}
        </button>
        <button type="button">摄像机</button>
        <span>1张</span>
        <button type="button" className={styles.submitNodeBtn} onClick={submit}>
          ↑
        </button>
      </div>
      {modelOpen && (
        <div className={styles.modelMenu}>
          {['chatgpt5.5', 'gemini3.5', 'deepSeekV4'].map((item) => (
            <button
              key={item}
              type="button"
              className={item === model ? styles.menuSelected : ''}
              onClick={() => {
                setModel(item);
                setModelOpen(false);
              }}
            >
              <span>{item}</span>
              <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
            </button>
          ))}
        </div>
      )}
      {resolutionOpen && (
        <div className={styles.resolutionMenu}>
          <div className={styles.menuCaption}>分辨率</div>
          <div className={styles.segmentRow}>
            {['1K', '2K', '4K'].map((item) => (
              <button
                key={item}
                type="button"
                className={resolution.includes(item) ? styles.menuSelected : ''}
                onClick={() => setResolution((current) => current.replace(/1K|2K|4K/, item))}
              >
                {item}
              </button>
            ))}
          </div>
          <div className={styles.menuCaption}>比例</div>
          <div className={styles.ratioGrid}>
            {['自适应', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'].map((item) => (
              <button
                key={item}
                type="button"
                className={resolution.startsWith(item) ? styles.menuSelected : ''}
                onClick={() => {
                  const size = resolution.match(/1K|2K|4K/)?.[0] || '2K';
                  setResolution(`${item} · ${size}`);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const TextChoiceFlowNode = memo((props: NodeProps<TextChoiceNodeData>) => {
  const { id, data } = props;

  return (
    <div className={styles.textChoiceNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <div className={styles.textNodeTitle}>文本节点</div>
      <div className={styles.textNodeIcon}>☰</div>
      <div className={styles.textTryLabel}>尝试:</div>
      <button
        type="button"
        className={`${styles.textChoiceItem} nodrag`}
        onClick={() => data.onCreateEditor(id, props.xPos, props.yPos)}
      >
        <span>▤</span>自己编辑内容
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>▶</span>文生视频
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>▧</span>图片反推提示词
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>♩</span>文字生音乐
      </button>
    </div>
  );
});

const TextEditorFlowNode = memo((props: NodeProps<TextEditorNodeData>) => {
  const { id, data } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [model, setModel] = useState('chatgpt5.5');
  const [modelOpen, setModelOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const submit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onSubmit(content, model, files);
  }, [content, data, files, model]);

  return (
    <div className={styles.textEditorWrap}>
      <div className={`${styles.textToolbar} nodrag`}>
        <button type="button">⊘</button>
        <button type="button">H1</button>
        <button type="button">H2</button>
        <button type="button">H3</button>
        <button type="button">¶</button>
        <button type="button">B</button>
        <button type="button">I</button>
        <button type="button">☷</button>
        <button type="button">☰</button>
        <button type="button">─</button>
        <button type="button">□</button>
        <button type="button" onClick={data.onExpandChat}>↗</button>
      </div>
      <div className={styles.textEditorTitle}>▤ 文本节点</div>
      <div
        className={styles.textEditorNode}
        onInput={(event) => {
          const target = event.target as HTMLTextAreaElement;
          if (target.tagName === 'TEXTAREA') setContent(target.value);
        }}
      >
        <Handle type="target" position={Position.Left} className={styles.largeHandle} />
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag(id)}
          onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
        />
        <textarea className={`${styles.textEditorArea} nodrag`} placeholder="输入内容..." />
      </div>
      <div className={styles.textPromptPanel} onClick={(event) => event.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <div className={styles.nodePromptTools}>
          <button type="button" onClick={() => fileInputRef.current?.click()}>上传内容</button>
          <button type="button">标记</button>
          <button type="button">引用</button>
          {files.length > 0 && <span className={styles.textFileCount}>{files.length} 个文件</span>}
        </div>
        <div className={styles.nodeBottomBar}>
          <button type="button" onClick={() => setModelOpen((open) => !open)}>
            {model}
          </button>
          <span className={styles.nodePointCost}>{NODE_MODEL_POINT_COST[model]}</span>
          <button type="button">文本</button>
          <span>{content.trim().length || 0}字</span>
          <button
            type="button"
            className={styles.submitNodeBtn}
            onClick={submit}
            disabled={!content.trim()}
          >
            鈫?
          </button>
        </div>
        {modelOpen && (
          <div className={styles.modelMenu}>
            {['chatgpt5.5', 'gemini3.5', 'deepSeekV4'].map((item) => (
              <button
                key={item}
                type="button"
                className={item === model ? styles.menuSelected : ''}
                onClick={() => {
                  setModel(item);
                  setModelOpen(false);
                }}
              >
                <span>{item}</span>
                <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const GroupFrameFlowNode = memo((props: NodeProps<GroupFrameNodeData>) => {
  const { data, selected } = props;
  return (
    <div
      className={`${styles.groupFrameNode} ${selected ? styles.groupFrameNodeSelected : ''}`}
      style={{ background: data.color || 'rgba(255, 255, 255, 0.08)' }}
    >
      <div className={styles.groupFrameLabel}>{data.nodeCount ? data.label : '分组'}</div>
    </div>
  );
});

function createPreviewFlowNode(previewNode: NonNullable<NodeCanvasProps['previewNode']>, apiNodes: NodeData[]): Node<PreviewNodeData> {
  const maxX = apiNodes.reduce((acc, node) => Math.max(acc, node.position.x), 160);
  const minY = apiNodes.reduce((acc, node) => Math.min(acc, node.position.y), 120);

  return {
    id: PREVIEW_NODE_ID,
    type: 'preview',
    position: { x: maxX + 320, y: minY },
    draggable: true,
    deletable: false,
    data: {
      label: 'Preview Output',
      nodeType: 'preview',
      ...previewNode,
    },
  };
}

function CanvasInner({
  nodes,
  edges,
  previewNode,
  onImageToCode,
  onGenerateText,
  onExpandChat,
  onNodeSelect,
  onGraphChange,
  onGenerateFromGraph,
}: NodeCanvasProps) {
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [contextMenu, setContextMenu] = useState<AddMenuState | null>(null);
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenuState | null>(null);
  const connectSourceRef = useRef<string | null>(null);

  // ---- selection box state (right-click drag) ----
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrameState | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [arrangeMenuOpen, setArrangeMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [canvasMapOpen, setCanvasMapOpen] = useState(false);
  const [gridSnapActive, setGridSnapActive] = useState(false);
  const [organizeConfirmOpen, setOrganizeConfirmOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(21);
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const selStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSelecting = useRef(false);
  const hasSelectionDrag = useRef(false);
  const ignoreNextContextMenu = useRef(false);
  const skipNextPaneClickRef = useRef(false);

  // stale-closure insurance: always-current refs for flowNodes / flowEdges
  const flowNodesRef = useRef<Node[]>([]);
  const flowEdgesRef = useRef<Edge[]>([]);

  const nodeTypes = useMemo(
    () => ({
      ...nodeTypesMap,
      preview: PreviewFlowNode,
      imageSource: ImageSourceFlowNode,
      textSource: TextSourceFlowNode,
      imageToCode: ImageToCodeFlowNode,
      textChoice: TextChoiceFlowNode,
      textEditor: TextEditorFlowNode,
      [GROUP_NODE_TYPE]: GroupFrameFlowNode,
    }),
    [],
  );
  const initialNodes = useMemo(() => createFlowNodes(nodes), [nodes]);
  const initialEdges = useMemo(() => createFlowEdges(edges || []), [edges]);

  const layoutedNodes = useMemo(() => {
    const regularNodes = dagreLayout(initialNodes, initialEdges);
    if (!previewNode) return regularNodes;
    return [...regularNodes, createPreviewFlowNode(previewNode, nodes)];
  }, [initialNodes, initialEdges, previewNode, nodes]);

  const [flowNodes, setFlowNodes] = useNodesState(layoutedNodes);
  const [flowEdges, setFlowEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    setFlowNodes((current) => {
      const internalNodes = current.filter((node) => (
        isInternalNodeId(node.id) && node.id !== PREVIEW_NODE_ID
      ));
      return [...layoutedNodes, ...internalNodes];
    });
    setFlowEdges((current) => {
      const internalEdges = current.filter((edge) => (
        isInternalNodeId(edge.source) || isInternalNodeId(edge.target)
      ));
      return [...initialEdges, ...internalEdges];
    });
  }, [layoutedNodes, initialEdges, setFlowNodes, setFlowEdges]);

  // keep refs current to avoid stale closures in event listeners
  flowNodesRef.current = flowNodes;
  flowEdgesRef.current = flowEdges;

  const buildFrameFromNodes = useCallback((selectedNodes: Node[]): SelectionFrameState | null => {
    const bounds = nodesBounds(selectedNodes);
    if (!bounds) return null;
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return null;
    const topLeft = screenToFlowPosition({ x: canvasBounds.left, y: canvasBounds.top });
    const bottomRight = screenToFlowPosition({ x: canvasBounds.left + 1, y: canvasBounds.top + 1 });
    const zoom = Math.abs(1 / (bottomRight.x - topLeft.x || 1));
    return {
      x: (bounds.x - topLeft.x) * zoom - 26,
      y: (bounds.y - topLeft.y) * zoom - 26,
      w: bounds.w * zoom + 52,
      h: bounds.h * zoom + 52,
      nodeIds: selectedNodes.map((node) => node.id),
    };
  }, [screenToFlowPosition]);

  const groupSelectedNodes = useCallback(() => {
    setFlowNodes((current) => {
      const selectedIds = new Set([
        ...(selectionFrame?.nodeIds || []),
        ...current.filter((node) => node.selected).map((node) => node.id),
      ]);
      const selectedNodes = current.filter((node) => (
        selectedIds.has(node.id) && canSelectForGroup(node)
      ));
      if (selectedNodes.length < 2) return current;

      const bounds = nodesBounds(selectedNodes);
      if (!bounds) return current;
      const groupPosition = {
        x: bounds.x - GROUP_PADDING,
        y: bounds.y - GROUP_PADDING,
      };
      const groupId = `__group_${Date.now()}`;
      const groupNode: Node = {
        id: groupId,
        type: GROUP_NODE_TYPE,
        position: groupPosition,
        data: { label: '分组', color: 'transparent', nodeCount: selectedNodes.length } satisfies GroupFrameNodeData,
        style: {
          width: bounds.w + GROUP_PADDING * 2,
          height: bounds.h + GROUP_PADDING * 2,
        },
        selected: true,
      };

      setActiveGroupId(groupId);
      setSelectionFrame(null);
      setArrangeMenuOpen(false);
      setGroupMenuOpen(false);
      setColorMenuOpen(false);

      const nextNodes = [
        groupNode,
        ...current.map((node) => {
          if (!selectedIds.has(node.id)) return { ...node, selected: false };
          return {
            ...node,
            parentNode: groupId,
            extent: 'parent' as const,
            position: {
              x: node.position.x - groupPosition.x,
              y: node.position.y - groupPosition.y,
            },
            selected: false,
          };
        }),
      ];
      onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
      return nextNodes;
    });
  }, [onGraphChange, selectionFrame, setFlowNodes]);

  const arrangeSelectedNodes = useCallback((mode: 'grid' | 'horizontal' | 'vertical') => {
    const nodeIds = selectionFrame?.nodeIds || [];
    if (nodeIds.length === 0) return;

    setFlowNodes((current) => {
      const selectedNodes = current.filter((node) => nodeIds.includes(node.id) && canSelectForGroup(node));
      const bounds = nodesBounds(selectedNodes);
      if (!bounds) return current;

      const gap = 24;
      let cursorX = bounds.x;
      let cursorY = bounds.y;
      const maxHeight = Math.max(...selectedNodes.map(nodeHeight));
      const maxWidth = Math.max(...selectedNodes.map(nodeWidth));
      const cols = Math.max(1, Math.ceil(Math.sqrt(selectedNodes.length)));
      const positions = new Map<string, { x: number; y: number }>();

      selectedNodes.forEach((node, index) => {
        if (mode === 'horizontal') {
          positions.set(node.id, { x: cursorX, y: bounds.y });
          cursorX += nodeWidth(node) + gap;
          return;
        }
        if (mode === 'vertical') {
          positions.set(node.id, { x: bounds.x, y: cursorY });
          cursorY += nodeHeight(node) + gap;
          return;
        }
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions.set(node.id, {
          x: bounds.x + col * (maxWidth + gap),
          y: bounds.y + row * (maxHeight + gap),
        });
      });

      const next = current.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position, selected: true } : node;
      });
      setSelectionFrame(buildFrameFromNodes(next.filter((node) => nodeIds.includes(node.id))));
      setArrangeMenuOpen(false);
      return next;
    });
  }, [buildFrameFromNodes, selectionFrame, setFlowNodes]);

  const duplicateSelectedNodes = useCallback(() => {
    const nodeIds = selectionFrame?.nodeIds || [];
    if (nodeIds.length === 0) return;

    const idMap = new Map<string, string>();
    const selectedIds = new Set(nodeIds);
    const stamp = Date.now();
    const copiedNodes = flowNodesRef.current
      .filter((node) => selectedIds.has(node.id) && canSelectForGroup(node))
      .map((node, index) => {
        const id = `${node.id}_copy_${stamp}_${index}`;
        idMap.set(node.id, id);
        return {
          ...node,
          id,
          position: { x: node.position.x + 42, y: node.position.y + 42 },
          selected: true,
        };
      });
    if (copiedNodes.length === 0) return;

    const copiedEdges = flowEdgesRef.current
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge, index) => ({
        ...edge,
        id: `${edge.id}_copy_${stamp}_${index}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));
    const copiedIds = new Set(copiedNodes.map((node) => node.id));
    const nextNodes = [
      ...flowNodesRef.current.map((node) => ({ ...node, selected: false })),
      ...copiedNodes,
    ];
    const nextEdges = [...flowEdgesRef.current, ...copiedEdges];
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    setSelectionFrame(buildFrameFromNodes(nextNodes.filter((node) => copiedIds.has(node.id))));
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [buildFrameFromNodes, onGraphChange, selectionFrame, setFlowEdges, setFlowNodes]);

  const ungroupActiveGroup = useCallback(() => {
    if (!activeGroupId) return;
    setFlowNodes((current) => {
      const groupNode = current.find((node) => node.id === activeGroupId);
      if (!groupNode) return current;
      return current
        .filter((node) => node.id !== activeGroupId)
        .map((node) => {
          if (node.parentNode !== activeGroupId) return node;
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            position: {
              x: groupNode.position.x + node.position.x,
              y: groupNode.position.y + node.position.y,
            },
            selected: true,
          };
        });
    });
    setActiveGroupId(null);
    setColorMenuOpen(false);
  }, [activeGroupId, setFlowNodes]);

  const updateActiveGroupColor = useCallback((color: string) => {
    if (!activeGroupId) return;
    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id !== activeGroupId) return node;
        const data = node.data as Partial<GroupFrameNodeData>;
        return { ...node, data: { ...data, color } };
      }),
    );
    setColorMenuOpen(false);
  }, [activeGroupId, setFlowNodes]);

  const handleOrganizeCanvas = useCallback(() => {
    fitView({ padding: 0.16, duration: 260 });
    setOrganizeConfirmOpen(true);
  }, [fitView]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 180 });
  }, [zoomOut]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 180 });
  }, [zoomIn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        groupSelectedNodes();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [groupSelectedNodes]);

  const startReferenceDrag = useCallback((sourceId: string) => {
    connectSourceRef.current = sourceId;
    setAddMenu(null);
    setReferenceMenu(null);
  }, []);

  const openReferenceMenuAt = useCallback((sourceId: string, clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
    setReferenceMenu({
      sourceId,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
  }, [screenToFlowPosition]);

  useEffect(() => {
    setFlowNodes((current) =>
      current.map((node) => (
        node.id === PREVIEW_NODE_ID
          ? {
              ...node,
              data: {
                ...node.data,
                onStartReferenceDrag: startReferenceDrag,
                onOpenReferenceMenu: openReferenceMenuAt,
              },
            }
          : node
      )),
    );
  }, [setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  // ---- right-click drag → rectangular selection ----
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // only on empty canvas, not on nodes/edges
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('[data-selection-ui="true"]') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap')
      ) return;
      e.preventDefault();
      e.stopPropagation();

      const bounds = el.getBoundingClientRect();
      isSelecting.current = true;
      hasSelectionDrag.current = false;
      setSelectionFrame(null);
      setActiveGroupId(null);
      setArrangeMenuOpen(false);
      setGroupMenuOpen(false);
      setColorMenuOpen(false);
      selStart.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      setSelBox({ x: selStart.current.x, y: selStart.current.y, w: 0, h: 0 });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSelecting.current) return;
      e.preventDefault();
      const bounds = el.getBoundingClientRect();
      const cx = e.clientX - bounds.left;
      const cy = e.clientY - bounds.top;
      if (Math.abs(cx - selStart.current.x) > 5 || Math.abs(cy - selStart.current.y) > 5) {
        hasSelectionDrag.current = true;
      }
      setSelBox({
        x: Math.min(selStart.current.x, cx),
        y: Math.min(selStart.current.y, cy),
        w: Math.abs(cx - selStart.current.x),
        h: Math.abs(cy - selStart.current.y),
      });
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (!isSelecting.current) return;
      isSelecting.current = false;
      ignoreNextContextMenu.current = hasSelectionDrag.current;
      skipNextPaneClickRef.current = hasSelectionDrag.current;

      setSelBox((current) => {
        if (!current || !hasSelectionDrag.current) return null;

        const bounds = el.getBoundingClientRect();
        // convert screen-rect corners to flow coordinates
        const tl = screenToFlowPosition({ x: bounds.left + current.x, y: bounds.top + current.y });
        const br = screenToFlowPosition({ x: bounds.left + current.x + current.w, y: bounds.top + current.y + current.h });
        const fx = Math.min(tl.x, br.x);
        const fy = Math.min(tl.y, br.y);
        const fw = Math.abs(br.x - tl.x);
        const fh = Math.abs(br.y - tl.y);

        setFlowNodes((nds) => {
          const selectedNodes: Node[] = [];
          const next = nds.map((n) => {
            if (!canSelectForGroup(n)) {
              return { ...n, selected: false };
            }
            const inRect =
              n.position.x + nodeWidth(n) >= fx &&
              n.position.x <= fx + fw &&
              n.position.y + nodeHeight(n) >= fy &&
              n.position.y <= fy + fh;
            if (inRect) selectedNodes.push(n);
            return { ...n, selected: inRect };
          });
          setSelectionFrame(selectedNodes.length > 0 ? buildFrameFromNodes(selectedNodes) : null);
          return next;
        });
        return null;
      });
    };

    el.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [buildFrameFromNodes, screenToFlowPosition, setFlowNodes]);

  // ---- blank-canvas context menu ----
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (ignoreNextContextMenu.current) {
      ignoreNextContextMenu.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setContextMenu({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setReferenceMenu(null);
    setAddMenu(null);
  }, [screenToFlowPosition]);

  // ---- delete key handling ----
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (!onGraphChange || deleted.length === 0) return;
      const removedIds = new Set(deleted.map((d) => d.id));
      const remaining = flowNodesRef.current.filter((n) => !removedIds.has(n.id));
      const remainingEdges = flowEdgesRef.current.filter(
        (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
      );
      onGraphChange(flowNodesToNodeData(remaining), flowEdgesToEdgeData(remainingEdges));
    },
    [onGraphChange],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!onGraphChange || deleted.length === 0) return;
      const removedIds = new Set(deleted.map((d) => d.id));
      const remainingEdges = flowEdgesRef.current.filter((e) => !removedIds.has(e.id));
      onGraphChange(flowNodesToNodeData(flowNodesRef.current), flowEdgesToEdgeData(remainingEdges));
    },
    [onGraphChange],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [setFlowNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setFlowEdges((eds) => applyEdgeChanges(changes, eds)),
    [setFlowEdges],
  );

  const updateLinkedImageTargets = useCallback((sourceId: string, file: File, previewUrl: string) => {
    const linkedTargetIds = flowEdgesRef.current
      .filter((edge) => edge.source === sourceId && edge.target.startsWith('__image_to_code_'))
      .map((edge) => edge.target);

    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id === sourceId) {
          return { ...node, data: { ...node.data, file, previewUrl } };
        }
        if (
          node.id.startsWith('__image_to_code_') &&
          (linkedTargetIds.length === 0 || linkedTargetIds.includes(node.id))
        ) {
          return { ...node, data: { ...node.data, linkedFile: file, linkedPreviewUrl: previewUrl } };
        }
        return node;
      }),
    );
  }, [setFlowNodes]);

  const submitImageToCode = useCallback(
    (file: File | undefined, instruction: string, model: string, resolution: string) => {
      if (!file || !instruction.trim() || !onImageToCode) return;
      onImageToCode(file, `${instruction.trim()}\n模型：${model}\n导出：${resolution}`);
    },
    [onImageToCode],
  );

  const submitTextToCode = useCallback(
    (instruction: string, model: string, files: File[]) => {
      if (!instruction.trim() || !onGenerateText) return;
      onExpandChat?.();
      onGenerateText(instruction.trim(), model, files);
    },
    [onExpandChat, onGenerateText],
  );

  const addTextEditorNode = useCallback((sourceId: string, x: number, y: number) => {
    const id = `__text_editor_${Date.now()}`;
    const editorNode: Node<TextEditorNodeData> = {
      id,
      type: 'textEditor',
      position: { x, y },
      data: {
        label: '文本编辑',
        nodeType: 'textEditor',
        onSubmit: submitTextToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => current.filter((node) => node.id !== sourceId).concat(editorNode));
    setFlowEdges((current) =>
      current
        .filter((edge) => edge.source !== sourceId)
        .map((edge) => (
          edge.target === sourceId
            ? { ...edge, target: id, id: `e-${edge.source}-${id}` }
            : edge
        )),
    );
  }, [onExpandChat, setFlowEdges, setFlowNodes, startReferenceDrag, openReferenceMenuAt, submitTextToCode]);

  const addTextChoiceNode = useCallback((sourceId: string, x: number, y: number) => {
    const id = `__text_choice_${Date.now()}`;
    const textNode: Node<TextChoiceNodeData> = {
      id,
      type: 'textChoice',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textChoice',
        onCreateEditor: addTextEditorNode,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    const edge: Edge = {
      id: `e-${sourceId}-${id}`,
      source: sourceId,
      target: id,
      animated: true,
      style: { stroke: '#55b8ff', strokeWidth: 2 },
    };
    setFlowNodes((current) => [...current, textNode]);
    setFlowEdges((current) => [...current, edge]);
    setAddMenu(null);
    setReferenceMenu(null);
  }, [addTextEditorNode, setFlowEdges, setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addStandaloneTextChoiceNode = useCallback((x: number, y: number) => {
    const id = `__text_choice_${Date.now()}`;
    const textNode: Node<TextChoiceNodeData> = {
      id,
      type: 'textChoice',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textChoice',
        onCreateEditor: addTextEditorNode,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, textNode]);
    setAddMenu(null);
    setContextMenu(null);
  }, [addTextEditorNode, setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addTextSourceNode = useCallback((file: File, content: string, x: number, y: number) => {
    const id = `__text_source_${Date.now()}`;
    const textNode: Node<TextSourceNodeData> = {
      id,
      type: 'textSource',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textSource',
        fileName: file.name,
        content,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, textNode]);
  }, [setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addImageSourceNode = useCallback((file: File, x: number, y: number) => {
    const id = `__image_source_${Date.now()}`;
    const imageNode: Node<ImageSourceNodeData> = {
      id,
      type: 'imageSource',
      position: { x, y },
      data: {
        label: '图片节点',
        nodeType: 'imageSource',
        file,
        previewUrl: URL.createObjectURL(file),
        onFileChange: updateLinkedImageTargets,
        onSubmit: submitImageToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, imageNode]);
  }, [onExpandChat, setFlowNodes, submitImageToCode, updateLinkedImageTargets, startReferenceDrag, openReferenceMenuAt]);

  const addImageToCodeNodes = useCallback((x: number, y: number, sourceId?: string) => {
    const stamp = Date.now();
    const imageId = `__image_source_${stamp}`;
    const imageNode: Node<ImageSourceNodeData> = {
      id: imageId,
      type: 'imageSource',
      position: { x, y },
      data: {
        label: '图片节点',
        nodeType: 'imageSource',
        onFileChange: updateLinkedImageTargets,
        onSubmit: submitImageToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, imageNode]);
    if (sourceId) {
      setFlowEdges((current) => [
        ...current,
        {
          id: `e-${sourceId}-${imageId}`,
          source: sourceId,
          target: imageId,
          animated: true,
          style: { stroke: '#55b8ff', strokeWidth: 2 },
        },
      ]);
    }
    setAddMenu(null);
    setContextMenu(null);
  }, [setFlowEdges, setFlowNodes, submitImageToCode, updateLinkedImageTargets, onExpandChat, startReferenceDrag, openReferenceMenuAt]);

  const addLinkedImageToCodeNode = useCallback((sourceId: string) => {
    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id !== sourceId) return node;
        return { ...node, data: { ...node.data, openPromptToken: Date.now() } };
      }),
    );
    setAddMenu(null);
    setReferenceMenu(null);
  }, [setFlowNodes]);

  const addSimpleNode = useCallback((nodeType: string, label: string, x: number, y: number, sourceId?: string) => {
    const newNode: Node = {
      id: `drag_${Date.now()}`,
      type: categoryFromNodeType(nodeType),
      position: { x, y },
      data: { label, nodeType, params: {} } satisfies TDNodeData,
    };
    const nextNodes = [...flowNodesRef.current, newNode];
    const nextEdges = sourceId
      ? [
          ...flowEdgesRef.current,
          {
            id: `e-${sourceId}-${newNode.id}`,
            source: sourceId,
            target: newNode.id,
            animated: true,
            style: { stroke: '#55b8ff', strokeWidth: 2 },
          },
        ]
      : flowEdgesRef.current;
    setFlowNodes(nextNodes);
    if (sourceId) {
      setFlowEdges(nextEdges);
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [onGraphChange, setFlowEdges, setFlowNodes]);

  useEffect(() => {
    const onToolboxAddNode = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeType: string; label: string }>).detail;
      if (!detail) return;
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
      if (detail.nodeType === 'text') {
        addStandaloneTextChoiceNode(position.x, position.y);
        return;
      }
      if (detail.nodeType === 'image') {
        addImageToCodeNodes(position.x - IMAGE_SOURCE_NODE_WIDTH / 2, position.y - IMAGE_SOURCE_NODE_HEIGHT / 2);
        return;
      }
      addSimpleNode(detail.nodeType, detail.label, position.x, position.y);
    };

    window.addEventListener('node-toolbox-add-node', onToolboxAddNode);
    return () => window.removeEventListener('node-toolbox-add-node', onToolboxAddNode);
  }, [addImageToCodeNodes, addSimpleNode, addStandaloneTextChoiceNode, screenToFlowPosition]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;
      connectSourceRef.current = null;
      const newEdge: Edge = {
        id: `e-${Date.now()}`,
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        targetHandle: targetHandle ?? undefined,
        animated: true,
        style: { stroke: '#999', strokeWidth: 2 },
      };
      const nextEdges = [...flowEdges, newEdge];
      setFlowEdges(nextEdges);

      if (source.startsWith('__image_source_') && target.startsWith('__image_to_code_')) {
        const sourceNode = flowNodes.find((node) => node.id === source);
        const data = sourceNode?.data as Partial<ImageSourceNodeData> | undefined;
        if (data?.file && data.previewUrl) {
          updateLinkedImageTargets(source, data.file, data.previewUrl);
        }
      }

      // Propagate new edge to parent so it persists
      if (onGraphChange) {
        onGraphChange(flowNodesToNodeData(flowNodes), flowEdgesToEdgeData(nextEdges));
      }
    },
    [setFlowEdges, flowNodes, flowEdges, onGraphChange, updateLinkedImageTargets],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id === PREVIEW_NODE_ID) {
        const data = node.data as PreviewNodeData;
        data.onActivate();
        onNodeSelect?.(null);
        return;
      }
      if (isGroupNode(node)) {
        setActiveGroupId(node.id);
        setSelectionFrame(null);
        setArrangeMenuOpen(false);
        setGroupMenuOpen(false);
        onNodeSelect?.(null);
        return;
      }
      if (isInternalNodeId(node.id)) {
        onNodeSelect?.(null);
        return;
      }
      if (!onNodeSelect) return;
      const data = node.data as TDNodeData;
      onNodeSelect({
        id: node.id,
        type: data.nodeType || '',
        label: data.label || '',
        params: data.params || {},
        position: node.position,
      });
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    if (skipNextPaneClickRef.current) {
      skipNextPaneClickRef.current = false;
      return;
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    setSelectionFrame(null);
    setActiveGroupId(null);
    setArrangeMenuOpen(false);
    setGroupMenuOpen(false);
    setColorMenuOpen(false);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onConnectStart = useCallback((_event: unknown, params: { nodeId?: string | null }) => {
    connectSourceRef.current = params.nodeId || null;
    setAddMenu(null);
    setReferenceMenu(null);
  }, []);

  const openAddMenuFromConnection = useCallback((sourceId: string, clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
    skipNextPaneClickRef.current = true;
    setAddMenu({
      sourceId,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setContextMenu(null);
    setReferenceMenu(null);
  }, [screenToFlowPosition]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = connectSourceRef.current;
    connectSourceRef.current = null;
    if (!sourceId) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.react-flow__handle')) return;

    const point = 'changedTouches' in event
      ? event.changedTouches[0]
      : event;
    if (!point) return;
    openAddMenuFromConnection(sourceId, point.clientX, point.clientY);
  }, [openAddMenuFromConnection]);

  useEffect(() => {
    const onPointerRelease = (event: MouseEvent | TouchEvent) => {
      const sourceId = connectSourceRef.current;
      if (!sourceId) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__handle')) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      if (!point) return;
      window.setTimeout(() => {
        if (connectSourceRef.current !== sourceId) return;
        connectSourceRef.current = null;
        openAddMenuFromConnection(sourceId, point.clientX, point.clientY);
      }, 0);
    };

    window.addEventListener('mouseup', onPointerRelease);
    window.addEventListener('touchend', onPointerRelease);
    return () => {
      window.removeEventListener('mouseup', onPointerRelease);
      window.removeEventListener('touchend', onPointerRelease);
    };
  }, [openAddMenuFromConnection]);

  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setAddMenu({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setContextMenu(null);
  }, [screenToFlowPosition]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
      const bounds = el.getBoundingClientRect();
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setAddMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
      setContextMenu(null);
    };

    el.addEventListener('dblclick', onDoubleClick, true);
    return () => el.removeEventListener('dblclick', onDoubleClick, true);
  }, [screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (droppedFile.type.startsWith('image/')) {
          addImageSourceNode(droppedFile, position.x, position.y);
          return;
        }
        if (isTextFile(droppedFile)) {
          void droppedFile.text().then((content) => {
            addTextSourceNode(droppedFile, content, position.x, position.y);
          });
          return;
        }
        return;
      }

      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      try {
        const { nodeType, label }: { nodeType: string; label: string } = JSON.parse(raw);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const id = `drag_${Date.now()}`;
        const cat = categoryFromNodeType(nodeType);
        const newNode: Node = {
          id,
          type: cat,
          position,
          data: { label, nodeType, params: {} } satisfies TDNodeData,
        };

        const nextNodes = [...flowNodes, newNode];
        setFlowNodes(nextNodes);

        // Propagate new node to parent so it survives saveNodeParamsOnly
        if (onGraphChange) {
          onGraphChange(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdges));
        }
      } catch {
        // ignore invalid drops
      }
    },
    [screenToFlowPosition, setFlowNodes, flowNodes, flowEdges, onGraphChange, addImageSourceNode, addTextSourceNode],
  );

  const activeGroup = activeGroupId
    ? flowNodes.find((node) => node.id === activeGroupId && isGroupNode(node))
    : null;
  const activeGroupFrame = activeGroup ? buildFrameFromNodes([activeGroup]) : null;
  const activeGroupData = activeGroup?.data as Partial<GroupFrameNodeData> | undefined;
  const selectedCount = selectionFrame?.nodeIds.length || 0;
  const activeGroupCount = activeGroupData?.nodeCount
    || flowNodes.filter((node) => node.parentNode === activeGroupId).length;
  const canvasMap = useMemo((): { nodes: CanvasMapNodeItem[]; lines: CanvasMapLineItem[]; frame: CanvasMapFrame | null } => {
    const visibleNodes = flowNodes.filter((node) => !isGroupNode(node));
    if (visibleNodes.length === 0) return { nodes: [], lines: [], frame: null };

    const nodeRects = visibleNodes.map((node) => ({
      node,
      x: node.positionAbsolute?.x ?? node.position.x,
      y: node.positionAbsolute?.y ?? node.position.y,
      w: nodeWidth(node),
      h: nodeHeight(node),
    }));
    const viewportBounds = canvasRef.current && canvasViewport.zoom > 0
      ? {
          x: -canvasViewport.x / canvasViewport.zoom,
          y: -canvasViewport.y / canvasViewport.zoom,
          w: canvasRef.current.clientWidth / canvasViewport.zoom,
          h: canvasRef.current.clientHeight / canvasViewport.zoom,
        }
      : null;

    const minX = Math.min(
      ...nodeRects.map((item) => item.x),
      viewportBounds?.x ?? Infinity,
    );
    const minY = Math.min(
      ...nodeRects.map((item) => item.y),
      viewportBounds?.y ?? Infinity,
    );
    const maxX = Math.max(
      ...nodeRects.map((item) => item.x + item.w),
      viewportBounds ? viewportBounds.x + viewportBounds.w : -Infinity,
    );
    const maxY = Math.max(
      ...nodeRects.map((item) => item.y + item.h),
      viewportBounds ? viewportBounds.y + viewportBounds.h : -Infinity,
    );
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min(
      (CANVAS_MAP_WIDTH - CANVAS_MAP_PADDING * 2) / spanX,
      (CANVAS_MAP_HEIGHT - CANVAS_MAP_PADDING * 2) / spanY,
    );
    const offsetX = (CANVAS_MAP_WIDTH - spanX * scale) / 2;
    const offsetY = (CANVAS_MAP_HEIGHT - spanY * scale) / 2;
    const project = (x: number, y: number) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (y - minY) * scale,
    });

    const mapNodes = nodeRects.map(({ node, x, y, w, h }) => {
      const data = node.data as { label?: string; fileName?: string; previewUrl?: string };
      const topLeft = project(x, y);
      const bottomRight = project(x + w, y + h);
      const kind: CanvasMapNodeItem['kind'] =
        node.id === PREVIEW_NODE_ID
          ? 'preview'
          : node.type === 'imageSource'
            ? 'image'
            : node.type === 'textSource' || node.type === 'textChoice' || node.type === 'textEditor'
              ? 'text'
              : isGroupNode(node)
                ? 'group'
                : 'default';
      return {
        id: node.id,
        x: topLeft.x,
        y: topLeft.y,
        w: Math.max(7, bottomRight.x - topLeft.x),
        h: Math.max(7, bottomRight.y - topLeft.y),
        label: data.label || data.fileName || node.id,
        kind,
        imageUrl: data.previewUrl,
      };
    });
    const mapLines = flowEdges.map((edge) => {
      const source = nodeRects.find((item) => item.node.id === edge.source);
      const target = nodeRects.find((item) => item.node.id === edge.target);
      if (!source || !target) return null;
      const start = project(source.x + source.w, source.y + source.h / 2);
      const end = project(target.x, target.y + target.h / 2);
      return { id: edge.id, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    }).filter((line): line is CanvasMapLineItem => line !== null);
    const frame = viewportBounds
      ? (() => {
          const topLeft = project(viewportBounds.x, viewportBounds.y);
          const bottomRight = project(viewportBounds.x + viewportBounds.w, viewportBounds.y + viewportBounds.h);
          return {
            x: Math.max(0, topLeft.x),
            y: Math.max(0, topLeft.y),
            w: Math.min(CANVAS_MAP_WIDTH, bottomRight.x) - Math.max(0, topLeft.x),
            h: Math.min(CANVAS_MAP_HEIGHT, bottomRight.y) - Math.max(0, topLeft.y),
          };
        })()
      : null;
    return { nodes: mapNodes, lines: mapLines, frame };
  }, [canvasViewport, flowEdges, flowNodes]);

  return (
    <div
      className={`${styles.canvas} ${previewNode?.referenceActive ? styles.canvasPreviewActive : ''}`}
      ref={canvasRef}
    >
      {previewNode?.referenceActive && (
        <div className={styles.previewCanvasBackdrop}>
          <PreviewWindow
            code={previewNode.code}
            refreshKey={previewNode.refreshKey}
            referenceActive={previewNode.referenceActive}
            referenceBackgroundUrl={previewNode.referenceBackgroundUrl}
          />
        </div>
      )}
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeTypes={nodeTypes}
        zoomOnDoubleClick={false}
        snapToGrid={gridSnapActive}
        snapGrid={[20, 20]}
        onMove={(_, viewport) => {
          setZoomPercent(Math.round(viewport.zoom * 100));
          setCanvasViewport(viewport);
        }}
        onInit={(instance) => {
          const viewport = instance.getViewport();
          setZoomPercent(Math.round(viewport.zoom * 100));
          setCanvasViewport(viewport);
        }}
        fitView
      >
        <Background />
      </ReactFlow>
      {selBox && (
        <div
          className={styles.selectionBox}
          style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
        />
      )}
      {selectionFrame && (
        <div
          className={styles.selectionFrame}
          data-selection-ui="true"
          style={{
            left: selectionFrame.x,
            top: selectionFrame.y,
            width: selectionFrame.w,
            height: selectionFrame.h,
          }}
        >
          <div className={styles.selectionLabel}>已选 {selectedCount} 个节点</div>
          <div className={styles.selectionToolbar} style={{ left: Math.max(0, selectionFrame.w / 2 - 306) }}>
            <button
              type="button"
              className={styles.iconTool}
              title="排列"
              onClick={() => setArrangeMenuOpen((open) => !open)}
            >
              <AppstoreOutlined />
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.textTool} title="保存到素材">
              <BgColorsOutlined />
              <span>保存到素材</span>
            </button>
            <button type="button" className={styles.textTool} title="创建副本" onClick={duplicateSelectedNodes}>
              <CopyOutlined />
              <span>创建副本</span>
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.iconTool} title="批量下载">
              <DownloadOutlined />
            </button>
            <button
              type="button"
              className={styles.textTool}
              title="打组"
              onClick={groupSelectedNodes}
            >
              <GroupOutlined />
              <span>打组</span>
              <DownOutlined />
            </button>
            {arrangeMenuOpen && (
              <div className={styles.arrangeMenu}>
                <button type="button" onClick={() => arrangeSelectedNodes('grid')}>
                  <AppstoreOutlined /> 宫格排列
                </button>
                <button type="button" onClick={() => arrangeSelectedNodes('horizontal')}>
                  <ColumnWidthOutlined /> 水平排列
                </button>
                <button type="button" onClick={() => arrangeSelectedNodes('vertical')}>
                  <ColumnHeightOutlined /> 垂直排列
                </button>
              </div>
            )}
            {groupMenuOpen && (
              <div className={styles.groupMenu}>
                <button type="button" onClick={groupSelectedNodes}>
                  <GroupOutlined /> 打组
                </button>
                <button type="button" onClick={groupSelectedNodes}>
                  <BorderOuterOutlined /> 合并分镜组
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {activeGroup && activeGroupFrame && (
        <div
          className={styles.selectionFrame}
          data-selection-ui="true"
          style={{
            left: activeGroupFrame.x,
            top: activeGroupFrame.y,
            width: activeGroupFrame.w,
            height: activeGroupFrame.h,
          }}
        >
          <div className={styles.selectionLabel}>分组 {activeGroupCount} 个节点</div>
          <div className={styles.groupToolbar} style={{ left: Math.max(0, activeGroupFrame.w / 2 - 446) }}>
            <button
              type="button"
              className={styles.colorTool}
              title="底图颜色"
              onClick={() => setColorMenuOpen((open) => !open)}
            >
              <span style={{ background: activeGroupData?.color || 'rgba(255, 255, 255, 0.72)' }} />
            </button>
            <button
              type="button"
              className={styles.iconTool}
              title="排列"
              onClick={() => setArrangeMenuOpen((open) => !open)}
            >
              <AppstoreOutlined />
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.textTool}>
              <PlayCircleOutlined />
              <span>整组执行</span>
            </button>
            <button type="button" className={styles.textTool}>
              <ShareAltOutlined />
              <span>添加到工具箱</span>
            </button>
            <button type="button" className={styles.textTool}>
              <GroupOutlined />
              <span>转分镜组</span>
            </button>
            <button type="button" className={styles.textTool} onClick={ungroupActiveGroup}>
              <UngroupOutlined />
              <span>解组</span>
            </button>
            <button type="button" className={styles.textTool}>
              <DownloadOutlined />
              <span>批量下载</span>
            </button>
            {colorMenuOpen && (
              <div className={styles.colorMenu}>
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={color === 'transparent' ? styles.noColorSwatch : ''}
                    style={{ background: color === 'transparent' ? undefined : color.replace('0.16', '1') }}
                    onClick={() => updateActiveGroupColor(color)}
                    title={color === 'transparent' ? '无底色' : '设置底色'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={styles.canvasUtilityWrap} data-selection-ui="true">
        {organizeConfirmOpen && (
          <div className={styles.organizeConfirm}>
            <div>是否保留此次整理结果？</div>
            <div className={styles.organizeActions}>
              <button type="button" onClick={() => setOrganizeConfirmOpen(false)}>还原</button>
              <button type="button" onClick={() => setOrganizeConfirmOpen(false)}>保留</button>
            </div>
          </div>
        )}
        {canvasMapOpen && (
          <div className={styles.canvasMapPanel}>
            <svg className={styles.canvasMapEdges} viewBox={`0 0 ${CANVAS_MAP_WIDTH} ${CANVAS_MAP_HEIGHT}`}>
              {canvasMap.lines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                />
              ))}
            </svg>
            {canvasMap.nodes.map((node) => (
              <div
                key={node.id}
                className={`${styles.canvasMapNode} ${styles[`canvasMapNode_${node.kind}`]}`}
                title={node.label}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  backgroundImage: node.imageUrl ? `url(${node.imageUrl})` : undefined,
                }}
              />
            ))}
            {canvasMap.frame && (
              <div
                className={styles.canvasMapViewport}
                style={{
                  left: canvasMap.frame.x,
                  top: canvasMap.frame.y,
                  width: Math.max(8, canvasMap.frame.w),
                  height: Math.max(8, canvasMap.frame.h),
                }}
              />
            )}
          </div>
        )}
        <div className={styles.canvasUtilityBar}>
          <button
            type="button"
            className={styles.canvasUtilityBtn}
            data-tooltip="整理画布 Alt+Shift+F"
            onClick={handleOrganizeCanvas}
          >
            <AppstoreOutlined />
          </button>
          <button
            type="button"
            className={`${styles.canvasUtilityBtn} ${canvasMapOpen ? styles.canvasUtilityActive : ''}`}
            data-tooltip="画布小地图"
            onClick={() => setCanvasMapOpen((open) => !open)}
          >
            <AimOutlined />
          </button>
          <button
            type="button"
            className={`${styles.canvasUtilityBtn} ${gridSnapActive ? styles.canvasUtilityActive : ''}`}
            data-tooltip="网格吸附"
            onClick={() => setGridSnapActive((active) => !active)}
          >
            <LinkOutlined />
          </button>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomOut} aria-label="缩小画布">
            <MinusOutlined />
          </button>
          <span className={styles.zoomValue}>{zoomPercent}%</span>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomIn} aria-label="放大画布">
            <PlusOutlined />
          </button>
        </div>
      </div>
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className={styles.contextPrimary} onClick={() => addImageToCodeNodes(contextMenu.flowX, contextMenu.flowY)}>
            上传
          </button>
          <button type="button" disabled>保存到我的素材</button>
          <button
            type="button"
            onClick={() => {
              setAddMenu({
                x: contextMenu.x + 245,
                y: Math.max(12, contextMenu.y - 28),
                flowX: contextMenu.flowX,
                flowY: contextMenu.flowY,
              });
            }}
          >
            添加节点
          </button>
          <div className={styles.contextDivider} />
          <button type="button"><span>撤销</span><kbd>⌘Z</kbd></button>
          <button type="button" disabled><span>重做</span><kbd>⇧⌘Z</kbd></button>
          <div className={styles.contextDivider} />
          <button type="button"><span>粘贴</span><kbd>⌘V</kbd></button>
        </div>
      )}
      {addMenu && (
        <div
          className={styles.addMenu}
          style={{ left: addMenu.x, top: addMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.addMenuTitle}>添加节点</div>
          <button
            type="button"
            onClick={() => {
              if (addMenu.sourceId) {
                addTextChoiceNode(addMenu.sourceId, addMenu.flowX, addMenu.flowY);
                return;
              }
              addStandaloneTextChoiceNode(addMenu.flowX, addMenu.flowY);
            }}
          >
            <span>☰</span>文本
          </button>
          <button
            type="button"
            onClick={() => {
              if (addMenu.sourceId?.startsWith('__image_source_')) {
                addLinkedImageToCodeNode(addMenu.sourceId);
                return;
              }
              addImageToCodeNodes(addMenu.flowX, addMenu.flowY, addMenu.sourceId);
            }}
          >
            <span>▧</span>图片
          </button>
          <button type="button" onClick={() => addSimpleNode('file_video', '视频', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>▻</span>视频
          </button>
          <button type="button" onClick={() => addSimpleNode('mp4Recognition', '视频合成', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>⌘</span>视频合成 <small>Beta</small>
          </button>
          <button type="button" onClick={() => addSimpleNode('controls', '导演台', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>▱</span>导演台 <small>NEW</small>
          </button>
          <button type="button" onClick={() => addSimpleNode('audioRhythm', '音频', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>≋</span>音频
          </button>
          <button type="button" onClick={() => addSimpleNode('animation', '脚本', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>▣</span>脚本 <small>Beta</small>
          </button>
          <div className={styles.addMenuTitle}>添加资源</div>
          <button type="button" onClick={() => addImageToCodeNodes(addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>↑</span>上传
          </button>
          <button type="button" onClick={() => addImageToCodeNodes(addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
            <span>◇</span>从图库选择
          </button>
        </div>
      )}
      {referenceMenu && (
        <div
          className={styles.referenceMenu}
          style={{ left: referenceMenu.x, top: referenceMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.referenceTitle}>你想要干什么？</div>
          <button
            type="button"
            className={styles.referenceItemActive}
            onClick={() => {
              if (referenceMenu.sourceId.startsWith('__image_source_')) {
                addLinkedImageToCodeNode(referenceMenu.sourceId);
                return;
              }
              addTextChoiceNode(referenceMenu.sourceId, referenceMenu.flowX, referenceMenu.flowY);
            }}
          >
            <span>☰</span>
            <strong>{referenceMenu.sourceId.startsWith('__image_source_') ? '图生代码' : '文生代码'}</strong>
            <small>根据该素材生成代码、脚本或提示词</small>
          </button>
          <button type="button"><span>▧</span><strong>图片</strong></button>
          <button type="button"><span>▻</span><strong>视频</strong></button>
          <button type="button" disabled><span>⌘</span><strong>视频合成</strong><small>Beta</small></button>
          <button type="button" disabled><span>≋</span><strong>音频</strong></button>
          <button type="button"><span>▣</span><strong>脚本</strong><small>Beta</small></button>
          <div className={styles.referenceDivider} />
          <button type="button" onClick={() => addSimpleNode('gsap_tween', '代码调整', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌘</span><strong>代码调整</strong>
          </button>
          <div className={styles.referenceGroupLabel}>新增交互</div>
          <button type="button" onClick={() => addSimpleNode('keyboard', '键盘交互', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌨</span><strong>键盘交互</strong>
          </button>
          <button type="button" onClick={() => addSimpleNode('mouse', '鼠标交互', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>◎</span><strong>鼠标交互</strong>
          </button>
          <button type="button" onClick={() => addSimpleNode('camera_interaction', '新增摄像机路径', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌁</span><strong>新增摄像机路径</strong>
          </button>
        </div>
      )}
      {onGenerateFromGraph && flowNodes.length > 0 && (
        <button
          className={styles.generateBtn}
          onClick={onGenerateFromGraph}
          title="基于当前节点图生成代码并预览"
        >
          生成节点代码并预览
        </button>
      )}
    </div>
  );
}

export function NodeCanvas(props: NodeCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
