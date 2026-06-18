import type { EditorPointerEvent, SvgDocument, ToolId, ViewportState } from "../model/types.js";
import type { SvgDocumentStore } from "../model/documentStore.js";
import type { SnapEngine } from "../runtime/snapEngine.js";

export interface ToolContext {
  store: SvgDocumentStore;
  snapEngine: SnapEngine;
  getDocument(): SvgDocument;
  getViewport(): ViewportState;
  setViewport(viewport: ViewportState): void;
  requestRender(): void;
  setActiveTool(toolId: ToolId): void;
}

export interface EditorTool {
  id: ToolId;
  cursor: string;
  pointerDown?(event: EditorPointerEvent, context: ToolContext): void;
  pointerMove?(event: EditorPointerEvent, context: ToolContext): void;
  pointerUp?(event: EditorPointerEvent, context: ToolContext): void;
  keyDown?(event: KeyboardEvent, context: ToolContext): void;
  cancel?(context: ToolContext): void;
}
