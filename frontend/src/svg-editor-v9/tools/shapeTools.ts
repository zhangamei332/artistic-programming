import type {
  EditorPointerEvent, EllipseNode, LineNode, PolygonNode,
  RectangleNode, StarNode, TextNode, Vec2,
} from "../model/types.js";
import { createDefaultStyle, createDefaultTransform, createId } from "../model/defaults.js";
import { addVectorNode } from "../model/commands.js";
import type { EditorTool, ToolContext } from "./toolTypes.js";

interface DragState { start: Vec2; nodeId: string; }

abstract class DragShapeTool implements EditorTool {
  public abstract readonly id: "rectangle" | "roundedRectangle" | "ellipse" | "line" | "polygon" | "star";
  public readonly cursor = "crosshair";
  protected drag?: DragState;

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const node = this.createNode(event.document);
    context.store.beginTransaction();
    context.store.apply(addVectorNode(node));
    this.drag = { start: event.document, nodeId: node.id };
  }

  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.drag) return;
    const start = this.drag.start;
    let dx = event.document.x - start.x;
    let dy = event.document.y - start.y;

    if (event.modifiers.shift) {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * size;
      dy = Math.sign(dy || 1) * size;
    }

    const centered = event.modifiers.alt;
    const x = centered ? start.x - Math.abs(dx) : Math.min(start.x, start.x + dx);
    const y = centered ? start.y - Math.abs(dy) : Math.min(start.y, start.y + dy);
    const width = centered ? Math.abs(dx) * 2 : Math.abs(dx);
    const height = centered ? Math.abs(dy) * 2 : Math.abs(dy);

    const node = context.getDocument().nodes[this.drag.nodeId];
    if (!node) return;

    if (node.type === "rectangle") {
      context.store.updateNode(node.id, {
        transform: { ...node.transform, x, y },
        width,
        height,
      });
    } else if (node.type === "ellipse") {
      context.store.updateNode(node.id, {
        transform: { ...node.transform, x: x + width / 2, y: y + height / 2 },
        radiusX: width / 2,
        radiusY: height / 2,
      });
    } else if (node.type === "line") {
      context.store.updateNode(node.id, {
        start: { x: 0, y: 0 },
        end: { x: dx, y: dy },
      });
    } else if (node.type === "polygon") {
      context.store.updateNode(node.id, {
        radius: Math.max(1, Math.hypot(dx, dy)),
      });
    } else if (node.type === "star") {
      const outerRadius = Math.max(1, Math.hypot(dx, dy));
      context.store.updateNode(node.id, {
        outerRadius,
        innerRadius: outerRadius * 0.48,
      });
    }
  }

  public pointerUp(_event: EditorPointerEvent, context: ToolContext): void {
    if (!this.drag) return;
    this.drag = undefined;
    context.store.commitTransaction();
  }

  public cancel(context: ToolContext): void {
    if (!this.drag) return;
    this.drag = undefined;
    context.store.rollbackTransaction();
  }

  protected abstract createNode(point: Vec2): RectangleNode | EllipseNode | LineNode | PolygonNode | StarNode;
}

export class RectangleTool extends DragShapeTool {
  public readonly id = "rectangle" as const;
  protected createNode(point: Vec2): RectangleNode {
    return {
      id: createId("rect"), type: "rectangle", name: "Rectangle",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      width: 0, height: 0, radiusX: 0, radiusY: 0,
    };
  }
}

export class RoundedRectangleTool extends DragShapeTool {
  public readonly id = "roundedRectangle" as const;
  protected createNode(point: Vec2): RectangleNode {
    return {
      id: createId("rounded_rect"), type: "rectangle", name: "Rounded Rectangle",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      width: 0, height: 0, radiusX: 16, radiusY: 16,
    };
  }
}

export class EllipseTool extends DragShapeTool {
  public readonly id = "ellipse" as const;
  protected createNode(point: Vec2): EllipseNode {
    return {
      id: createId("ellipse"), type: "ellipse", name: "Ellipse",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      radiusX: 0, radiusY: 0,
    };
  }
}

export class LineTool extends DragShapeTool {
  public readonly id = "line" as const;
  protected createNode(point: Vec2): LineNode {
    return {
      id: createId("line"), type: "line", name: "Line",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      fill: null,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
    };
  }
}

export class PolygonTool extends DragShapeTool {
  public readonly id = "polygon" as const;
  protected createNode(point: Vec2): PolygonNode {
    return {
      id: createId("polygon"), type: "polygon", name: "Polygon",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      radius: 0,
      sides: 6,
    };
  }
}

export class StarTool extends DragShapeTool {
  public readonly id = "star" as const;
  protected createNode(point: Vec2): StarNode {
    return {
      id: createId("star"), type: "star", name: "Star",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(point.x, point.y),
      ...createDefaultStyle(),
      points: 5,
      outerRadius: 0,
      innerRadius: 0,
    };
  }
}

export class TextTool implements EditorTool {
  public readonly id = "text" as const;
  public readonly cursor = "text";

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const node: TextNode = {
      id: createId("text"), type: "text", name: "Text",
      parentId: null, visible: true, locked: false,
      transform: createDefaultTransform(event.document.x, event.document.y),
      ...createDefaultStyle(),
      fill: "#111111",
      stroke: null,
      strokeWidth: 0,
      text: "双击编辑文字",
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: 48,
      fontWeight: 600,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: "left",
      width: 360,
      height: 80,
    };
    context.store.apply(addVectorNode(node));
    context.setActiveTool("select");
  }
}
