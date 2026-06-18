export type CreativeSourceMode = "singleObject" | "instances" | "particles";
export type CurveRoute = "baseMotion" | "particleMotion" | "both";

export interface CreativeParameterFacade {
  previewNodeId?: string;
  sourceMode: CreativeSourceMode;

  sourceNodeId: string;
  distributionNodeId: string;

  motionCurveNodeId: string;
  motionNodeId?: string;
  particleMotionNodeId?: string;

  materialNodeId: string;
  lightingNodeId: string;
  rendererNodeId: string;
}

export interface FacadeWrite {
  nodeId: string;
  param: string;
  value: unknown;
}

export interface FacadeEdgePatch {
  op: "connect" | "disconnect";
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface CreativePipelineTemplate {
  mode: CreativeSourceMode;
  description: string;
  chain: string[];
  defaultLayout: string;
  rendererType: string;
}

export const creativePipelineTemplates: Record<CreativeSourceMode, CreativePipelineTemplate> = {
  singleObject: {
    mode: "singleObject",
    description: "单个简单对象：一元素 TransformBuffer，支持运动曲线驱动旋转、跳动和位移。",
    chain: [
      "source.primitive",
      "distribution.multi(single,count=1)",
      "motion.multi",
      "renderer.mesh",
      "system.previewOutput",
    ],
    defaultLayout: "single",
    rendererType: "renderer.mesh",
  },

  instances: {
    mode: "instances",
    description: "对象阵列：布局分布、基础运动、InstancedMesh 渲染。",
    chain: [
      "source.primitive",
      "distribution.multi",
      "motion.multi",
      "renderer.instances",
      "system.previewOutput",
    ],
    defaultLayout: "boxMatrix",
    rendererType: "renderer.instances",
  },

  particles: {
    mode: "particles",
    description: "粒子系统：布局种子、粒子运动、Points/Instanced 粒子渲染。",
    chain: [
      "source.particles",
      "distribution.multi",
      "particleMotion.multi",
      "renderer.particles",
      "system.previewOutput",
    ],
    defaultLayout: "sphereSurface",
    rendererType: "renderer.particles",
  },
};

export function resolveCreativeFacadeWrites(
  facade: CreativeParameterFacade,
  control: string,
  value: unknown,
): FacadeWrite[] {
  switch (control) {
    case "count":
      return facade.sourceMode === "particles"
        ? [{ nodeId: facade.sourceNodeId, param: "count", value }]
        : [{ nodeId: facade.distributionNodeId, param: "count", value }];

    case "size":
      return [{ nodeId: facade.sourceNodeId, param: "size", value }];

    case "layout":
      return [{ nodeId: facade.distributionNodeId, param: "variant", value }];

    case "layoutTransition":
      return [{ nodeId: facade.distributionNodeId, param: "transitionDuration", value }];

    case "motion": {
      if (!facade.motionNodeId) throw new Error("Facade has no base motion node");
      return [{ nodeId: facade.motionNodeId, param: "variant", value }];
    }

    case "motionSpeed": {
      if (!facade.motionNodeId) throw new Error("Facade has no base motion node");
      return [{ nodeId: facade.motionNodeId, param: "speed", value }];
    }

    case "motionCurve":
      return [{ nodeId: facade.motionCurveNodeId, param: "variant", value }];

    case "curveFrequency":
      return [{ nodeId: facade.motionCurveNodeId, param: "frequency", value }];

    case "curveAmplitude":
      return [{ nodeId: facade.motionCurveNodeId, param: "amplitude", value }];

    case "curveOffset":
      return [{ nodeId: facade.motionCurveNodeId, param: "offset", value }];

    case "curvePhase":
      return [{ nodeId: facade.motionCurveNodeId, param: "phase", value }];

    case "curveDutyCycle":
      return [{ nodeId: facade.motionCurveNodeId, param: "dutyCycle", value }];

    case "curvePulseCount":
      return [{ nodeId: facade.motionCurveNodeId, param: "pulseCount", value }];

    case "curveSpringDecay":
      return [{ nodeId: facade.motionCurveNodeId, param: "springDecay", value }];

    case "curveSpringOscillations":
      return [{ nodeId: facade.motionCurveNodeId, param: "springOscillations", value }];

    case "curveSpringLoop":
      return [{ nodeId: facade.motionCurveNodeId, param: "springLoop", value }];

    case "curveConstantValue":
      return [{ nodeId: facade.motionCurveNodeId, param: "constantValue", value }];

    case "curveNoiseSmoothness":
      return [{ nodeId: facade.motionCurveNodeId, param: "noiseSmoothness", value }];

    case "particleMotion": {
      if (!facade.particleMotionNodeId) throw new Error("Facade has no particle motion node");
      return [{ nodeId: facade.particleMotionNodeId, param: "variant", value }];
    }

    case "color":
      return [{ nodeId: facade.materialNodeId, param: "color", value }];

    case "opacity":
      return [{ nodeId: facade.materialNodeId, param: "opacity", value }];

    case "texture":
      return [{ nodeId: facade.materialNodeId, param: "textureAssetId", value }];

    case "ambientColor":
      return [{ nodeId: facade.lightingNodeId, param: "ambientColor", value }];

    case "ambientIntensity":
      return [{ nodeId: facade.lightingNodeId, param: "ambientIntensity", value }];

    default:
      throw new Error(`Unknown creative facade control: ${control}`);
  }
}

/**
 * The Preview Facade changes real graph edges instead of storing a fake
 * "curveRoute" string that the runtime cannot execute.
 */
export function createCurveRoutingPatch(
  facade: CreativeParameterFacade,
  nextRoute: CurveRoute,
): FacadeEdgePatch[] {
  const patches: FacadeEdgePatch[] = [];
  const curveSource = {
    sourceNodeId: facade.motionCurveNodeId,
    sourcePort: "signal",
  };

  if (facade.motionNodeId) {
    patches.push({
      op: nextRoute === "baseMotion" || nextRoute === "both" ? "connect" : "disconnect",
      ...curveSource,
      targetNodeId: facade.motionNodeId,
      targetPort: "curve",
    });
  }

  if (facade.particleMotionNodeId) {
    patches.push({
      op: nextRoute === "particleMotion" || nextRoute === "both" ? "connect" : "disconnect",
      ...curveSource,
      targetNodeId: facade.particleMotionNodeId,
      targetPort: "curve",
    });
  }

  return patches;
}
