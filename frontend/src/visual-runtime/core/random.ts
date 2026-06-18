import type { Vec3 } from "./types.js";
import { normalizeVec3 } from "./math.js";

export function hashUint(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function hashFloat01(seed: number, index = 0, frame = 0, salt = 0): number {
  const mixed = hashUint(seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(frame + 1, 0x85ebca6b) ^ salt);
  return mixed / 0xffffffff;
}

export function randomSigned(seed: number, index = 0, frame = 0, salt = 0): number {
  return hashFloat01(seed, index, frame, salt) * 2 - 1;
}

export function randomUnitVector3(seed: number, index = 0, frame = 0): Vec3 {
  return normalizeVec3([
    randomSigned(seed, index, frame, 0x11111111),
    randomSigned(seed, index, frame, 0x22222222),
    randomSigned(seed, index, frame, 0x33333333),
  ]);
}
