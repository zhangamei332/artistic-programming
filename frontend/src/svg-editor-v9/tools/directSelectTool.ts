import type { AnchorRef, EditorPointerEvent, PathNode, Vec2 } from "../model/types.js";
import { updatePathSegment } from "../model/commands.js";
import type { EditorTool, ToolContext } from "./toolTypes.js";

interface DragState {
  anchor: AnchorRef;
  start: Vec2;
  original: Vec2;
}

export class DirectSelectTool implements EditorTool {
  public readonly id = "directSelect" as const;
  public readonly cursor = "crosshair";
  private drag?: DragState;

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const document = structuredClone(context.getDocument());
    const hit = findNearestAnchor(document, event.document, 12);
    if (!hit) {
      document.selection = { nodeIds: [], anchorRefs: [] };
      context.store.replaceDocument(document);
      return;
    }

    document.selection = { nodeIds: [hit.nodeId], anchorRefs: [hit] };
    context.store.replaceDocument(document);
    context.store.beginTransaction();
    this.drag = {
      anchor: hit,
      start: event.document,
      original: readAnchorPart(document.nodes[hit.nodeId] as PathNode, hit),
    };
  }

  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.drag) return;
    const dx = event.document.x - this.drag.start.x;
    const dy = event.document.y - this.drag.start.y;
    context.store.apply(updatePathSegment(
      this.drag.anchor.nodeId,
      this.drag.anchor.segmentId,
      {
        [this.drag.anchor.part]: {
          x: this.drag.original.x + dx,
          y: this.drag.original.y + dy,
        },
      },
    ));
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
}

function findNearestAnchor(document: ReturnType<ToolContext["getDocument"]>, point: Vec2, threshold: number): AnchorRef | null {
  let best: { anchor: AnchorRef; distance: number } | null = null;

  for (const node of Object.values(document.nodes)) {
    if (node.type !== "path" || node.locked || !node.visible) continue;
    for (const segment of node.segments) {
      const anchors: Array<{ part: AnchorRef["part"]; point: Vec2 }> = [
        { part: "point", point: segment.point },
        { part: "handleIn", point: { x: segment.point.x + segment.handleIn.x, y: segment.point.y + segment.handleIn.y } },
        { part: "handleOut", point: { x: segment.point.x + segment.handleOut.x, y: segment.point.y + segment.handleOut.y } },
      ];
      for (const item of anchors) {
        const distance = Math.hypot(point.x - item.point.x, point.y - item.point.y);
        if (distance <= threshold && (!best || distance < best.distance)) {
          best = {
            anchor: { nodeId: node.id, segmentId: segment.id, part: item.part },
            distance,
          };
        }
      }
    }
  }

  return best?.anchor ?? null;
}

function readAnchorPart(node: PathNode, anchor: AnchorRef): Vec2 {
  const segment = node.segments.find((item) => item.id === anchor.segmentId);
  if (!segment) return { x: 0, y: 0 };
  return { ...segment[anchor.part] };
}
