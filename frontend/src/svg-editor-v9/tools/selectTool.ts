import type { EditorPointerEvent, Vec2 } from "../model/types.js";
import { setVectorTransform } from "../model/commands.js";
import type { EditorTool, ToolContext } from "./toolTypes.js";

interface MoveState {
  start: Vec2;
  original: Map<string, { x: number; y: number }>;
}

export class SelectTool implements EditorTool {
  public readonly id = "select" as const;
  public readonly cursor = "default";
  private move?: MoveState;

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const document = structuredClone(context.getDocument());
    const targetId = event.targetNodeId;

    if (!targetId) {
      document.selection = { nodeIds: [], anchorRefs: [] };
      context.store.replaceDocument(document);
      return;
    }

    document.selection = {
      nodeIds: event.modifiers.shift
        ? toggle(document.selection.nodeIds, targetId)
        : [targetId],
      anchorRefs: [],
    };
    context.store.replaceDocument(document);

    const original = new Map<string, { x: number; y: number }>();
    for (const id of document.selection.nodeIds) {
      const node = document.nodes[id];
      if (node && !node.locked) original.set(id, {
        x: node.transform.x,
        y: node.transform.y,
      });
    }
    this.move = { start: event.document, original };
    context.store.beginTransaction();
  }

  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.move) return;
    const dx = event.document.x - this.move.start.x;
    const dy = event.document.y - this.move.start.y;
    for (const [id, original] of this.move.original) {
      context.store.apply(setVectorTransform(id, {
        x: original.x + dx,
        y: original.y + dy,
      }));
    }
  }

  public pointerUp(_event: EditorPointerEvent, context: ToolContext): void {
    if (!this.move) return;
    this.move = undefined;
    context.store.commitTransaction();
  }

  public cancel(context: ToolContext): void {
    if (!this.move) return;
    this.move = undefined;
    context.store.rollbackTransaction();
  }
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}
