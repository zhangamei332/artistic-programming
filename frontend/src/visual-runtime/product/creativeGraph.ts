import {
  createCurveRoutingPatch,
  creativePipelineTemplates,
  resolveCreativeFacadeWrites,
  type CreativeParameterFacade,
  type CreativeSourceMode,
  type CurveRoute,
} from '../runtime/creativeFacade.js';

export interface CreativeGraphNode {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export interface CreativeGraphEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface CreativeGraph {
  nodes: CreativeGraphNode[];
  edges: CreativeGraphEdge[];
  facade: CreativeParameterFacade;
  sourceMode: CreativeSourceMode;
  revision: number;
}

export interface CreativeGraphReceipt {
  control: string;
  label: string;
  before: CreativeGraph;
  after: CreativeGraph;
  affectedNodeIds: string[];
}

const nodeId = {
  source: 'creative_source',
  distribution: 'creative_distribution',
  curve: 'creative_curve',
  motion: 'creative_motion',
  particleMotion: 'creative_particle_motion',
  material: 'creative_material',
  lighting: 'creative_lighting',
  renderer: 'creative_renderer',
  preview: 'creative_preview',
};

function edge(sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort: string): CreativeGraphEdge {
  return {
    id: `${sourceNodeId}:${sourcePort}->${targetNodeId}:${targetPort}`,
    sourceNodeId,
    sourcePort,
    targetNodeId,
    targetPort,
  };
}

function cloneGraph(graph: CreativeGraph): CreativeGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, params: { ...node.params } })),
    edges: graph.edges.map((item) => ({ ...item })),
    facade: { ...graph.facade },
  };
}

function buildFacade(mode: CreativeSourceMode): CreativeParameterFacade {
  return {
    sourceMode: mode,
    sourceNodeId: nodeId.source,
    distributionNodeId: nodeId.distribution,
    motionCurveNodeId: nodeId.curve,
    motionNodeId: mode === 'particles' ? undefined : nodeId.motion,
    particleMotionNodeId: mode === 'particles' ? nodeId.particleMotion : undefined,
    materialNodeId: nodeId.material,
    lightingNodeId: nodeId.lighting,
    rendererNodeId: nodeId.renderer,
    previewNodeId: nodeId.preview,
  };
}

export function createCreativeGraph(params: Record<string, unknown> = {}): CreativeGraph {
  const mode = (params.sourceMode as CreativeSourceMode) || 'instances';
  const facade = buildFacade(mode);
  const distributionVariant = mode === 'singleObject' ? 'single' : String(params.layoutMode || params.layout || creativePipelineTemplates[mode].defaultLayout);
  const nodes: CreativeGraphNode[] = [
    { id: nodeId.source, type: mode === 'particles' ? 'source.particles' : 'source.primitive', params: { count: params.count ?? 9, size: params.size ?? 1, primitiveType: params.primitiveType ?? 'box' } },
    { id: nodeId.distribution, type: 'distribution.multi', params: { variant: distributionVariant, count: mode === 'singleObject' ? 1 : params.count ?? 9, transitionDuration: params.layoutTransition ?? 0.6 } },
    { id: nodeId.curve, type: 'motionCurve.multi', params: {
      variant: params.motionCurve ?? params.motionType ?? 'sine',
      frequency: params.curveFrequency ?? params.speed ?? 1,
      amplitude: params.curveAmplitude ?? params.amplitude ?? 1,
      offset: params.curveOffset ?? 0,
      phase: params.curvePhase ?? 0,
      bipolar: params.bipolar ?? true,
      dutyCycle: params.curveDutyCycle ?? 0.35,
      pulseCount: params.curvePulseCount ?? 9,
      noiseSmoothness: params.curveNoiseSmoothness ?? 1,
      springDecay: params.curveSpringDecay ?? 4.5,
      springOscillations: params.curveSpringOscillations ?? 3.5,
      springLoop: params.curveSpringLoop ?? false,
      constantValue: params.curveConstantValue ?? 1,
      seed: params.seed ?? 7,
    } },
    { id: nodeId.material, type: 'material.standard', params: { color: params.bodyColor ?? params.color ?? '#4A8DF6', opacity: params.opacity ?? 1, textureAssetId: params.materialTexture ?? null } },
    { id: nodeId.lighting, type: 'lighting.ambient', params: { ambientColor: params.ambientColor ?? '#ffffff', ambientIntensity: params.ambientIntensity ?? 0.5 } },
    { id: nodeId.renderer, type: creativePipelineTemplates[mode].rendererType, params: { renderMode: mode === 'particles' ? 'points' : mode === 'singleObject' ? 'mesh' : 'instanced' } },
    { id: nodeId.preview, type: 'system.previewOutput', params: {} },
  ];
  if (mode === 'particles') {
    nodes.push({ id: nodeId.particleMotion, type: 'particleMotion.multi', params: { variant: params.particleMotion ?? params.mode ?? 'curlNoise', speed: params.particleSpeed ?? params.speed ?? 1, strength: params.particleStrength ?? 1, curveTarget: params.particleCurveTarget ?? 'both', curveInfluence: params.curveInfluence ?? 1 } });
  } else {
    nodes.push({ id: nodeId.motion, type: 'motion.multi', params: { variant: params.motion ?? params.motionType ?? 'rotate', speed: params.motionSpeed ?? params.speed ?? 1, curveUsage: params.curveUsage ?? 'shape', curveInfluence: params.curveInfluence ?? 1 } });
  }
  const activeMotionId = mode === 'particles' ? nodeId.particleMotion : nodeId.motion;
  const activeMotionPort = mode === 'particles' ? 'particles' : 'transforms';
  const edges = [
    edge(nodeId.source, 'source', nodeId.distribution, 'source'),
    edge(nodeId.distribution, 'transforms', activeMotionId, activeMotionPort),
    edge(activeMotionId, mode === 'particles' ? 'particles' : 'transforms', nodeId.renderer, mode === 'particles' ? 'particles' : 'transforms'),
    edge(nodeId.material, 'material', nodeId.renderer, 'material'),
    edge(nodeId.lighting, 'lighting', nodeId.renderer, 'lighting'),
    edge(nodeId.renderer, 'object', nodeId.preview, 'input'),
    edge(nodeId.curve, 'signal', activeMotionId, 'curve'),
  ];
  return { nodes, edges, facade, sourceMode: mode, revision: 0 };
}

function replaceSourceMode(graph: CreativeGraph, mode: CreativeSourceMode): CreativeGraph {
  const next = createCreativeGraph({ sourceMode: mode });
  const preserveTypes = new Set(['material.standard', 'lighting.ambient', 'motionCurve.multi']);
  next.nodes = next.nodes.map((node) => {
    const previous = graph.nodes.find((item) => item.type === node.type && preserveTypes.has(node.type));
    return previous ? { ...node, params: { ...previous.params } } : node;
  });
  const previousSource = graph.nodes.find((node) => node.id === nodeId.source);
  const nextSource = next.nodes.find((node) => node.id === nodeId.source);
  const previousDistribution = graph.nodes.find((node) => node.id === nodeId.distribution);
  const preservedCount = graph.sourceMode === 'particles'
    ? previousSource?.params.count
    : previousDistribution?.params.count;
  if (previousSource && nextSource) {
    nextSource.params.count = preservedCount;
    nextSource.params.size = previousSource.params.size;
  }
  const nextDistribution = next.nodes.find((node) => node.id === nodeId.distribution);
  if (previousDistribution && nextDistribution) {
    nextDistribution.params.count = mode === 'singleObject' ? 1 : preservedCount;
    nextDistribution.params.transitionDuration = previousDistribution.params.transitionDuration;
    if (mode !== 'singleObject' && previousDistribution.params.variant !== 'single') {
      nextDistribution.params.variant = previousDistribution.params.variant;
    }
  }
  return { ...next, revision: graph.revision + 1 };
}

export function applyCreativeControl(
  graph: CreativeGraph,
  control: string,
  value: unknown,
): CreativeGraphReceipt {
  const before = cloneGraph(graph);
  let after = cloneGraph(graph);
  const affectedNodeIds = new Set<string>();

  if (control === 'sourceMode') {
    after = replaceSourceMode(graph, value as CreativeSourceMode);
    after.nodes.forEach((node) => affectedNodeIds.add(node.id));
  } else if (control === 'curveRoute') {
    for (const patch of createCurveRoutingPatch(after.facade, value as CurveRoute)) {
      const id = `${patch.sourceNodeId}:${patch.sourcePort}->${patch.targetNodeId}:${patch.targetPort}`;
      if (patch.op === 'connect' && !after.edges.some((item) => item.id === id)) {
        after.edges.push({ id, ...patch });
      }
      if (patch.op === 'disconnect') {
        after.edges = after.edges.filter((item) => item.id !== id);
      }
      affectedNodeIds.add(patch.targetNodeId);
    }
  } else {
    for (const write of resolveCreativeFacadeWrites(after.facade, control, value)) {
      const node = after.nodes.find((item) => item.id === write.nodeId);
      if (!node) continue;
      node.params[write.param] = write.value;
      affectedNodeIds.add(node.id);
    }
  }

  after.revision += 1;
  return { control, label: `修改 ${control}`, before, after, affectedNodeIds: [...affectedNodeIds] };
}

export function readCreativeControl(graph: CreativeGraph, control: string): unknown {
  if (control === 'sourceMode') return graph.sourceMode;
  if (control === 'curveRoute') {
    const base = graph.edges.some((item) => item.sourceNodeId === nodeId.curve && item.targetNodeId === nodeId.motion);
    const particle = graph.edges.some((item) => item.sourceNodeId === nodeId.curve && item.targetNodeId === nodeId.particleMotion);
    return base && particle ? 'both' : particle ? 'particleMotion' : 'baseMotion';
  }
  const writes = resolveCreativeFacadeWrites(graph.facade, control, undefined);
  const write = writes[0];
  return graph.nodes.find((node) => node.id === write.nodeId)?.params[write.param];
}
