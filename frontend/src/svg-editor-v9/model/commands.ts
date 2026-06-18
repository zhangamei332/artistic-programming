import type {
  PathNode, PathSegment, SvgDocument, VectorNode,
  VectorStyle, VectorTransform,
} from "./types.js";
import type { DocumentCommand } from "./documentStore.js";

export function addVectorNode(node: VectorNode): DocumentCommand {
  return {
    label: `Add ${node.type}`,
    execute(document) {
      if (document.nodes[node.id]) throw new Error(`Duplicate ID: ${node.id}`);
      document.nodes[node.id] = node;
      if (node.parentId) {
        const parent = document.nodes[node.parentId];
        if (!parent || parent.type !== "group") throw new Error("Parent group missing");
        parent.childIds.push(node.id);
      } else {
        document.rootIds.push(node.id);
      }
      document.selection = { nodeIds: [node.id], anchorRefs: [] };
      return document;
    },
  };
}

export function setVectorTransform(
  nodeId: string,
  transform: Partial<VectorTransform>,
): DocumentCommand {
  return {
    label: "Transform vector node",
    execute(document) {
      const node = document.nodes[nodeId];
      if (!node) throw new Error(`Node missing: ${nodeId}`);
      node.transform = { ...node.transform, ...transform };
      return document;
    },
  };
}

export function setVectorStyle(
  nodeIds: string[],
  style: Partial<VectorStyle>,
): DocumentCommand {
  return {
    label: "Set vector style",
    execute(document) {
      for (const nodeId of nodeIds) {
        const node = document.nodes[nodeId];
        if (node) Object.assign(node, style);
      }
      return document;
    },
  };
}

export function addPathSegment(nodeId: string, segment: PathSegment): DocumentCommand {
  return {
    label: "Add path segment",
    execute(document) {
      requirePath(document, nodeId).segments.push(segment);
      return document;
    },
  };
}

export function updatePathSegment(
  nodeId: string,
  segmentId: string,
  update: Partial<PathSegment>,
): DocumentCommand {
  return {
    label: "Update path segment",
    execute(document) {
      const node = requirePath(document, nodeId);
      const index = node.segments.findIndex((segment) => segment.id === segmentId);
      if (index < 0) throw new Error(`Segment missing: ${segmentId}`);
      node.segments[index] = { ...node.segments[index], ...update };
      return document;
    },
  };
}

export function closePath(nodeId: string, closed = true): DocumentCommand {
  return {
    label: closed ? "Close path" : "Open path",
    execute(document) {
      requirePath(document, nodeId).closed = closed;
      return document;
    },
  };
}

export function reorderVectorNode(
  nodeId: string,
  beforeNodeId: string | null,
): DocumentCommand {
  return {
    label: "Reorder vector node",
    execute(document) {
      const node = document.nodes[nodeId];
      if (!node) throw new Error(`Node missing: ${nodeId}`);
      const list = node.parentId
        ? requireGroup(document, node.parentId).childIds
        : document.rootIds;
      const next = list.filter((id) => id !== nodeId);
      if (beforeNodeId === null) next.push(nodeId);
      else {
        const index = next.indexOf(beforeNodeId);
        if (index < 0) throw new Error(`Before node missing: ${beforeNodeId}`);
        next.splice(index, 0, nodeId);
      }
      if (node.parentId) requireGroup(document, node.parentId).childIds = next;
      else document.rootIds = next;
      return document;
    },
  };
}

function requirePath(document: SvgDocument, nodeId: string): PathNode {
  const node = document.nodes[nodeId];
  if (!node || node.type !== "path") throw new Error(`Path missing: ${nodeId}`);
  return node;
}

function requireGroup(document: SvgDocument, nodeId: string) {
  const node = document.nodes[nodeId];
  if (!node || node.type !== "group") throw new Error(`Group missing: ${nodeId}`);
  return node;
}
