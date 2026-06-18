import type { EditorPointerEvent, Vec2 } from "../model/types.js";
import type { EditorTool, ToolContext } from "./toolTypes.js";

interface HandDragState {
  screen: Vec2;
  panX: number;
  panY: number;
}

export class HandTool implements EditorTool {
  public readonly id = "hand" as const;
  public readonly cursor = "grab";
  private drag?: HandDragState;

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const viewport = context.getViewport();
    this.drag = { screen: event.screen, panX: viewport.panX, panY: viewport.panY };
  }

  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    if (!this.drag) return;
    const viewport = context.getViewport();
    const document = context.getDocument();
    const scaleX = document.viewBox[2] / Math.max(1, window.innerWidth) / viewport.zoom;
    const scaleY = document.viewBox[3] / Math.max(1, window.innerHeight) / viewport.zoom;
    context.setViewport({
      ...viewport,
      panX: this.drag.panX - (event.screen.x - this.drag.screen.x) * scaleX,
      panY: this.drag.panY - (event.screen.y - this.drag.screen.y) * scaleY,
    });
  }

  public pointerUp(): void {
    this.drag = undefined;
  }

  public cancel(): void {
    this.drag = undefined;
  }
}

export class ZoomTool implements EditorTool {
  public readonly id = "zoom" as const;
  public readonly cursor = "zoom-in";

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    if (event.button !== 0) return;
    const viewport = context.getViewport();
    const factor = event.modifiers.alt ? 0.8 : 1.25;
    context.setViewport({
      ...viewport,
      zoom: Math.max(0.1, Math.min(8, viewport.zoom * factor)),
    });
  }
}
