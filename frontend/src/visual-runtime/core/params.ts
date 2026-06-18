import type { ParamMap, Vec3 } from "./types.js";

export function numberParam(params: ParamMap, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function integerParam(params: ParamMap, key: string, fallback: number): number {
  return Math.max(0, Math.floor(numberParam(params, key, fallback)));
}

export function stringParam(params: ParamMap, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

export function booleanParam(params: ParamMap, key: string, fallback: boolean): boolean {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}

export function vec3Param(params: ParamMap, key: string, fallback: Vec3): Vec3 {
  const value = params[key];
  if (Array.isArray(value) && value.length >= 3) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  return fallback;
}
