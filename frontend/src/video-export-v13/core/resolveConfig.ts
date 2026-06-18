import type {
  ResolvedVideoExportConfig,
  VideoExportDocument,
} from "../model/types.js";
import {
  estimateH264Bitrate,
} from "./bitrate.js";
import {
  buildFallbackCodecString,
  recommendAvcLevel,
} from "./codec.js";
import {
  resolveVideoRange,
} from "./range.js";
import {
  resolveVideoSize,
} from "./resolution.js";

export function resolveVideoExportConfig(
  document: VideoExportDocument,
  context: {
    previewWidth: number;
    previewHeight: number;
    timelineDuration: number;
  },
): ResolvedVideoExportConfig {
  const size =
    resolveVideoSize(
      document,
      context.previewWidth,
      context.previewHeight,
    );

  const range =
    resolveVideoRange(
      document,
      context.timelineDuration,
    );

  const bitrate =
    document.qualityPreset ===
    "custom"
      ? document.h264.bitrate
      : estimateH264Bitrate(
          size.width,
          size.height,
          document.frameRate,
          document.qualityPreset,
        );

  const level =
    recommendAvcLevel(
      size.width,
      size.height,
      document.frameRate,
    );

  const codec =
    buildFallbackCodecString(
      document.h264.profile,
      level,
    );

  return {
    width: size.width,
    height: size.height,
    frameRate:
      document.frameRate,
    frameCount:
      range.frameCount,
    startSeconds:
      range.startSeconds,
    durationSeconds:
      range.durationSeconds,
    bitrate:
      Math.max(
        100_000,
        bitrate,
      ),
    codec,
    gopFrames:
      Math.max(
        1,
        Math.round(
          document.h264
            .gopSeconds *
          document.frameRate,
        ),
      ),
    fileName:
      ensureMp4Extension(
        document.fileName,
      ),
    target:
      document.target,
    strategy:
      document.h264.strategy,
    background:
      structuredClone(
        document.background,
      ),
    h264:
      structuredClone(
        document.h264,
      ),
    seed:
      document.lockSeed
        ? document.seed
        : Math.floor(
            Math.random() *
            0x7fffffff,
          ),
  };
}

export function ensureMp4Extension(
  fileName: string,
): string {
  const trimmed =
    fileName.trim() ||
    "preview-export.mp4";

  return trimmed
    .toLowerCase()
    .endsWith(".mp4")
      ? trimmed
      : `${trimmed}.mp4`;
}
