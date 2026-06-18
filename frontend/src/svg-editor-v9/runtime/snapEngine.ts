import type { SvgDocument, Vec2 } from "../model/types.js";

export interface SnapOptions {
  enabled: boolean;
  gridSize: number;
  threshold: number;
  snapGrid: boolean;
  snapCenters: boolean;
}

export interface SnapResult {
  point: Vec2;
  guides: Array<{ axis: "x" | "y"; value: number; source: string }>;
}

export class SnapEngine {
  public snap(point: Vec2, document: SvgDocument, options: SnapOptions): SnapResult {
    if (!options.enabled) return { point, guides: [] };
    let x = point.x;
    let y = point.y;
    const guides: SnapResult["guides"] = [];

    if (options.snapGrid && options.gridSize > 0) {
      const gx = Math.round(x / options.gridSize) * options.gridSize;
      const gy = Math.round(y / options.gridSize) * options.gridSize;
      if (Math.abs(gx - x) <= options.threshold) {
        x = gx;
        guides.push({ axis: "x", value: gx, source: "grid" });
      }
      if (Math.abs(gy - y) <= options.threshold) {
        y = gy;
        guides.push({ axis: "y", value: gy, source: "grid" });
      }
    }

    if (options.snapCenters) {
      const cx = document.viewBox[0] + document.viewBox[2] / 2;
      const cy = document.viewBox[1] + document.viewBox[3] / 2;
      if (Math.abs(cx - x) <= options.threshold) {
        x = cx;
        guides.push({ axis: "x", value: cx, source: "document-center" });
      }
      if (Math.abs(cy - y) <= options.threshold) {
        y = cy;
        guides.push({ axis: "y", value: cy, source: "document-center" });
      }
    }

    return { point: { x, y }, guides };
  }
}
