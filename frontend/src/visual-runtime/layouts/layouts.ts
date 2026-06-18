import type { ParamMap, TransformBuffer, Vec3 } from "../core/types.js";
import { createTransformBuffer, normalizeVec3, quaternionFromTo, setPosition, setQuaternion } from "../core/math.js";
import { booleanParam, integerParam, numberParam, stringParam } from "../core/params.js";
import { randomSigned } from "../core/random.js";

export type LayoutVariant =
  | "single"
  | "linear"
  | "grid"
  | "boxMatrix"
  | "sphereSurface"
  | "circle"
  | "concentricRings"
  | "star";

type FaceMode = "none" | "outward" | "inward";

function setFacing(buffer: TransformBuffer, index: number, direction: Vec3, mode: FaceMode): void {
  if (mode === "none") return;
  const normalized = normalizeVec3(direction);
  const target: Vec3 = mode === "inward" ? [-normalized[0], -normalized[1], -normalized[2]] : normalized;
  setQuaternion(buffer, index, quaternionFromTo([0, 0, 1], target));
}

function centeredCoordinate(index: number, count: number, spacing: number): number {
  return (index - (count - 1) * 0.5) * spacing;
}


function single(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(Math.max(1, count));
  const x = numberParam(params, "positionX", 0);
  const y = numberParam(params, "positionY", 0);
  const z = numberParam(params, "positionZ", 0);
  for (let i = 0; i < output.count; i += 1) {
    setPosition(output, i, [x, y, z]);
  }
  return output;
}

function linear(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const spacing = numberParam(params, "spacing", 1);
  const axis = stringParam(params, "axis", "x");
  for (let i = 0; i < count; i += 1) {
    const value = centeredCoordinate(i, count, spacing);
    setPosition(output, i, axis === "y" ? [0, value, 0] : axis === "z" ? [0, 0, value] : [value, 0, 0]);
  }
  return output;
}

function grid(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const columns = Math.max(1, integerParam(params, "columns", Math.ceil(Math.sqrt(count))));
  const rows = Math.max(1, integerParam(params, "rows", Math.ceil(count / columns)));
  const spacingX = numberParam(params, "spacingX", 1);
  const spacingY = numberParam(params, "spacingY", 1);
  const plane = stringParam(params, "plane", "xy");
  for (let i = 0; i < count; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const a = centeredCoordinate(column, columns, spacingX);
    const b = centeredCoordinate(row, rows, spacingY);
    setPosition(output, i, plane === "xz" ? [a, 0, b] : plane === "yz" ? [0, a, b] : [a, b, 0]);
  }
  return output;
}

function boxMatrix(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const columns = Math.max(1, integerParam(params, "columns", Math.ceil(Math.cbrt(count))));
  const rows = Math.max(1, integerParam(params, "rows", columns));
  const capacityPerLayer = columns * rows;
  const layers = Math.max(1, integerParam(params, "layers", Math.ceil(count / capacityPerLayer)));
  const spacingX = numberParam(params, "spacingX", 1);
  const spacingY = numberParam(params, "spacingY", 1);
  const spacingZ = numberParam(params, "spacingZ", 1);
  for (let i = 0; i < count; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns) % rows;
    const layer = Math.floor(i / capacityPerLayer);
    setPosition(output, i, [
      centeredCoordinate(column, columns, spacingX),
      centeredCoordinate(row, rows, spacingY),
      centeredCoordinate(layer, layers, spacingZ),
    ]);
  }
  return output;
}

function sphereSurface(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const radius = Math.max(0, numberParam(params, "radius", 8));
  const jitter = Math.max(0, numberParam(params, "jitter", 0));
  const seed = integerParam(params, "seed", 1);
  const faceMode = stringParam(params, "faceMode", "outward") as FaceMode;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const y = 1 - t * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const localRadius = radius + randomSigned(seed, i, 0) * jitter;
    const position: Vec3 = [
      Math.cos(theta) * ringRadius * localRadius,
      y * localRadius,
      Math.sin(theta) * ringRadius * localRadius,
    ];
    setPosition(output, i, position);
    setFacing(output, i, position, faceMode);
  }
  return output;
}

function circle(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const radius = numberParam(params, "radius", 8);
  const startAngle = numberParam(params, "startAngle", 0);
  const endAngle = numberParam(params, "endAngle", Math.PI * 2);
  const closed = booleanParam(params, "closed", true);
  const plane = stringParam(params, "plane", "xz");
  const faceMode = stringParam(params, "faceMode", "outward") as FaceMode;
  const divisor = closed ? Math.max(1, count) : Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    const angle = startAngle + (endAngle - startAngle) * (i / divisor);
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    const position: Vec3 = plane === "xy" ? [a, b, 0] : plane === "yz" ? [0, a, b] : [a, 0, b];
    setPosition(output, i, position);
    setFacing(output, i, position, faceMode);
  }
  return output;
}

function allocateRingCounts(count: number, ringCount: number): number[] {
  const weights = Array.from({ length: ringCount }, (_, i) => i + 1);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const result = weights.map((weight) => Math.max(1, Math.floor((count * weight) / total)));
  let assigned = result.reduce((sum, value) => sum + value, 0);
  let cursor = ringCount - 1;
  while (assigned < count) {
    result[cursor] = (result[cursor] ?? 0) + 1;
    assigned += 1;
    cursor = (cursor - 1 + ringCount) % ringCount;
  }
  cursor = ringCount - 1;
  while (assigned > count) {
    if ((result[cursor] ?? 0) > 1) {
      result[cursor] = (result[cursor] ?? 1) - 1;
      assigned -= 1;
    }
    cursor = (cursor - 1 + ringCount) % ringCount;
  }
  return result;
}

function concentricRings(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const ringCount = Math.max(1, integerParam(params, "ringCount", 5));
  const innerRadius = Math.max(0, numberParam(params, "innerRadius", 1));
  const ringSpacing = numberParam(params, "ringSpacing", 1.5);
  const radialOffset = numberParam(params, "radialOffset", 0);
  const faceMode = stringParam(params, "faceMode", "outward") as FaceMode;
  const counts = allocateRingCounts(count, ringCount);
  let index = 0;
  for (let ring = 0; ring < ringCount; ring += 1) {
    const ringItems = counts[ring] ?? 0;
    const radius = innerRadius + ring * ringSpacing;
    for (let j = 0; j < ringItems && index < count; j += 1, index += 1) {
      const angle = radialOffset * ring + (j / Math.max(1, ringItems)) * Math.PI * 2;
      const position: Vec3 = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
      setPosition(output, index, position);
      setFacing(output, index, position, faceMode);
    }
  }
  return output;
}

function star(count: number, params: ParamMap): TransformBuffer {
  const output = createTransformBuffer(count);
  const points = Math.max(3, integerParam(params, "starPoints", 5));
  const outerRadius = numberParam(params, "outerRadius", 8);
  const innerRadius = numberParam(params, "innerRadius", outerRadius * 0.45);
  const rotationOffset = numberParam(params, "rotationOffset", -Math.PI * 0.5);
  const faceMode = stringParam(params, "faceMode", "outward") as FaceMode;
  const vertices: Vec3[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotationOffset + (i / (points * 2)) * Math.PI * 2;
    vertices.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  }
  const lengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i] ?? [0, 0, 0];
    const b = vertices[(i + 1) % vertices.length] ?? a;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    lengths.push(length);
    totalLength += length;
  }
  for (let i = 0; i < count; i += 1) {
    let target = (i / Math.max(1, count)) * totalLength;
    let segment = 0;
    while (segment < lengths.length - 1 && target > (lengths[segment] ?? 0)) {
      target -= lengths[segment] ?? 0;
      segment += 1;
    }
    const a = vertices[segment] ?? [0, 0, 0];
    const b = vertices[(segment + 1) % vertices.length] ?? a;
    const segmentLength = Math.max(1e-8, lengths[segment] ?? 1);
    const t = target / segmentLength;
    const position: Vec3 = [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
    setPosition(output, i, position);
    setFacing(output, i, position, faceMode);
  }
  return output;
}

export function generateLayout(variant: LayoutVariant, count: number, params: ParamMap): TransformBuffer {
  const safeCount = Math.max(0, Math.floor(count));
  switch (variant) {
    case "single": return single(safeCount, params);
    case "linear": return linear(safeCount, params);
    case "grid": return grid(safeCount, params);
    case "boxMatrix": return boxMatrix(safeCount, params);
    case "sphereSurface": return sphereSurface(safeCount, params);
    case "circle": return circle(safeCount, params);
    case "concentricRings": return concentricRings(safeCount, params);
    case "star": return star(safeCount, params);
    default: {
      const unreachable: never = variant;
      throw new Error(`Unsupported layout variant: ${String(unreachable)}`);
    }
  }
}
