import type { FrameContext, ParamMap, ScalarSignal, TransformBuffer, Vec3 } from "../core/types.js";
import {
  cloneTransformBuffer,
  mod,
  normalizeVec3,
  quaternionFromAxisAngle,
  quaternionMultiply,
  readQuaternion,
  setQuaternion,
} from "../core/math.js";
import { booleanParam, numberParam, stringParam, vec3Param } from "../core/params.js";

export type TransformMotionVariant = "rotate" | "bounce" | "translate";

type CurveUsage = "shape" | "speedMultiplier";

function signalValue(signal: ScalarSignal | undefined, fallback: number): number {
  return signal && Number.isFinite(signal.value) ? signal.value : fallback;
}

export function applyTransformMotion(
  variant: TransformMotionVariant,
  base: TransformBuffer,
  params: ParamMap,
  context: FrameContext,
  curve?: ScalarSignal,
): TransformBuffer {
  const output = cloneTransformBuffer(base);
  const speed = numberParam(params, "speed", 1);
  const phaseOffset = numberParam(params, "phaseOffset", 0);
  const curveInfluence = Math.min(1, Math.max(0, numberParam(params, "curveInfluence", 1)));
  const curveUsage = stringParam(params, "curveUsage", "shape") as CurveUsage;
  const curveValue = signalValue(curve, 1);
  const mixedCurve = 1 + (curveValue - 1) * curveInfluence;

  if (variant === "rotate") {
    const axis = normalizeVec3(vec3Param(params, "axisVector", axisFromName(stringParam(params, "axis", "y"))));
    const angleRange = numberParam(params, "angleRange", Math.PI * 2);
    for (let i = 0; i < output.count; i += 1) {
      const angle = curve
        ? curveUsage === "shape"
          ? curveValue * angleRange + phaseOffset * i
          : context.time * speed * mixedCurve + phaseOffset * i
        : context.time * speed + phaseOffset * i;
      const rotation = quaternionMultiply(readQuaternion(base, i), quaternionFromAxisAngle(axis, angle));
      setQuaternion(output, i, rotation);
    }
    return output;
  }

  if (variant === "bounce") {
    const axis = normalizeVec3(vec3Param(params, "axisVector", axisFromName(stringParam(params, "axis", "y"))));
    const amplitude = numberParam(params, "amplitude", 1);
    const frequency = numberParam(params, "frequency", 1);
    const offset = numberParam(params, "offset", 0);
    for (let i = 0; i < output.count; i += 1) {
      const defaultWave = Math.sin(context.time * frequency * Math.PI * 2 + phaseOffset * i);
      const wave = curve
        ? curveUsage === "shape"
          ? curveValue
          : defaultWave * mixedCurve
        : defaultWave;
      const displacement = wave * amplitude + offset;
      const p = i * 3;
      output.positions[p] = (base.positions[p] ?? 0) + axis[0] * displacement;
      output.positions[p + 1] = (base.positions[p + 1] ?? 0) + axis[1] * displacement;
      output.positions[p + 2] = (base.positions[p + 2] ?? 0) + axis[2] * displacement;
    }
    return output;
  }

  const direction = normalizeVec3(vec3Param(params, "direction", [1, 0, 0]));
  const distance = numberParam(params, "distance", 10);
  const loop = booleanParam(params, "loop", true);
  const pingPong = booleanParam(params, "pingPong", false);
  for (let i = 0; i < output.count; i += 1) {
    let progress = curve && curveUsage === "shape"
      ? curve.normalized
      : context.time * speed * (curve ? mixedCurve : 1) + phaseOffset * i;
    if (!curve || curveUsage !== "shape") {
      if (loop) progress = mod(progress, 1);
      if (pingPong) progress = 1 - Math.abs(mod(progress, 2) - 1);
    }
    const displacement = progress * distance;
    const p = i * 3;
    output.positions[p] = (base.positions[p] ?? 0) + direction[0] * displacement;
    output.positions[p + 1] = (base.positions[p + 1] ?? 0) + direction[1] * displacement;
    output.positions[p + 2] = (base.positions[p + 2] ?? 0) + direction[2] * displacement;
  }
  return output;
}

function axisFromName(axis: string): Vec3 {
  if (axis === "x") return [1, 0, 0];
  if (axis === "z") return [0, 0, 1];
  return [0, 1, 0];
}
