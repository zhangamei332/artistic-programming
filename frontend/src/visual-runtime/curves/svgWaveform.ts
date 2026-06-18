import {
  evaluateMotionCurveNormalized,
  motionCurveLabels,
  type MotionCurveParams,
  type MotionCurveVariant,
} from "./motionCurves.js";

export interface SvgWaveformOptions {
  width?: number;
  height?: number;
  padding?: number;
  samples?: number;
  cycles?: number;
}

export function createMotionCurveSvgPath(
  params: MotionCurveParams,
  options: SvgWaveformOptions = {},
): string {
  const width = options.width ?? 180;
  const height = options.height ?? 56;
  const padding = options.padding ?? 5;
  const samples = Math.max(24, options.samples ?? 160);
  const cycles = Math.max(0.1, options.cycles ?? 1.25);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  let path = "";
  for (let index = 0; index <= samples; index += 1) {
    const x01 = index / samples;
    const phase = x01 * cycles + params.phase;
    const value = evaluateMotionCurveNormalized(params.variant, phase, params);
    const x = padding + x01 * innerWidth;
    const y = padding + (1 - value) * innerHeight;
    path += `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
  }
  return path.trim();
}

export interface MotionCurveMenuPreset {
  id: MotionCurveVariant;
  label: string;
  params: MotionCurveParams;
}

const common = {
  frequency: 1,
  amplitude: 1,
  offset: 0,
  phase: 0,
  bipolar: true,

  dutyCycle: 0.35,
  pulseCount: 9,

  constantValue: 0.65,

  seed: 7,
  noiseSmoothness: 1,

  springDecay: 4.5,
  springOscillations: 3.5,
  springLoop: false,
} as const;

const variants: MotionCurveVariant[] = [
  "sine",
  "pulse",
  "saw",
  "ramp",
  "triangle",
  "noise",
  "spring",
  "collPulse",
  "constant",
];

export const motionCurveMenuPresets: MotionCurveMenuPreset[] = variants.map((variant) => ({
  id: variant,
  label: motionCurveLabels[variant],
  params: {
    ...common,
    variant,

    // Pulse-like and Constant variants are usually easier to read as unipolar
    // signals in the UI. Users may enable bipolar manually.
    bipolar:
      variant === "pulse" ||
      variant === "collPulse" ||
      variant === "constant"
        ? false
        : true,

    dutyCycle: variant === "collPulse" ? 0.22 : common.dutyCycle,
    pulseCount: variant === "collPulse" ? 9 : common.pulseCount,
  },
}));
