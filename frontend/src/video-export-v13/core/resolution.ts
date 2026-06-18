import type {
  VideoExportDocument,
  VideoSizePreset,
} from "../model/types.js";

export interface SizePresetRecord {
  id: VideoSizePreset;
  label: string;
  width: number | null;
  height: number | null;
}

export const videoSizePresets:
  SizePresetRecord[] = [
  {
    id: "preview",
    label: "当前预览尺寸",
    width: null,
    height: null,
  },
  {
    id: "720p",
    label: "1280 × 720",
    width: 1280,
    height: 720,
  },
  {
    id: "1080p",
    label: "1920 × 1080",
    width: 1920,
    height: 1080,
  },
  {
    id: "1440p",
    label: "2560 × 1440",
    width: 2560,
    height: 1440,
  },
  {
    id: "2160p",
    label: "3840 × 2160",
    width: 3840,
    height: 2160,
  },
  {
    id: "square",
    label: "1080 × 1080",
    width: 1080,
    height: 1080,
  },
  {
    id: "portrait4x5",
    label: "1080 × 1350",
    width: 1080,
    height: 1350,
  },
  {
    id: "portrait9x16",
    label: "1080 × 1920",
    width: 1080,
    height: 1920,
  },
  {
    id: "custom",
    label: "自定义",
    width: null,
    height: null,
  },
];

export function toEvenDimension(
  value: number,
): number {
  const integer =
    Math.max(
      2,
      Math.round(value),
    );

  return integer % 2 === 0
    ? integer
    : integer + 1;
}

export function resolveVideoSize(
  document: VideoExportDocument,
  previewWidth: number,
  previewHeight: number,
): {
  width: number;
  height: number;
} {
  const preset =
    videoSizePresets.find(
      (entry) =>
        entry.id ===
        document.size.preset,
    );

  let width =
    preset?.width ??
    document.size.width;

  let height =
    preset?.height ??
    document.size.height;

  if (
    document.size.preset ===
    "preview"
  ) {
    width = previewWidth;
    height = previewHeight;
  }

  return {
    width:
      toEvenDimension(width),
    height:
      toEvenDimension(height),
  };
}

export function fitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: "contain" | "cover" | "stretch",
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (mode === "stretch") {
    return {
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
    };
  }

  const scale =
    mode === "cover"
      ? Math.max(
          targetWidth /
            sourceWidth,
          targetHeight /
            sourceHeight,
        )
      : Math.min(
          targetWidth /
            sourceWidth,
          targetHeight /
            sourceHeight,
        );

  const width =
    sourceWidth * scale;

  const height =
    sourceHeight * scale;

  return {
    x:
      (targetWidth - width) /
      2,
    y:
      (targetHeight - height) /
      2,
    width,
    height,
  };
}
