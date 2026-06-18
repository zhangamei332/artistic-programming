import type {
  CreativeTemplate,
  EdgeMapping,
  TemplateEdge,
  TemplateNode,
  TemplatePosition
} from "../templateTypes";

export interface HostNodeDefinition {
  type: string;
  defaultWidth?: number;
  defaultHeight?: number;
  visibility?: "public" | "advanced" | "system" | "hidden";
}

export interface ExistingNodeEditorAdapter {
  /** Existing canvas viewport center in graph coordinates. */
  getViewportCenter(): TemplatePosition;

  /** Resolve a stable semantic template type to a node type already registered in the host menu. */
  resolveMenuNodeType(semanticType: string): string | null;

  /** Read the host registry definition. Templates must not define their own visual node component. */
  getHostNodeDefinition?(hostType: string): HostNodeDefinition | undefined;

  /** Reuse the product's existing renderer/preview/system node when possible. */
  findReusableNodeByCapability?(semanticType: string): string | null;

  /** Add an ordinary node through the editor's existing add-node action. */
  addNode(input: {
    id: string;
    type: string;
    position: TemplatePosition;
    data: {
      label: string;
      params: Record<string, unknown>;
      semanticType: string;
      templateId: string;
      templateVersion: string;
      templateInstanceId: string;
      sourceTemplateNodeId: string;
    };
  }): void;

  /** Add an ordinary edge through the editor's existing edge action/component. */
  addEdge(input: {
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
    label?: string;
    data: {
      mappings: EdgeMapping[];
      templateId: string;
      templateInstanceId: string;
      sourceTemplateEdgeId: string;
    };
  }): void;

  beginTransaction?(label: string): unknown;
  commitTransaction?(transaction?: unknown): void;
  rollbackTransaction?(transaction?: unknown): void;
  selectNodes?(nodeIds: string[]): void;
  ensureNodesVisible?(nodeIds: string[]): void;
  notifyUnsupportedTypes?(semanticTypes: string[]): void;
}

export interface InsertTemplateOptions {
  origin?: TemplatePosition;
  reuseExistingSystemNodes?: boolean;
  selectInsertedNodes?: boolean;
  ensureVisible?: boolean;
}

export interface InsertTemplateResult {
  templateInstanceId: string;
  createdNodeIds: string[];
  reusedNodeIds: string[];
  createdEdgeIds: string[];
  nodeIdMap: Map<string, string>;
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function boundsCenter(nodes: TemplateNode[]): TemplatePosition {
  if (!nodes.length) return { x: 0, y: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2
  };
}

function isReusableSystemCapability(semanticType: string): boolean {
  return (
    semanticType.startsWith("renderer.") ||
    semanticType === "controller.scene"
  );
}

function edgeSummary(edge: TemplateEdge): string {
  const mapped = edge.mappings
    .filter((mapping) => mapping.mode !== "direct")
    .slice(0, 2)
    .map((mapping) => mapping.label);

  if (mapped.length) return mapped.join(" · ");
  return edge.label || "映射";
}

/**
 * Insert a template directly into the product's current node canvas.
 *
 * Important:
 * - no standalone UI;
 * - no visible template group frame;
 * - no template-only node component;
 * - no template-only inspector;
 * - all nodes and edges are created by the host editor's existing actions.
 */
export function insertTemplateIntoExistingCanvas(
  editor: ExistingNodeEditorAdapter,
  sourceTemplate: CreativeTemplate,
  options: InsertTemplateOptions = {}
): InsertTemplateResult {
  const template = clone(sourceTemplate);

  if (
    template.insertion.surface !== "host-node-canvas" ||
    template.insertion.renderGroupFrame !== false
  ) {
    throw new Error(`Template ${template.id} is not configured for host-canvas insertion.`);
  }

  const hostTypes = new Map<string, string>();
  const unsupported = new Set<string>();

  for (const node of template.graph.nodes) {
    const hostType = editor.resolveMenuNodeType(node.type);
    if (!hostType) unsupported.add(node.type);
    else hostTypes.set(node.id, hostType);
  }

  if (unsupported.size) {
    const list = [...unsupported];
    editor.notifyUnsupportedTypes?.(list);
    throw new Error(`Missing host menu node types: ${list.join(", ")}`);
  }

  const templateInstanceId = uid(`template-instance-${template.id}`);
  const targetCenter = options.origin ?? editor.getViewportCenter();
  const sourceCenter = boundsCenter(template.graph.nodes);
  const nodeIdMap = new Map<string, string>();
  const createdNodeIds: string[] = [];
  const reusedNodeIds: string[] = [];
  const createdEdgeIds: string[] = [];
  const transaction = editor.beginTransaction?.(`插入模板：${template.name}`);

  try {
    for (const node of template.graph.nodes) {
      const hostType = hostTypes.get(node.id)!;
      const shouldReuse =
        (options.reuseExistingSystemNodes ??
          template.insertion.reuseExistingSystemNodes ??
          true) &&
        isReusableSystemCapability(node.type);

      const reusableId = shouldReuse
        ? editor.findReusableNodeByCapability?.(node.type) ?? null
        : null;

      if (reusableId) {
        nodeIdMap.set(node.id, reusableId);
        reusedNodeIds.push(reusableId);
        continue;
      }

      const runtimeId = uid(node.id);
      const position = {
        x: targetCenter.x + node.position.x - sourceCenter.x,
        y: targetCenter.y + node.position.y - sourceCenter.y
      };

      editor.addNode({
        id: runtimeId,
        type: hostType,
        position,
        data: {
          label: node.label,
          params: clone(node.params),
          semanticType: node.type,
          templateId: template.id,
          templateVersion: template.version,
          templateInstanceId,
          sourceTemplateNodeId: node.id
        }
      });

      nodeIdMap.set(node.id, runtimeId);
      createdNodeIds.push(runtimeId);
    }

    for (const edge of template.graph.edges) {
      const source = nodeIdMap.get(edge.source);
      const target = nodeIdMap.get(edge.target);
      if (!source || !target) {
        throw new Error(`Cannot resolve edge ${edge.id}: ${edge.source} -> ${edge.target}`);
      }

      const runtimeId = uid(edge.id);
      editor.addEdge({
        id: runtimeId,
        source,
        sourceHandle: edge.sourcePort,
        target,
        targetHandle: edge.targetPort,
        label: edgeSummary(edge),
        data: {
          mappings: clone(edge.mappings),
          templateId: template.id,
          templateInstanceId,
          sourceTemplateEdgeId: edge.id
        }
      });
      createdEdgeIds.push(runtimeId);
    }

    editor.commitTransaction?.(transaction);

    if (options.selectInsertedNodes ?? true) {
      editor.selectNodes?.(createdNodeIds);
    }
    if (options.ensureVisible ?? true) {
      editor.ensureNodesVisible?.(createdNodeIds);
    }

    return {
      templateInstanceId,
      createdNodeIds,
      reusedNodeIds,
      createdEdgeIds,
      nodeIdMap
    };
  } catch (error) {
    editor.rollbackTransaction?.(transaction);
    throw error;
  }
}

/** Backward-compatible export name for the V1 package. */
export const createTemplateGraph = insertTemplateIntoExistingCanvas;
