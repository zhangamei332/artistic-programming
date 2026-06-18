import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AnchorRef, EditorPointerEvent, PathNode, SvgDocument, ToolId,
  Vec2, VectorNode, ViewportState,
} from "../model/types.js";
import { createEmptyDocument } from "../model/defaults.js";
import { SvgDocumentStore } from "../model/documentStore.js";
import { serializeSvgDocument } from "../runtime/svgSerializer.js";
import { importSvgString } from "../runtime/svgImporter.js";
import { SnapEngine, type SnapOptions } from "../runtime/snapEngine.js";
import { ToolController } from "../runtime/toolController.js";
import { DirectSelectTool } from "../tools/directSelectTool.js";
import { SelectTool } from "../tools/selectTool.js";
import { PenTool } from "../tools/penTool.js";
import {
  EllipseTool, LineTool, PolygonTool, RectangleTool,
  RoundedRectangleTool, StarTool, TextTool,
} from "../tools/shapeTools.js";
import { HandTool, ZoomTool } from "../tools/viewTools.js";
import type { ToolContext } from "../tools/toolTypes.js";
import "./SvgEditorNode.css";

export interface SvgEditorNodeProps {
  initialDocument?: SvgDocument;
  onChange?: (document: SvgDocument, svg: string) => void;
  onClose?: () => void;
}

const tools: Array<{ id: ToolId; label: string; shortcut?: string }> = [
  { id: "select", label: "选择", shortcut: "V" },
  { id: "directSelect", label: "节点", shortcut: "A" },
  { id: "pen", label: "钢笔", shortcut: "P" },
  { id: "pencil", label: "铅笔", shortcut: "N" },
  { id: "line", label: "直线", shortcut: "L" },
  { id: "rectangle", label: "矩形", shortcut: "R" },
  { id: "roundedRectangle", label: "圆角矩形" },
  { id: "ellipse", label: "椭圆", shortcut: "O" },
  { id: "polygon", label: "多边形" },
  { id: "star", label: "星形" },
  { id: "text", label: "文字", shortcut: "T" },
  { id: "hand", label: "抓手", shortcut: "H" },
  { id: "zoom", label: "缩放", shortcut: "Z" },
];

const defaultSnapOptions: SnapOptions = {
  enabled: true,
  gridSize: 20,
  threshold: 8,
  snapGrid: true,
  snapCenters: true,
};

export function SvgEditorNode({ initialDocument, onChange, onClose }: SvgEditorNodeProps) {
  const store = useMemo(
    () => new SvgDocumentStore(initialDocument ?? createEmptyDocument()),
    [],
  );
  const controller = useMemo(() => createController(), []);
  const snapEngine = useMemo(() => new SnapEngine(), []);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState(store.getSnapshot());
  const [toolId, setToolId] = useState<ToolId>("select");
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [snapOptions, setSnapOptions] = useState<SnapOptions>(defaultSnapOptions);

  const emitChange = useCallback((next: SvgDocument) => {
    setDocument(structuredClone(next));
    onChange?.(next, serializeSvgDocument(next));
  }, [onChange]);

  useEffect(() => store.subscribe(emitChange), [store, emitChange]);

  const context: ToolContext = {
    store,
    snapEngine,
    getDocument: () => store.getSnapshot(),
    getViewport: () => viewport,
    setViewport,
    requestRender: () => setDocument(structuredClone(store.getSnapshot())),
    setActiveTool: (next) => {
      controller.setActive(next, context);
      setToolId(next);
    },
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? store.redo() : store.undo();
        return;
      }
      const shortcut = shortcutTool(event.key);
      if (shortcut && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        controller.setActive(shortcut, context);
        setToolId(shortcut);
        return;
      }
      controller.keyDown(event, context);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const displayedViewBox = useMemo((): [number, number, number, number] => ([
    document.viewBox[0] + viewport.panX,
    document.viewBox[1] + viewport.panY,
    document.viewBox[2] / viewport.zoom,
    document.viewBox[3] / viewport.zoom,
  ]), [document.viewBox, viewport]);

  const pointer = (event: React.PointerEvent<SVGSVGElement>): EditorPointerEvent => {
    const target = event.target as SVGElement;
    const rawDocumentPoint = screenToDocument({ x: event.clientX, y: event.clientY }, svgRef.current);
    const snapped = snapEngine.snap(rawDocumentPoint, store.getSnapshot(), snapOptions).point;
    return {
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      document: snapped,
      button: event.button,
      modifiers: {
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
      },
      targetNodeId:
        target.closest("[data-vector-node-id]")
          ?.getAttribute("data-vector-node-id") ?? undefined,
    };
  };

  const selectedNodes = document.selection.nodeIds
    .map((id) => document.nodes[id])
    .filter((node): node is VectorNode => Boolean(node));
  const selectedNode = selectedNodes[0];
  const svg = serializeSvgDocument(document);

  return (
    <div className="svg-editor-node">
      <header className="svg-editor-toolbar">
        <div className="svg-editor-tools">
          {tools.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={toolId === item.id}
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
              onClick={() => {
                controller.setActive(item.id, context);
                setToolId(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="svg-editor-actions">
          <button type="button" onClick={() => store.undo()}>撤销</button>
          <button type="button" onClick={() => store.redo()}>恢复</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>导入 SVG</button>
          <button type="button" onClick={() => downloadSvg(svg)}>导出 SVG</button>
          <button type="button" onClick={onClose}>关闭</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                store.replaceDocument(importSvgString(text));
                event.target.value = "";
              });
            }}
          />
        </div>
      </header>

      <div className="svg-editor-main">
        <aside className="svg-editor-layers">
          <strong>图层</strong>
          {document.rootIds.length === 0 && <span className="svg-editor-muted">暂无图层</span>}
          {document.rootIds.map((id) => {
            const node = document.nodes[id];
            if (!node) return null;
            return (
              <button
                key={id}
                type="button"
                data-active={document.selection.nodeIds.includes(id)}
                onClick={() => selectNode(store, id)}
              >
                <span>{node.name}</span>
                <small>{node.type}</small>
              </button>
            );
          })}
        </aside>

        <main className="svg-editor-viewport">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={displayedViewBox.join(" ")}
            style={{ cursor: controller.getCursor() }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              controller.pointerDown(pointer(event), context);
            }}
            onPointerMove={(event) => controller.pointerMove(pointer(event), context)}
            onPointerUp={(event) => controller.pointerUp(pointer(event), context)}
          >
            <rect
              x={document.viewBox[0]}
              y={document.viewBox[1]}
              width={document.viewBox[2]}
              height={document.viewBox[3]}
              className="svg-editor-page"
            />
            <g
              dangerouslySetInnerHTML={{
                __html: stripSvgRoot(svg),
              }}
            />
            {selectedNodes.map((node) => (
              <SelectionOutline key={node.id} node={node} />
            ))}
            {selectedNodes.map((node) => (
              node.type === "path" ? <PathControls key={node.id} node={node} selection={document.selection.anchorRefs} /> : null
            ))}
          </svg>
        </main>

        <aside className="svg-editor-inspector">
          <strong>参数</strong>
          {!selectedNode ? (
            <DocumentInspector
              document={document}
              snapOptions={snapOptions}
              onDocumentChange={(next) => store.replaceDocument(next)}
              onSnapChange={setSnapOptions}
            />
          ) : (
            <NodeInspector
              node={selectedNode}
              anchor={document.selection.anchorRefs[0]}
              onNodeChange={(update) => store.updateNode(selectedNode.id, update)}
              onAnchorModeChange={(mode) => {
                if (selectedNode.type !== "path" || !document.selection.anchorRefs[0]) return;
                const anchor = document.selection.anchorRefs[0];
                const next = structuredClone(document);
                const path = next.nodes[anchor.nodeId];
                if (!path || path.type !== "path") return;
                const segment = path.segments.find((item) => item.id === anchor.segmentId);
                if (!segment) return;
                segment.anchorMode = mode;
                store.replaceDocument(next);
              }}
            />
          )}
          <div className="svg-editor-output">
            <span>输出</span>
            <small>VectorDocument</small>
            <small>SvgString</small>
            <small>VectorPath</small>
            <small>Texture2D</small>
            <small>PointArray</small>
          </div>
        </aside>
      </div>
    </div>
  );
}

function createController(): ToolController {
  const controller = new ToolController();
  controller.register(new SelectTool());
  controller.register(new DirectSelectTool());
  controller.register(new PenTool("pen"));
  controller.register(new PenTool("pencil"));
  controller.register(new LineTool());
  controller.register(new RectangleTool());
  controller.register(new RoundedRectangleTool());
  controller.register(new EllipseTool());
  controller.register(new PolygonTool());
  controller.register(new StarTool());
  controller.register(new TextTool());
  controller.register(new HandTool());
  controller.register(new ZoomTool());
  return controller;
}

function DocumentInspector({
  document,
  snapOptions,
  onDocumentChange,
  onSnapChange,
}: {
  document: SvgDocument;
  snapOptions: SnapOptions;
  onDocumentChange: (document: SvgDocument) => void;
  onSnapChange: (options: SnapOptions) => void;
}) {
  return (
    <div className="svg-editor-inspector-fields">
      <label>宽度<input type="number" value={document.width} onChange={(event) => onDocumentChange({ ...document, width: Number(event.target.value), viewBox: [document.viewBox[0], document.viewBox[1], Number(event.target.value), document.viewBox[3]] })} /></label>
      <label>高度<input type="number" value={document.height} onChange={(event) => onDocumentChange({ ...document, height: Number(event.target.value), viewBox: [document.viewBox[0], document.viewBox[1], document.viewBox[2], Number(event.target.value)] })} /></label>
      <label>网格<input type="number" value={snapOptions.gridSize} onChange={(event) => onSnapChange({ ...snapOptions, gridSize: Number(event.target.value) })} /></label>
      <label><span>吸附</span><input type="checkbox" checked={snapOptions.enabled} onChange={(event) => onSnapChange({ ...snapOptions, enabled: event.target.checked })} /></label>
    </div>
  );
}

function NodeInspector({
  node,
  anchor,
  onNodeChange,
  onAnchorModeChange,
}: {
  node: VectorNode;
  anchor?: AnchorRef;
  onNodeChange: (update: Partial<VectorNode>) => void;
  onAnchorModeChange: (mode: "corner" | "smooth" | "symmetric") => void;
}) {
  return (
    <div className="svg-editor-inspector-fields">
      <label>名称<input value={node.name} onChange={(event) => onNodeChange({ name: event.target.value } as Partial<VectorNode>)} /></label>
      <label>X<input type="number" value={node.transform.x} onChange={(event) => onNodeChange({ transform: { ...node.transform, x: Number(event.target.value) } } as Partial<VectorNode>)} /></label>
      <label>Y<input type="number" value={node.transform.y} onChange={(event) => onNodeChange({ transform: { ...node.transform, y: Number(event.target.value) } } as Partial<VectorNode>)} /></label>
      <label>填充<input type="color" value={node.fill || "#000000"} onChange={(event) => onNodeChange({ fill: event.target.value } as Partial<VectorNode>)} /></label>
      <label>描边<input type="color" value={node.stroke || "#000000"} onChange={(event) => onNodeChange({ stroke: event.target.value } as Partial<VectorNode>)} /></label>
      <label>描边宽度<input type="number" value={node.strokeWidth} onChange={(event) => onNodeChange({ strokeWidth: Number(event.target.value) } as Partial<VectorNode>)} /></label>
      <label>透明度<input type="range" min="0" max="1" step="0.01" value={node.opacity} onChange={(event) => onNodeChange({ opacity: Number(event.target.value) } as Partial<VectorNode>)} /></label>
      {node.type === "text" && (
        <label>文字<textarea value={node.text} onChange={(event) => onNodeChange({ text: event.target.value } as Partial<VectorNode>)} /></label>
      )}
      {node.type === "path" && (
        <>
          <label><span>闭合</span><input type="checkbox" checked={node.closed} onChange={(event) => onNodeChange({ closed: event.target.checked } as Partial<VectorNode>)} /></label>
          {anchor && (
            <label>锚点类型
              <select
                value={node.segments.find((item) => item.id === anchor.segmentId)?.anchorMode || "corner"}
                onChange={(event) => onAnchorModeChange(event.target.value as "corner" | "smooth" | "symmetric")}
              >
                <option value="corner">角点</option>
                <option value="smooth">平滑</option>
                <option value="symmetric">对称</option>
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}

function SelectionOutline({ node }: { node: VectorNode }) {
  const bounds = estimateBounds(node);
  if (!bounds) return null;
  return <rect className="svg-editor-selection" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} />;
}

function PathControls({ node, selection }: { node: PathNode; selection: AnchorRef[] }) {
  return (
    <g className="svg-editor-path-controls">
      {node.segments.map((segment) => {
        const selected = selection.some((anchor) => anchor.nodeId === node.id && anchor.segmentId === segment.id);
        const handleIn = { x: segment.point.x + segment.handleIn.x, y: segment.point.y + segment.handleIn.y };
        const handleOut = { x: segment.point.x + segment.handleOut.x, y: segment.point.y + segment.handleOut.y };
        return (
          <g key={segment.id}>
            <line x1={segment.point.x} y1={segment.point.y} x2={handleIn.x} y2={handleIn.y} />
            <line x1={segment.point.x} y1={segment.point.y} x2={handleOut.x} y2={handleOut.y} />
            <circle className="svg-editor-handle" cx={handleIn.x} cy={handleIn.y} r="5" />
            <circle className="svg-editor-handle" cx={handleOut.x} cy={handleOut.y} r="5" />
            <circle className={selected ? "svg-editor-anchor-active" : "svg-editor-anchor"} cx={segment.point.x} cy={segment.point.y} r="6" />
          </g>
        );
      })}
    </g>
  );
}

function selectNode(store: SvgDocumentStore, nodeId: string) {
  const next = structuredClone(store.getSnapshot());
  next.selection = { nodeIds: [nodeId], anchorRefs: [] };
  store.replaceDocument(next, false);
}

function screenToDocument(screen: Vec2, svg: SVGSVGElement | null): Vec2 {
  if (!svg) return screen;
  const point = svg.createSVGPoint();
  point.x = screen.x;
  point.y = screen.y;
  const matrix = svg.getScreenCTM()?.inverse();
  if (!matrix) return screen;
  const result = point.matrixTransform(matrix);
  return { x: result.x, y: result.y };
}

function stripSvgRoot(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

function shortcutTool(key: string): ToolId | undefined {
  const map: Record<string, ToolId> = {
    v: "select",
    a: "directSelect",
    p: "pen",
    n: "pencil",
    l: "line",
    r: "rectangle",
    o: "ellipse",
    t: "text",
    h: "hand",
    z: "zoom",
  };
  return map[key.toLowerCase()];
}

function downloadSvg(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "svg-editor-node.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function estimateBounds(node: VectorNode): { x: number; y: number; width: number; height: number } | null {
  switch (node.type) {
    case "rectangle":
      return { x: node.transform.x, y: node.transform.y, width: node.width, height: node.height };
    case "ellipse":
      return { x: node.transform.x - node.radiusX, y: node.transform.y - node.radiusY, width: node.radiusX * 2, height: node.radiusY * 2 };
    case "line":
      return {
        x: node.transform.x + Math.min(node.start.x, node.end.x),
        y: node.transform.y + Math.min(node.start.y, node.end.y),
        width: Math.abs(node.end.x - node.start.x),
        height: Math.abs(node.end.y - node.start.y),
      };
    case "path": {
      if (!node.segments.length) return null;
      const xs = node.segments.map((segment) => segment.point.x);
      const ys = node.segments.map((segment) => segment.point.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) };
    }
    case "polygon":
      return { x: node.transform.x - node.radius, y: node.transform.y - node.radius, width: node.radius * 2, height: node.radius * 2 };
    case "star":
      return { x: node.transform.x - node.outerRadius, y: node.transform.y - node.outerRadius, width: node.outerRadius * 2, height: node.outerRadius * 2 };
    case "text":
      return { x: node.transform.x, y: node.transform.y - node.fontSize, width: node.width, height: node.height };
    default:
      return null;
  }
}
