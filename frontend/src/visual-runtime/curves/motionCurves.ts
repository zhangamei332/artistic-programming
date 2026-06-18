import type { FrameContext, ParamMap, ScalarSignal } from "../core/types.js";
import { booleanParam, numberParam, stringParam } from "../core/params.js";
import { hashFloat01 } from "../core/random.js";

export type MotionCurveVariant =
  | "sine"
  | "pulse"
  | "saw"
  | "ramp"
  | "triangle"
  | "noise"
  | "spring"
  | "collPulse"
  | "constant";

export interface MotionCurveParams {
  variant: MotionCurveVariant;

  /** Common timing and value mapping. */
  frequency: number;
  amplitude: number;
  offset: number;
  phase: number;
  bipolar: boolean;

  /** Pulse and dense-pulse controls. */
  dutyCycle: number;
  pulseCount: number;

  /** Constant curve control. */
  constantValue: number;

  /** Noise controls. */
  seed: number;
  noiseSmoothness: number;

  /** Damped spring controls. */
  springDecay: number;
  springOscillations: number;
  springLoop: boolean;
}

export const motionCurveLabels: Record<MotionCurveVariant, string> = {
  sine: "Sine 正弦波",
  pulse: "Pulse 脉冲波",
  saw: "Saw 锯齿波",
  ramp: "Ramp 斜坡",
  triangle: "Triangle 三角波",
  noise: "Noise 噪波",
  spring: "Spring 弹簧衰减振荡",
  collPulse: "Coll Pulse 密集脉冲",
  constant: "Constant 恒定值",
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function valueNoise1D(x: number, seed: number, smoothness: number): number {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const local = fract(x);
  const smooth = Math.max(0.0001, smoothness);
  const shaped = smoothstep01(Math.pow(local, 1 / smooth));
  const a = hashFloat01(seed, i0, 0, 0x51f15e);
  const b = hashFloat01(seed, i1, 0, 0x51f15e);
  return a + (b - a) * shaped;
}

function springNormalized(phase01: number, params: MotionCurveParams): number {
  const t = params.springLoop ? fract(Math.max(0, phase01)) : Math.max(0, phase01);
  const envelope = Math.exp(-Math.max(0, params.springDecay) * t);
  const oscillation = Math.cos(Math.PI * 2 * Math.max(0.01, params.springOscillations) * t);

  // The center value 0.5 becomes zero after bipolar mapping, so the spring
  // naturally decays toward rest instead of remaining visually offset.
  return clamp01(0.5 + 0.5 * envelope * oscillation);
}

function densePulseNormalized(phase01: number, params: MotionCurveParams): number {
  const count = Math.max(1, Math.floor(params.pulseCount));
  const localPulsePhase = fract(fract(phase01) * count);
  return localPulsePhase < clamp01(params.dutyCycle) ? 1 : 0;
}

export function readMotionCurveParams(params: ParamMap): MotionCurveParams {
  return {
    variant: stringParam(params, "variant", "sine") as MotionCurveVariant,
    frequency: numberParam(params, "frequency", 1),
    amplitude: numberParam(params, "amplitude", 1),
    offset: numberParam(params, "offset", 0),
    phase: numberParam(params, "phase", 0),
    bipolar: booleanParam(params, "bipolar", true),

    dutyCycle: clamp01(numberParam(params, "dutyCycle", 0.5)),
    pulseCount: Math.max(1, Math.floor(numberParam(params, "pulseCount", 8))),

    constantValue: clamp01(numberParam(params, "constantValue", 1)),

    seed: Math.floor(numberParam(params, "seed", 1)),
    noiseSmoothness: Math.max(0.05, numberParam(params, "noiseSmoothness", 1)),

    springDecay: Math.max(0, numberParam(params, "springDecay", 4.5)),
    springOscillations: Math.max(0.01, numberParam(params, "springOscillations", 3.5)),
    springLoop: booleanParam(params, "springLoop", false),
  };
}

/**
 * Returns a normalized value in [0, 1].
 *
 * - Saw rises and drops.
 * - Ramp falls and jumps.
 * - Spring uses a damped oscillation.
 * - Coll Pulse emits multiple narrow pulses per base cycle.
 */
export function evaluateMotionCurveNormalized(
  variant: MotionCurveVariant,
  phase01: number,
  params: MotionCurveParams,
): number {
  if (variant === "spring") return springNormalized(phase01, params);
  if (variant === "collPulse") return densePulseNormalized(phase01, params);

  const p = fract(phase01);
  switch (variant) {
    case "sine":
      return 0.5 + 0.5 * Math.sin(p * Math.PI * 2);
    case "pulse":
      return p < params.dutyCycle ? 1 : 0;
    case "saw":
      return p;
    case "ramp":
      return 1 - p;
    case "triangle":
      return 1 - Math.abs(p * 2 - 1);
    case "noise":
      return valueNoise1D(phase01, params.seed, params.noiseSmoothness);
    case "constant":
      return params.constantValue;
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
}

export function evaluateMotionCurve(
  params: MotionCurveParams,
  time: number,
  instancePhase = 0,
): ScalarSignal {
  const phase = time * params.frequency + params.phase + instancePhase;
  const normalized = clamp01(evaluateMotionCurveNormalized(params.variant, phase, params));
  const shaped = params.bipolar ? normalized * 2 - 1 : normalized;

  return {
    value: params.offset + shaped * params.amplitude,
    normalized,
    time,
  };
}

export function evaluateCurveFromParamMap(
  params: ParamMap,
  context: FrameContext,
  instancePhase = 0,
): ScalarSignal {
  return evaluateMotionCurve(readMotionCurveParams(params), context.time, instancePhase);
}
