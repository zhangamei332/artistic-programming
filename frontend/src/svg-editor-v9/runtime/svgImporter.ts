import type { SvgDocument, VectorNode } from "../model/types.js";
import { createDefaultStyle, createDefaultTransform, createEmptyDocument, createId } from "../model/defaults.js";

export function importSvgString(svgText: string): SvgDocument {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = parsed.querySelector("svg");
  if (!svg) throw new Error("SVG 根节点不存在");

  const width = readLength(svg.getAttribute("width")) || 1920;
  const height = readLength(svg.getAttribute("height")) || 1080;
  const viewBox = parseViewBox(svg.getAttribute("viewBox"), width, height);
  const document = createEmptyDocument(width, height);
  document.viewBox = viewBox;

  svg.querySelectorAll("path,rect,ellipse,circle,line,polygon,text").forEach((element) => {
    const node = elementToVectorNode(element);
    if (!node) return;
    document.nodes[node.id] = node;
    document.rootIds.push(node.id);
  });

  return document;
}

function elementToVectorNode(element: Element): VectorNode | null {
  const style = {
    ...createDefaultStyle(),
    fill: element.getAttribute("fill") || null,
    stroke: element.getAttribute("stroke") || null,
    strokeWidth: readLength(element.getAttribute("stroke-width")) || 1,
    opacity: Number(element.getAttribute("opacity") || 1),
  };
  const common = {
    parentId: null,
    visible: true,
    locked: false,
    transform: createDefaultTransform(),
    ...style,
  };

  switch (element.tagName.toLowerCase()) {
    case "rect":
      return {
        ...common,
        id: createId("rect"),
        type: "rectangle",
        name: "Imported Rectangle",
        transform: createDefaultTransform(readLength(element.getAttribute("x")), readLength(element.getAttribute("y"))),
        width: readLength(element.getAttribute("width")),
        height: readLength(element.getAttribute("height")),
        radiusX: readLength(element.getAttribute("rx")),
        radiusY: readLength(element.getAttribute("ry")),
      };
    case "ellipse":
    case "circle": {
      const radius = readLength(element.getAttribute("r"));
      return {
        ...common,
        id: createId("ellipse"),
        type: "ellipse",
        name: "Imported Ellipse",
        transform: createDefaultTransform(readLength(element.getAttribute("cx")), readLength(element.getAttribute("cy"))),
        radiusX: readLength(element.getAttribute("rx")) || radius,
        radiusY: readLength(element.getAttribute("ry")) || radius,
      };
    }
    case "line":
      return {
        ...common,
        id: createId("line"),
        type: "line",
        name: "Imported Line",
        fill: null,
        start: { x: readLength(element.getAttribute("x1")), y: readLength(element.getAttribute("y1")) },
        end: { x: readLength(element.getAttribute("x2")), y: readLength(element.getAttribute("y2")) },
      };
    case "text":
      return {
        ...common,
        id: createId("text"),
        type: "text",
        name: "Imported Text",
        transform: createDefaultTransform(readLength(element.getAttribute("x")), readLength(element.getAttribute("y"))),
        text: element.textContent || "",
        fontFamily: element.getAttribute("font-family") || "Microsoft YaHei, sans-serif",
        fontSize: readLength(element.getAttribute("font-size")) || 48,
        fontWeight: element.getAttribute("font-weight") || 400,
        letterSpacing: readLength(element.getAttribute("letter-spacing")),
        lineHeight: 1.2,
        textAlign: "left",
        width: 360,
        height: 80,
      };
    default:
      return null;
  }
}

function parseViewBox(value: string | null, width: number, height: number): [number, number, number, number] {
  const parts = value?.split(/[\s,]+/).map(Number).filter((item) => Number.isFinite(item)) || [];
  return parts.length === 4 ? [parts[0], parts[1], parts[2], parts[3]] : [0, 0, width, height];
}

function readLength(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
