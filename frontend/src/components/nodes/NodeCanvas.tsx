import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
  type Connection,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import dagre from 'dagre';
import { nodeTypesMap, categoryFromNodeType } from './TDNodes';
import type { TDNodeData } from './TDNodes';
import 'reactflow/dist/style.css';
import styles from './NodeCanvas.module.css';

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
  onNodeSelect?: (node: NodeData | null) => void;
  /** Called whenever the graph changes so the parent can sync global state */
  onGraphChange?: (nodes: NodeData[], edges: EdgeData[]) => void;
  /** Called when user clicks "生成节点代码并预览" button */
  onGenerateFromGraph?: () => void;
}

/** Convert ReactFlow nodes back to plain NodeData (reverse of createFlowNodes) */
function flowNodesToNodeData(rfNodes: Node[]): NodeData[] {
  return rfNodes.map((n) => {
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
  return rfEdges.map((e) => ({
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

function CanvasInner({ nodes, edges, onNodeSelect, onGraphChange, onGenerateFromGraph }: NodeCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ---- selection box state (right-click drag) ----
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSelecting = useRef(false);

  // stale-closure insurance: always-current refs for flowNodes / flowEdges
  const flowNodesRef = useRef<Node[]>([]);
  const flowEdgesRef = useRef<Edge[]>([]);

  const initialNodes = useMemo(() => createFlowNodes(nodes), [nodes]);
  const initialEdges = useMemo(() => createFlowEdges(edges || []), [edges]);

  const layoutedNodes = useMemo(() => {
    return dagreLayout(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [flowNodes, setFlowNodes] = useNodesState(layoutedNodes);
  const [flowEdges, setFlowEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    setFlowNodes(layoutedNodes);
    setFlowEdges(initialEdges);
  }, [layoutedNodes, initialEdges, setFlowNodes, setFlowEdges]);

  // keep refs current to avoid stale closures in event listeners
  flowNodesRef.current = flowNodes;
  flowEdgesRef.current = flowEdges;

  // ---- right-click drag → rectangular selection ----
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
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

  // ---- prevent browser context menu on canvas ----
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

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

      // Propagate new edge to parent so it persists
      if (onGraphChange) {
        onGraphChange(flowNodesToNodeData(flowNodes), flowEdgesToEdgeData(nextEdges));
      }
    },
    [setFlowEdges, flowNodes, flowEdges, onGraphChange],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
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
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
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
    [screenToFlowPosition, setFlowNodes, flowNodes, flowEdges, onGraphChange],
  );

  return (
    <div className={styles.canvas} ref={canvasRef}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeTypes={nodeTypesMap}
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
