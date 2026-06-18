export const templateNodeTypeAliases: Record<string, string> = {
  'source.image': 'file_texture',
  'source.svg': 'vector.svgEditor',
  'source.camera': 'camera_interaction',
  'source.microphone': 'audioRhythm',
  'analysis.image-features': 'CodeBlock',
  'analysis.svg-paths': 'SVGPathNode',
  'analysis.svg-regions': 'SVGRegionFill',
  'analysis.subject-segmentation': 'image.smartCutout',
  'analysis.motion': 'CodeBlock',
  'analysis.audio': 'audioRhythm',
  'analysis.face': 'faceRecognition',
  'analysis.hand': 'gesture',
  'generator.texture': 'texture',
  'generator.particles': 'particles',
  'generator.geometry': 'geometry',
  'generator.brush': 'CodeBlock',
  'modifier.copy': 'CompositeTexture',
  'modifier.feedback': 'FeedbackTexture',
  'modifier.path-growth': 'SVGPathGrowth',
  'modifier.path-deform': 'SVGPointSampler',
  'modifier.region-animation': 'SVGRegionFill',
  'modifier.pixel-style': 'P5SketchTextureNode',
  'logic.state-machine': 'Sequence',
  'controller.scene': 'controls',
  'compositor.layer': 'CompositeTexture',
  'renderer.canvas2d': 'renderer',
  'renderer.svg': 'vector.svgEditor',
  'renderer.threejs': 'renderer',
};

export function resolveTemplateNodeType(semanticType: string): string | null {
  return templateNodeTypeAliases[semanticType] ?? null;
}
