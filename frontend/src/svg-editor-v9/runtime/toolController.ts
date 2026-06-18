import type { EditorPointerEvent, ToolId } from "../model/types.js";
import type { EditorTool, ToolContext } from "../tools/toolTypes.js";

export class ToolController {
  private tools = new Map<ToolId, EditorTool>();
  private activeId: ToolId = "select";

  public register(tool: EditorTool): void {
    this.tools.set(tool.id, tool);
  }

  public setActive(toolId: ToolId, context: ToolContext): void {
    this.active().cancel?.(context);
    if (!this.tools.has(toolId)) throw new Error(`Tool not registered: ${toolId}`);
    this.activeId = toolId;
    context.requestRender();
  }

  public getActiveId(): ToolId { return this.activeId; }
  public getCursor(): string { return this.active().cursor; }

  public pointerDown(event: EditorPointerEvent, context: ToolContext): void {
    this.active().pointerDown?.(event, context);
  }
  public pointerMove(event: EditorPointerEvent, context: ToolContext): void {
    this.active().pointerMove?.(event, context);
  }
  public pointerUp(event: EditorPointerEvent, context: ToolContext): void {
    this.active().pointerUp?.(event, context);
  }
  public keyDown(event: KeyboardEvent, context: ToolContext): void {
    this.active().keyDown?.(event, context);
  }

  private active(): EditorTool {
    const tool = this.tools.get(this.activeId);
    if (!tool) throw new Error(`Active tool missing: ${this.activeId}`);
    return tool;
  }
}
