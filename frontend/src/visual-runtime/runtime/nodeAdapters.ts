import type {
  FrameContext,
  ParamMap,
  ParticleStateBuffer,
  RuntimeAdapter,
  ScalarSignal,
  TransformBuffer,
} from "../core/types.js";
import { integerParam, stringParam } from "../core/params.js";
import { generateLayout, type LayoutVariant } from "../layouts/layouts.js";
import { applyTransformMotion, type TransformMotionVariant } from "../motions/transformMotions.js";
import {
  createParticleState,
  stepParticleMotion,
  type ParticleMotionVariant,
} from "../motions/particleMotions.js";
import { evaluateCurveFromParamMap } from "../curves/motionCurves.js";

export class DistributionNodeAdapter implements RuntimeAdapter {
  public cook(inputs: Record<string, unknown>, params: ParamMap): TransformBuffer {
    const source = inputs.source as { count?: number } | undefined;
    const count = integerParam(params, "count", source?.count ?? 100);
    const variant = stringParam(params, "variant", "boxMatrix") as LayoutVariant;
    return generateLayout(variant, count, params);
  }
}

export class MotionCurveNodeAdapter implements RuntimeAdapter {
  public cook(_inputs: Record<string, unknown>, params: ParamMap, context: FrameContext): ScalarSignal {
    return evaluateCurveFromParamMap(params, context);
  }
}

export class MotionNodeAdapter implements RuntimeAdapter {
  public cook(inputs: Record<string, unknown>, params: ParamMap, context: FrameContext): TransformBuffer {
    const transforms = inputs.transforms as TransformBuffer | undefined;
    if (!transforms) throw new Error("Motion node requires TransformBuffer input");
    const variant = stringParam(params, "variant", "rotate") as TransformMotionVariant;
    const curve = isScalarSignal(inputs.curve) ? inputs.curve : undefined;
    return applyTransformMotion(variant, transforms, params, context, curve);
  }
}

export class ParticleMotionNodeAdapter implements RuntimeAdapter {
  private state?: ParticleStateBuffer;

  public cook(inputs: Record<string, unknown>, params: ParamMap, context: FrameContext): ParticleStateBuffer {
    const incoming = inputs.particles;
    if (isTransformBuffer(incoming)) {
      if (!this.state || this.state.count !== incoming.count) this.state = createParticleState(incoming);
    } else if (isParticleStateBuffer(incoming)) {
      this.state = incoming;
    }
    if (!this.state) throw new Error("Particle motion requires TransformBuffer or ParticleStateBuffer input");
    const variant = stringParam(params, "variant", "wave") as ParticleMotionVariant;
    const curve = isScalarSignal(inputs.curve) ? inputs.curve : undefined;
    return stepParticleMotion(variant, this.state, params, context, curve);
  }
}

function isTransformBuffer(value: unknown): value is TransformBuffer {
  return Boolean(value && typeof value === "object" && "positions" in value && "rotations" in value && "scales" in value);
}

function isParticleStateBuffer(value: unknown): value is ParticleStateBuffer {
  return Boolean(value && typeof value === "object" && "positions" in value && "velocities" in value && "accelerations" in value);
}

function isScalarSignal(value: unknown): value is ScalarSignal {
  return Boolean(value && typeof value === "object" && "value" in value && "normalized" in value);
}
