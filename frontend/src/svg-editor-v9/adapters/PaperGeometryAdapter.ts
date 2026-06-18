import paper from "paper";
import type { PathNode, SvgDocument, VectorNode } from "../model/types.js";
import { pathNodeToD } from "../geometry/svgPath.js";
import { createDefaultStyle, createDefaultTransform, createId } from "../model/defaults.js";

export class PaperGeometryAdapter {
  private readonly scope: paper.PaperScope;

  public constructor() {
    this.scope = new paper.PaperScope();
    this.scope.setup(new this.scope.Size(1, 1));
  }

  public boolean(
    document: SvgDocument,
    nodeIds: string[],
    operation: "unite" | "subtract" | "intersect" | "exclude" | "divide",
  ): PathNode[] {
    const paths = nodeIds.map((id) => this.toPaperItem(document.nodes[id]));
    if (paths.length < 2) throw new Error("Boolean operation needs at least two nodes");

    let result = paths[0];
    for (let i = 1; i < paths.length; i += 1) {
      result = applyBoolean(result, paths[i], operation);
    }
    return this.fromPaperItem(result);
  }

  public simplify(node: PathNode, tolerance = 2.5): PathNode {
    const path = this.toPaperPath(node);
    path.simplify(tolerance);
    return this.fromPaperPath(path, node);
  }

  public smooth(node: PathNode): PathNode {
    const path = this.toPaperPath(node);
    path.smooth({ type: "continuous" });
    return this.fromPaperPath(path, node);
  }

  public dispose(): void {
    this.scope.project.clear();
  }

  private toPaperItem(node: VectorNode): paper.Item {
    if (!node) throw new Error("Vector node missing");
    if (node.type === "path") return this.toPaperPath(node);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${temporaryPath(node)}"/></svg>`;
    const item = this.scope.project.importSVG(svg, { insert: false });
    if (!(item instanceof this.scope.Group) || !item.firstChild) {
      throw new Error("Paper.js import failed");
    }
    return item.firstChild;
  }

  private toPaperPath(node: PathNode): paper.Path {
    const path = new this.scope.Path(pathNodeToD(node));
    path.closed = node.closed;
    return path;
  }

  private fromPaperItem(item: paper.Item): PathNode[] {
    if (item instanceof this.scope.CompoundPath) {
      return item.children.flatMap((child) =>
        child instanceof this.scope.Path ? [this.fromPaperPath(child)] : [],
      );
    }
    return item instanceof this.scope.Path ? [this.fromPaperPath(item)] : [];
  }

  private fromPaperPath(path: paper.Path, source?: PathNode): PathNode {
    return {
      id: source?.id ?? createId("boolean_path"),
      type: "path",
      name: source?.name ?? "Boolean Path",
      parentId: source?.parentId ?? null,
      visible: source?.visible ?? true,
      locked: source?.locked ?? false,
      transform: source?.transform ?? createDefaultTransform(),
      ...createDefaultStyle(),
      fill: source?.fill ?? "#D9D9D9",
      stroke: source?.stroke ?? null,
      strokeWidth: source?.strokeWidth ?? 0,
      closed: path.closed,
      segments: path.segments.map((segment) => ({
        id: createId("segment"),
        point: { x: segment.point.x, y: segment.point.y },
        handleIn: { x: segment.handleIn.x, y: segment.handleIn.y },
        handleOut: { x: segment.handleOut.x, y: segment.handleOut.y },
        anchorMode: "smooth",
      })),
    };
  }
}

function applyBoolean(
  left: paper.Item,
  right: paper.Item,
  operation: "unite" | "subtract" | "intersect" | "exclude" | "divide",
): paper.Item {
  if (!(left instanceof paper.PathItem) || !(right instanceof paper.PathItem)) {
    throw new Error("Boolean inputs must be PathItems");
  }
  switch (operation) {
    case "unite": return left.unite(right);
    case "subtract": return left.subtract(right);
    case "intersect": return left.intersect(right);
    case "exclude": return left.exclude(right);
    case "divide": return left.divide(right);
  }
}

function temporaryPath(node: VectorNode): string {
  switch (node.type) {
    case "rectangle":
      return `M0 0 H${node.width} V${node.height} H0 Z`;
    case "ellipse":
      return `M${-node.radiusX} 0 A${node.radiusX} ${node.radiusY} 0 1 0 ${node.radiusX} 0 A${node.radiusX} ${node.radiusY} 0 1 0 ${-node.radiusX} 0 Z`;
    case "line":
      return `M${node.start.x} ${node.start.y} L${node.end.x} ${node.end.y}`;
    case "path":
      return pathNodeToD(node);
    default:
      throw new Error(`Convert ${node.type} to path before boolean operation`);
  }
}
