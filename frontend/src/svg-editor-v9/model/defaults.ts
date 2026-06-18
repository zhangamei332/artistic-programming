import type { SvgDocument, VectorStyle, VectorTransform, Vec2 } from "./types.js";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createDefaultTransform(x = 0, y = 0): VectorTransform {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 };
}

export function createDefaultStyle(): VectorStyle {
  return {
    fill: "#D9D9D9",
    stroke: "#222222",
    strokeWidth: 1,
    opacity: 1,
    blendMode: "normal",
    lineCap: "round",
    lineJoin: "round",
    fillRule: "nonzero",
  };
}

export function createEmptyDocument(width = 1920, height = 1080): SvgDocument {
  return {
    version: 9,
    width,
    height,
    viewBox: [0, 0, width, height],
    rootIds: [],
    nodes: {},
    selection: { nodeIds: [], anchorRefs: [] },
  };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function multiply(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, y: a.y * scalar };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
