import type { SvgDocument } from "../model/types.js";
import { serializeSvgDocument } from "./svgSerializer.js";
import { pathNodeToD } from "../geometry/svgPath.js";

export interface SvgEditorOutputs {
  document: SvgDocument;
  svg: string;
  path: string;
  texture: string;
  textureSource: string;
  points: Array<{ x: number; y: number }>;
}

export class SvgEditorNodeAdapter {
  public cook(document: SvgDocument): SvgEditorOutputs {
    const svg = serializeSvgDocument(document);
    const paths = Object.values(document.nodes).filter((node) => node.type === "path");
    const points = paths.flatMap((node) => node.segments.map((segment) => segment.point));
    const texture = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      document,
      svg,
      path: paths.map((node) => pathNodeToD(node)).join(" "),
      texture,
      textureSource: texture,
      points,
    };
  }
}
