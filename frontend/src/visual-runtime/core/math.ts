import type { Quat, TransformBuffer, Vec3 } from "./types.js";

export const EPSILON = 1e-8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function vecLength(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

export function normalizeVec3(v: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const length = vecLength(v[0], v[1], v[2]);
  if (length < EPSILON) return fallback;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function quaternionIdentity(): Quat {
  return [0, 0, 0, 1];
}

export function quaternionFromAxisAngle(axisInput: Vec3, angle: number): Quat {
  const axis = normalizeVec3(axisInput);
  const half = angle * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

export function quaternionMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quaternionFromTo(fromInput: Vec3, toInput: Vec3): Quat {
  const from = normalizeVec3(fromInput);
  const to = normalizeVec3(toInput);
  const d = clamp(dot(from, to), -1, 1);
  if (d > 1 - 1e-6) return quaternionIdentity();
  if (d < -1 + 1e-6) {
    const orthogonal = Math.abs(from[0]) < 0.8 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]);
    return quaternionFromAxisAngle(orthogonal, Math.PI);
  }
  const c = cross(from, to);
  const s = Math.sqrt((1 + d) * 2);
  const invS = 1 / s;
  return [c[0] * invS, c[1] * invS, c[2] * invS, s * 0.5];
}

export function createTransformBuffer(count: number): TransformBuffer {
  const safeCount = Math.max(0, Math.floor(count));
  const result: TransformBuffer = {
    count: safeCount,
    positions: new Float32Array(safeCount * 3),
    rotations: new Float32Array(safeCount * 4),
    scales: new Float32Array(safeCount * 3),
    ids: new Uint32Array(safeCount),
  };
  for (let i = 0; i < safeCount; i += 1) {
    const p = i * 3;
    const q = i * 4;
    result.scales[p] = 1;
    result.scales[p + 1] = 1;
    result.scales[p + 2] = 1;
    result.rotations[q + 3] = 1;
    result.ids[i] = i;
  }
  return result;
}

export function cloneTransformBuffer(source: TransformBuffer): TransformBuffer {
  return {
    count: source.count,
    positions: source.positions.slice(),
    rotations: source.rotations.slice(),
    scales: source.scales.slice(),
    ids: source.ids.slice(),
  };
}

export function setPosition(buffer: TransformBuffer, index: number, value: Vec3): void {
  const offset = index * 3;
  buffer.positions[offset] = value[0];
  buffer.positions[offset + 1] = value[1];
  buffer.positions[offset + 2] = value[2];
}

export function setScale(buffer: TransformBuffer, index: number, value: Vec3): void {
  const offset = index * 3;
  buffer.scales[offset] = value[0];
  buffer.scales[offset + 1] = value[1];
  buffer.scales[offset + 2] = value[2];
}

export function setQuaternion(buffer: TransformBuffer, index: number, value: Quat): void {
  const offset = index * 4;
  buffer.rotations[offset] = value[0];
  buffer.rotations[offset + 1] = value[1];
  buffer.rotations[offset + 2] = value[2];
  buffer.rotations[offset + 3] = value[3];
}

export function readQuaternion(buffer: TransformBuffer, index: number): Quat {
  const offset = index * 4;
  return [
    buffer.rotations[offset] ?? 0,
    buffer.rotations[offset + 1] ?? 0,
    buffer.rotations[offset + 2] ?? 0,
    buffer.rotations[offset + 3] ?? 1,
  ];
}

export function isFiniteArray(array: ArrayLike<number>): boolean {
  for (let i = 0; i < array.length; i += 1) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}
