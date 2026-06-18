import type {
  VideoQualityPreset,
} from "../model/types.js";

export function estimateH264Bitrate(
  width: number,
  height: number,
  frameRate: number,
  preset: VideoQualityPreset,
): number {
  const pixelsPerSecond =
    width *
    height *
    frameRate;

  const bitsPerPixelByPreset:
    Record<
      VideoQualityPreset,
      number
    > = {
    draft: 0.045,
    standard: 0.08,
    high: 0.12,
    veryHigh: 0.18,
    custom: 0.08,
  };

  const estimated =
    pixelsPerSecond *
    bitsPerPixelByPreset[
      preset
    ];

  return Math.max(
    500_000,
    Math.round(
      estimated / 100_000,
    ) * 100_000,
  );
}

export function estimateOutputBytes(
  bitrate: number,
  durationSeconds: number,
): number {
  return Math.ceil(
    bitrate *
    durationSeconds /
    8,
  );
}

export function formatBytes(
  bytes: number,
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "—";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let value = bytes;
  let unit = 0;

  while (
    value >= 1024 &&
    unit < units.length - 1
  ) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(
    unit === 0 ? 0 : 1,
  )} ${units[unit]}`;
}
