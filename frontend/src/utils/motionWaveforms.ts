import {
  createMotionCurveSvgPath,
  motionCurveMenuPresets,
} from '../visual-runtime/curves/svgWaveform';

export interface MotionWaveformDefinition {
  id: string;
  label: string;
  path: string;
  params: Record<string, unknown>;
}

export const MOTION_WAVEFORMS: MotionWaveformDefinition[] = motionCurveMenuPresets.map((preset) => ({
  id: preset.id,
  label: preset.label,
  path: createMotionCurveSvgPath(preset.params, {
    width: 110,
    height: 48,
    padding: 2,
    samples: 120,
    cycles: preset.id === 'spring' ? 1.1 : 1.25,
  }),
  params: {
    motionType: preset.id,
    waveform: preset.id,
    ...preset.params,
  },
}));

export function getMotionWaveform(params?: Record<string, unknown>, nodeType?: string): MotionWaveformDefinition | null {
  const requested = String(params?.motionType || params?.waveform || params?.mode || '').toLowerCase();
  const aliases: Record<string, string> = {
    wave: 'sine',
    sinewave: 'sine',
    square: 'pulse',
    random: 'noise',
    noisemotion: 'noise',
    bounce: 'spring',
  };
  const id = aliases[requested] || requested || (nodeType === 'NoiseSignal' ? 'noise' : '');
  return MOTION_WAVEFORMS.find((waveform) => waveform.id.toLowerCase() === id) || null;
}
