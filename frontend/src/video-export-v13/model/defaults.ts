import type {
  VideoExportDocument,
} from "./types.js";

export function createDefaultVideoExportDocument(): VideoExportDocument {
  return {
    version: 13,

    size: {
      preset: "1080p",
      width: 1920,
      height: 1080,
      preserveAspectRatio: true,
      fit: "contain",
    },

    frameRate: 30,

    range: {
      mode: "timeline",
      startSeconds: 0,
      endSeconds: 10,
      durationSeconds: 10,
      loops: 1,
    },

    qualityPreset: "standard",

    h264: {
      profile: "main",
      bitrate: 8_000_000,
      bitrateMode: "variable",
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "quality",
      gopSeconds: 2,
      strategy: "auto",
    },

    background: {
      mode: "color",
      color: "#000000",
      imageAssetId: null,
      fit: "cover",
    },

    fileName: "preview-export.mp4",
    target: "memory",
    includeOverlays: true,
    includeWatermark: false,
    lockSeed: true,
    seed: 1,
  };
}
