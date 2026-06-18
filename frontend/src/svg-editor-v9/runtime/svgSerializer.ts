import type { SvgDocument, VectorNode } from "../model/types.js";
import { pathNodeToD } from "../geometry/svgPath.js";

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function style(node: VectorNode): string {
  const values = [
    `fill="${node.fill ?? "none"}"`,
    `stroke="${node.stroke ?? "none"}"`,
    `stroke-width="${node.strokeWidth}"`,
    `opacity="${node.opacity}"`,
  ];
  if (node.lineCap) values.push(`stroke-linecap="${node.lineCap}"`);
  if (node.lineJoin) values.push(`stroke-linejoin="${node.lineJoin}"`);
  if (node.fillRule) values.push(`fill-rule="${node.fillRule}"`);
  if (node.dashArray?.length) values.push(`stroke-dasharray="${node.dashArray.join(" ")}"`);
  return values.join(" ");
}

function transform(node: VectorNode): string {
  const t = node.transform;
  return [
    `translate(${t.x} ${t.y})`,
    `rotate(${t.rotation})`,
    `skewX(${t.skewX})`,
    `skewY(${t.skewY})`,
    `scale(${t.scaleX} ${t.scaleY})`,
  ].join(" ");
}

function polygonPoints(radius: number, sides: number): string {
  const count = Math.max(3, Math.floor(sides));
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
  }).join(" ");
}

function starPoints(points: number, outer: number, inner: number): string {
  const count = Math.max(2, Math.floor(points));
  return Array.from({ length: count * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const a = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
  }).join(" ");
}

function renderNode(document: SvgDocument, id: string): string {
  const node = document.nodes[id];
  if (!node || !node.visible) return "";

  const common = `data-vector-node-id="${esc(node.id)}" transform="${transform(node)}" ${style(node)}`;

  switch (node.type) {
    case "group":
      return `<g ${common}>${node.childIds.map((child) => renderNode(document, child)).join("")}</g>`;
    case "path":
      return `<path ${common} d="${pathNodeToD(node)}"/>`;
    case "rectangle":
      return `<rect ${common} x="0" y="0" width="${node.width}" height="${node.height}" rx="${node.radiusX}" ry="${node.radiusY}"/>`;
    case "ellipse":
      return `<ellipse ${common} cx="0" cy="0" rx="${node.radiusX}" ry="${node.radiusY}"/>`;
    case "line":
      return `<line ${common} x1="${node.start.x}" y1="${node.start.y}" x2="${node.end.x}" y2="${node.end.y}"/>`;
    case "polygon":
      return `<polygon ${common} points="${polygonPoints(node.radius, node.sides)}"/>`;
    case "star":
      return `<polygon ${common} points="${starPoints(node.points, node.outerRadius, node.innerRadius)}"/>`;
    case "text":
      return `<text ${common} font-family="${esc(node.fontFamily)}" font-size="${node.fontSize}" font-weight="${node.fontWeight}" letter-spacing="${node.letterSpacing}">${esc(node.text)}</text>`;
    case "image":
      return `<image ${common} data-asset-id="${esc(node.assetId)}" width="${node.width}" height="${node.height}"/>`;
  }
}

export function serializeSvgDocument(document: SvgDocument): string {
  const body = document.rootIds.map((id) => renderNode(document, id)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="${document.viewBox.join(" ")}">${body}</svg>`;
}
