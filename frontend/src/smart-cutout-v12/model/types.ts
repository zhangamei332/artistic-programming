export type CutoutModel =
  | "u2netp"
  | "u2net"
  | "u2net_human_seg"
  | "u2net_cloth_seg"
  | "isnet-general-use"
  | "isnet-anime"
  | "silueta";

export type CutoutQualityPreset =
  | "fast"
  | "standard"
  | "portrait"
  | "clothing"
  | "highQuality"
  | "anime";

export type CutoutProcessOrder =
  | "cutoutThenTransform"
  | "transformThenCutout";

export type BackgroundMode =
  | "transparent"
  | "color"
  | "image";

export type BackgroundFit =
  | "cover"
  | "contain"
  | "stretch";

export type ExportScale =
  | 0.5
  | 1
  | 2
  | 4;

export interface NormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageTransform {
  translateX: number;
  translateY: number;
  zoom: number;
  rotationDeg: number;
  flipX: boolean;
  flipY: boolean;
}

export interface AlphaRefinement {
  threshold: number;
  featherRadius: number;
  erodeRadius: number;
  dilateRadius: number;
  removeSmallRegions: number;
  decontaminateEdges: number;
  invert: boolean;
}

export interface CutoutInferenceOptions {
  model: CutoutModel;
  qualityPreset: CutoutQualityPreset;
  processOrder: CutoutProcessOrder;
  autoRun: boolean;
  maxInferenceDimension: number;
  preferWebNN: boolean;
  preferWebGPU: boolean;
  modelBaseUrl: string;
  keepRawResult: boolean;
}

export interface CropOptions {
  enabled: boolean;
  rect: NormalizedCropRect;
  aspectRatio: number | null;
  padding: number;
  fitSubject: boolean;
}

export interface BackgroundOptions {
  mode: BackgroundMode;
  color: string;
  imageAssetId: string | null;
  fit: BackgroundFit;
  blur: number;
  brightness: number;
  subjectShadow: {
    enabled: boolean;
    color: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface CutoutExportOptions {
  format: "png";
  fileName: string;
  transparent: boolean;
  scale: ExportScale;
  width: number | null;
  height: number | null;
  preserveAspectRatio: boolean;
  writeToAssetLibrary: boolean;
}

export interface SmartCutoutDocument {
  version: 12;
  sourceAssetId: string | null;
  backgroundAssetId: string | null;
  inference: CutoutInferenceOptions;
  alpha: AlphaRefinement;
  crop: CropOptions;
  transform: ImageTransform;
  background: BackgroundOptions;
  export: CutoutExportOptions;
  preview: {
    checkerboard: boolean;
    showAlpha: boolean;
    compareBeforeAfter: boolean;
  };
}

export interface ImageAssetLike {
  id: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  blob?: Blob;
  file?: File;
  url?: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  transparent: boolean;
  model: CutoutModel;
  processingMs: number;
}

export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface SmartCutoutResult {
  imageBlob: Blob;
  transparentPng: Blob;
  alphaMask: AlphaMask;
  metadata: ImageMetadata;
  objectUrl?: string;
}

export interface CutoutProgress {
  stage:
    | "idle"
    | "loading-model"
    | "decoding"
    | "inference"
    | "refining-mask"
    | "rendering"
    | "exporting"
    | "complete"
    | "error";
  progress: number;
  message: string;
}

export interface SmartCutoutCacheKey {
  sourceRevision: string;
  inferenceRevision: string;
  refinementRevision: string;
  renderRevision: string;
}
