import type { PathNode, PathSegment, Vec2 } from "../model/types.js";

function isZero(point: Vec2): boolean {
  return Math.abs(point.x) < 1e-9 && Math.abs(point.y) < 1e-9;
}

function p(value: Vec2): string {
  return `${Number(value.x.toFixed(4))} ${Number(value.y.toFixed(4))}`;
}

export function pathNodeToD(node: PathNode): string {
  if (!node.segments.length) return "";
  let d = `M ${p(node.segments[0].point)}`;

  const append = (current: PathSegment, next: PathSegment) => {
    if (isZero(current.handleOut) && isZero(next.handleIn)) {
      d += ` L ${p(next.point)}`;
      return;
    }
    const c1 = {
      x: current.point.x + current.handleOut.x,
      y: current.point.y + current.handleOut.y,
    };
    const c2 = {
      x: next.point.x + next.handleIn.x,
      y: next.point.y + next.handleIn.y,
    };
    d += ` C ${p(c1)} ${p(c2)} ${p(next.point)}`;
  };

  for (let i = 0; i < node.segments.length - 1; i += 1) {
    append(node.segments[i], node.segments[i + 1]);
  }

  if (node.closed && node.segments.length > 1) {
    append(node.segments[node.segments.length - 1], node.segments[0]);
    d += " Z";
  }
  return d;
}
