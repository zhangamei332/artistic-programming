import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
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
  onFileChange: (nodeId: string, file: File, previewUrl: string) => void;
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
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface AddMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
}

interface ReferenceMenuState extends AddMenuState {
  sourceId: string;
}

function isInternalNodeId(id: string): boolean {
  return id.startsWith(INTERNAL_NODE_PREFIX);
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
      position: n.position,
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
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8 }} />
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

  return (
    <div
      className={styles.imageSourceNode}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
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
        onClick={() => inputRef.current?.click()}
      >
        上传
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
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
        onClick={() => data.onCreateEditor(id, props.xPos + 360, props.yPos)}
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
      <div className={styles.textEditorNode}>
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
  onExpandChat,
  onNodeSelect,
  onGraphChange,
  onGenerateFromGraph,
}: NodeCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [contextMenu, setContextMenu] = useState<AddMenuState | null>(null);
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenuState | null>(null);
  const connectSourceRef = useRef<string | null>(null);

  // ---- selection box state (right-click drag) ----
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSelecting = useRef(false);

  // stale-closure insurance: always-current refs for flowNodes / flowEdges
  const flowNodesRef = useRef<Node[]>([]);
  const flowEdgesRef = useRef<Edge[]>([]);

  const nodeTypes = useMemo(
    () => ({
      ...nodeTypesMap,
      preview: PreviewFlowNode,
      imageSource: ImageSourceFlowNode,
      imageToCode: ImageToCodeFlowNode,
      textChoice: TextChoiceFlowNode,
      textEditor: TextEditorFlowNode,
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

  const startReferenceDrag = useCallback((sourceId: string) => {
    connectSourceRef.current = sourceId;

    const onMouseUp = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__handle')) return;
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setReferenceMenu({
        sourceId,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    };

    window.addEventListener('mouseup', onMouseUp, { once: true });
  }, [screenToFlowPosition]);

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
      if (e.button !== 2 || !e.shiftKey) return;
      const target = e.target as HTMLElement;
      // only on empty canvas, not on nodes/edges
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
      e.preventDefault();
      e.stopPropagation();

      const bounds = el.getBoundingClientRect();
      isSelecting.current = true;
      selStart.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      setSelBox({ x: selStart.current.x, y: selStart.current.y, w: 0, h: 0 });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSelecting.current) return;
      const bounds = el.getBoundingClientRect();
      const cx = e.clientX - bounds.left;
      const cy = e.clientY - bounds.top;
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

      setSelBox((current) => {
        if (!current || (current.w < 5 && current.h < 5)) return null;

        const bounds = el.getBoundingClientRect();
        // convert screen-rect corners to flow coordinates
        const tl = screenToFlowPosition({ x: bounds.left + current.x, y: bounds.top + current.y });
        const br = screenToFlowPosition({ x: bounds.left + current.x + current.w, y: bounds.top + current.y + current.h });
        const fx = Math.min(tl.x, br.x);
        const fy = Math.min(tl.y, br.y);
        const fw = Math.abs(br.x - tl.x);
        const fh = Math.abs(br.y - tl.y);

        setFlowNodes((nds) =>
          nds.map((n) => {
            const inRect =
              n.position.x + 150 >= fx &&
              n.position.x <= fx + fw &&
              n.position.y + 80 >= fy &&
              n.position.y <= fy + fh;
            return { ...n, selected: inRect };
          }),
        );
        return null;
      });
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [screenToFlowPosition, setFlowNodes]);

  // ---- blank-canvas context menu ----
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
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

  const addTextEditorNode = useCallback((sourceId: string, x: number, y: number) => {
    const id = `__text_editor_${Date.now()}`;
    const editorNode: Node<TextEditorNodeData> = {
      id,
      type: 'textEditor',
      position: { x, y },
      data: {
        label: '文本编辑',
        nodeType: 'textEditor',
        onExpandChat,
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
    setFlowNodes((current) => [...current, editorNode]);
    setFlowEdges((current) => [...current, edge]);
  }, [onExpandChat, setFlowEdges, setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

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
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, imageNode]);
  }, [setFlowNodes, updateLinkedImageTargets, startReferenceDrag, openReferenceMenuAt]);

  const addImageToCodeNodes = useCallback((x: number, y: number) => {
    const stamp = Date.now();
    const imageId = `__image_source_${stamp}`;
    const dialogId = `__image_to_code_${stamp}`;
    const imageNode: Node<ImageSourceNodeData> = {
      id: imageId,
      type: 'imageSource',
      position: { x, y },
      data: {
        label: '图片节点',
        nodeType: 'imageSource',
        onFileChange: updateLinkedImageTargets,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    const dialogNode: Node<ImageToCodeNodeData> = {
      id: dialogId,
      type: 'imageToCode',
      position: { x: x + 40, y: y + 390 },
      data: {
        label: '图生代码',
        nodeType: 'imageToCode',
        onSubmit: submitImageToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    const edge: Edge = {
      id: `e-${imageId}-${dialogId}`,
      source: imageId,
      target: dialogId,
      animated: true,
      style: { stroke: '#55b8ff', strokeWidth: 2 },
    };
    setFlowNodes((current) => [...current, imageNode, dialogNode]);
    setFlowEdges((current) => [...current, edge]);
    setAddMenu(null);
    setContextMenu(null);
  }, [setFlowNodes, setFlowEdges, submitImageToCode, updateLinkedImageTargets, onExpandChat, startReferenceDrag, openReferenceMenuAt]);

  const addSimpleNode = useCallback((nodeType: string, label: string, x: number, y: number) => {
    const newNode: Node = {
      id: `drag_${Date.now()}`,
      type: categoryFromNodeType(nodeType),
      position: { x, y },
      data: { label, nodeType, params: {} } satisfies TDNodeData,
    };
    const nextNodes = [...flowNodesRef.current, newNode];
    setFlowNodes(nextNodes);
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
  }, [onGraphChange, setFlowNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;
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
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onConnectStart = useCallback((_event: unknown, params: { nodeId?: string | null }) => {
    connectSourceRef.current = params.nodeId || null;
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = connectSourceRef.current;
    connectSourceRef.current = null;
    if (!sourceId || !isInternalNodeId(sourceId)) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.react-flow__handle')) return;

    const point = 'changedTouches' in event
      ? event.changedTouches[0]
      : event;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || !point) return;
    const flowPosition = screenToFlowPosition({ x: point.clientX, y: point.clientY });
    setReferenceMenu({
      sourceId,
      x: point.clientX - bounds.left,
      y: point.clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
  }, [screenToFlowPosition]);

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
      if (droppedFile?.type.startsWith('image/')) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addImageSourceNode(droppedFile, position.x, position.y);
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
    [screenToFlowPosition, setFlowNodes, flowNodes, flowEdges, onGraphChange, addImageSourceNode],
  );

  return (
    <div className={styles.canvas} ref={canvasRef}>
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
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      {selBox && (
        <div
          className={styles.selectionBox}
          style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
        />
      )}
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
          <button type="button" onClick={() => addStandaloneTextChoiceNode(addMenu.flowX, addMenu.flowY)}>
            <span>☰</span>文本
          </button>
          <button type="button" onClick={() => addImageToCodeNodes(addMenu.flowX, addMenu.flowY)}>
            <span>▧</span>图片
          </button>
          <button type="button" onClick={() => addSimpleNode('file_video', '视频', addMenu.flowX, addMenu.flowY)}>
            <span>▻</span>视频
          </button>
          <button type="button" onClick={() => addSimpleNode('mp4Recognition', '视频合成', addMenu.flowX, addMenu.flowY)}>
            <span>⌘</span>视频合成 <small>Beta</small>
          </button>
          <button type="button" onClick={() => addSimpleNode('controls', '导演台', addMenu.flowX, addMenu.flowY)}>
            <span>▱</span>导演台 <small>NEW</small>
          </button>
          <button type="button" onClick={() => addSimpleNode('audioRhythm', '音频', addMenu.flowX, addMenu.flowY)}>
            <span>≋</span>音频
          </button>
          <button type="button" onClick={() => addSimpleNode('animation', '脚本', addMenu.flowX, addMenu.flowY)}>
            <span>▣</span>脚本 <small>Beta</small>
          </button>
          <div className={styles.addMenuTitle}>添加资源</div>
          <button type="button" onClick={() => addImageToCodeNodes(addMenu.flowX, addMenu.flowY)}>
            <span>↑</span>上传
          </button>
          <button type="button" onClick={() => addImageToCodeNodes(addMenu.flowX, addMenu.flowY)}>
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
          <div className={styles.referenceTitle}>引用该节点生成</div>
          <button
            type="button"
            className={styles.referenceItemActive}
            onClick={() => addTextChoiceNode(referenceMenu.sourceId, referenceMenu.flowX, referenceMenu.flowY)}
          >
            <span>☰</span>
            <strong>文本</strong>
            <small>剧本、广告词、品牌文案</small>
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
