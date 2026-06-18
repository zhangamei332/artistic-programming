import type { EditorPointerEvent, PathNode, PathSegment, Vec2 } from "../model/types.js";
import {
  createDefaultStyle, createDefaultTransform, createId,
  distance, multiply, subtract,
} from "../model/defaults.js";
import {
  addPathSegment, addVectorNode, closePath, updatePathSegment,
} from "../model/commands.js";
import type { EditorTool, ToolContext } from "./toolTypes.js";

interface PenState {
  pathId: string;
  activeSegmentId?: string;
  pointerDownPoint?: Vec2;
}

export class PenTool implements EditorTool {
  public readonly id: "pen" | "pencil";
  public readonly cursor = "crosshair";
  private state?: PenState;

  public constructor(id: "pen" | "pencil" = "pen") {
    this.id = id;
  }

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;

    if (!this.state) {
      const path = createPath(event.document);
      context.store.beginTransaction();
      context.store.apply(addVectorNode(path));
      this.state = {
        pathId: path.id,
        activeSegmentId: path.segments[0].id,
        pointerDownPoint: event.document,
      };
      return;
    }

    const path = context.getDocument().nodes[this.state.pathId];
    if (!path || path.type !== "path") return;

    const first = path.segments[0];
    if (path.segments.length >= 2 && distance(event.document, first.point) < 8) {
      context.store.apply(closePath(path.id, true));
      context.store.commitTransaction();
      this.state = undefined;
      context.setActiveTool("select");
      return;
    }

    const segment = createSegment(event.document);
    context.store.apply(addPathSegment(path.id, segment));
    this.state.activeSegmentId = segment.id;
    this.state.pointerDownPoint = event.document;
  }

  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.state?.activeSegmentId || !this.state.pointerDownPoint) return;
    const drag = subtract(event.document, this.state.pointerDownPoint);
    if (Math.hypot(drag.x, drag.y) < 2) return;

    context.store.apply(updatePathSegment(
      this.state.pathId,
      this.state.activeSegmentId,
      {
        anchorMode: "smooth",
        handleOut: drag,
        handleIn: multiply(drag, -1),
      },
    ));
  }

  public pointerUp(): void {
    if (this.state) this.state.pointerDownPoint = undefined;
  }

  public keyDown(event: KeyboardEvent, context: ToolContext): void {
    if (event.key === "Enter" && this.state) {
      context.store.commitTransaction();
      this.state = undefined;
      context.setActiveTool("select");
    } else if (event.key === "Escape") {
      this.cancel(context);
    }
  }

  public cancel(context: ToolContext): void {
    if (!this.state) return;
    context.store.rollbackTransaction();
    this.state = undefined;
  }
}

function createSegment(point: Vec2): PathSegment {
  return {
    id: createId("segment"),
    point,
    handleIn: { x: 0, y: 0 },
    handleOut: { x: 0, y: 0 },
    anchorMode: "corner",
  };
}

function createPath(point: Vec2): PathNode {
  return {
    id: createId("path"), type: "path", name: "Path",
    parentId: null, visible: true, locked: false,
    transform: createDefaultTransform(),
    ...createDefaultStyle(),
    fill: null,
    closed: false,
    segments: [createSegment(point)],
  };
}
