export type VideoSizePreset =
  | "preview"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p"
  | "square"
  | "portrait4x5"
  | "portrait9x16"
  | "custom";

export type VideoFrameRate =
  | 24
  | 25
  | 30
  | 50
  | 60;

export type VideoQualityPreset =
  | "draft"
  | "standard"
  | "high"
  | "veryHigh"
  | "custom";

export type H264Profile =
  | "baseline"
  | "main"
  | "high";

export type EncoderStrategy =
  | "auto"
  | "webcodecs"
  | "wasm";

export type VideoExportTarget =
  | "memory"
  | "file-system";

export type VideoRangeMode =
  | "timeline"
  | "custom"
  | "duration";

export interface VideoExportSize {
  preset: VideoSizePreset;
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  fit: "contain" | "cover" | "stretch";
}

export interface VideoExportRange {
  mode: VideoRangeMode;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  loops: number;
}

export interface H264Options {
  profile: H264Profile;
  bitrate: number;
  bitrateMode: "variable" | "constant";
  hardwareAcceleration:
    | "no-preference"
    | "prefer-hardware"
    | "prefer-software";
  latencyMode: "quality" | "realtime";
  gopSeconds: number;
  strategy: EncoderStrategy;
}

export interface VideoBackground {
  mode: "color" | "image";
  color: string;
  imageAssetId: string | null;
  fit: "cover" | "contain" | "stretch";
}

export interface VideoExportDocument {
  version: 13;
  size: VideoExportSize;
  frameRate: VideoFrameRate;
  range: VideoExportRange;
  qualityPreset: VideoQualityPreset;
  h264: H264Options;
  background: VideoBackground;
  fileName: string;
  target: VideoExportTarget;
  includeOverlays: boolean;
  includeWatermark: boolean;
  lockSeed: boolean;
  seed: number;
}

export interface ResolvedVideoExportConfig {
  width: number;
  height: number;
  frameRate: number;
  frameCount: number;
  startSeconds: number;
  durationSeconds: number;
  bitrate: number;
  codec: string;
  gopFrames: number;
  fileName: string;
  target: VideoExportTarget;
  strategy: EncoderStrategy;
  background: VideoBackground;
  h264: H264Options;
  seed: number;
}

export interface ExportFrameRequest {
  frameIndex: number;
  frameCount: number;
  timeSeconds: number;
  deltaSeconds: number;
  width: number;
  height: number;
  seed: number;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

export interface ExportFrameSource {
  readonly durationSeconds: number;
  prepare(
    config: ResolvedVideoExportConfig,
  ): Promise<void>;
  renderFrame(
    request: ExportFrameRequest,
  ): Promise<void>;
  dispose(): Promise<void>;
}

export type VideoExportStage =
  | "idle"
  | "validating"
  | "preparing"
  | "rendering"
  | "encoding"
  | "muxing"
  | "downloading"
  | "complete"
  | "cancelled"
  | "error";

export interface VideoExportProgress {
  stage: VideoExportStage;
  frameIndex: number;
  frameCount: number;
  progress: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  message: string;
}

export interface VideoExportResult {
  blob: Blob;
  fileName: string;
  config: ResolvedVideoExportConfig;
  elapsedMs: number;
  encoder: "webcodecs" | "wasm";
}

export interface PreviewExportLifecycle {
  suspendForExport?(): Promise<unknown> | unknown;
  restoreAfterExport?(
    snapshot: unknown,
  ): Promise<void> | void;
}

export interface VideoEncoderCapability {
  supported: boolean;
  codec: string;
  reason?: string;
}
