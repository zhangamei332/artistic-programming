import { useMemo, useCallback, useEffect } from 'react';
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

function CanvasInner({ nodes, edges, onNodeSelect }: NodeCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

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
      setFlowEdges((eds) => [
        ...eds,
        {
          id: `e-${Date.now()}`,
          source,
          target,
          sourceHandle: sourceHandle ?? undefined,
          targetHandle: targetHandle ?? undefined,
          animated: true,
          style: { stroke: '#999', strokeWidth: 2 },
        },
      ]);
    },
    [setFlowEdges],
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

        setFlowNodes((nds) => [
          ...nds,
          {
            id,
            type: cat,
            position,
            data: { label, nodeType, params: {} } satisfies TDNodeData,
          },
        ]);
      } catch {
        // ignore invalid drops
      }
    },
    [screenToFlowPosition, setFlowNodes],
  );

  return (
    <div className={styles.canvas}>
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
        nodeTypes={nodeTypesMap}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
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
