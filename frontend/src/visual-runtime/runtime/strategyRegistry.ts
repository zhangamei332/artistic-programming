import type { FrameContext, ParamMap, ParticleStateBuffer, TransformBuffer } from "../core/types.js";
import { generateLayout, type LayoutVariant } from "../layouts/layouts.js";
import { applyTransformMotion, type TransformMotionVariant } from "../motions/transformMotions.js";
import { stepParticleMotion, type ParticleMotionVariant } from "../motions/particleMotions.js";

export class BuiltinStrategyRegistry {
  public generateLayout(variant: LayoutVariant, count: number, params: ParamMap): TransformBuffer {
    return generateLayout(variant, count, params);
  }

  public applyMotion(
    variant: TransformMotionVariant,
    base: TransformBuffer,
    params: ParamMap,
    context: FrameContext,
  ): TransformBuffer {
    return applyTransformMotion(variant, base, params, context);
  }

  public stepParticleMotion(
    variant: ParticleMotionVariant,
    state: ParticleStateBuffer,
    params: ParamMap,
    context: FrameContext,
  ): ParticleStateBuffer {
    return stepParticleMotion(variant, state, params, context);
  }
}
