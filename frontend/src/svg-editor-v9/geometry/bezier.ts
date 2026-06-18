import type { PathSegment, Vec2 } from "../model/types.js";

export function cubicBezierPoint(
  p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number,
): Vec2 {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

export function segmentControlPoints(
  current: PathSegment,
  next: PathSegment,
): [Vec2, Vec2, Vec2, Vec2] {
  return [
    current.point,
    {
      x: current.point.x + current.handleOut.x,
      y: current.point.y + current.handleOut.y,
    },
    {
      x: next.point.x + next.handleIn.x,
      y: next.point.y + next.handleIn.y,
    },
    next.point,
  ];
}

export function reflectHandle(handle: Vec2): Vec2 {
  return { x: -handle.x, y: -handle.y };
}
