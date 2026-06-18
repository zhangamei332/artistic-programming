import type {
  NormalizedCropRect,
} from "../model/types.js";

export interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeCropRect(
  rect: NormalizedCropRect,
): NormalizedCropRect {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const maxWidth = 1 - x;
  const maxHeight = 1 - y;

  return {
    x,
    y,
    width: Math.max(
      0.000001,
      Math.min(maxWidth, rect.width),
    ),
    height: Math.max(
      0.000001,
      Math.min(maxHeight, rect.height),
    ),
  };
}

export function cropRectToPixels(
  rect: NormalizedCropRect,
  imageWidth: number,
  imageHeight: number,
): PixelCropRect {
  const normalized =
    normalizeCropRect(rect);

  const x = Math.round(
    normalized.x * imageWidth,
  );
  const y = Math.round(
    normalized.y * imageHeight,
  );

  const width = Math.max(
    1,
    Math.round(
      normalized.width * imageWidth,
    ),
  );

  const height = Math.max(
    1,
    Math.round(
      normalized.height * imageHeight,
    ),
  );

  return {
    x: Math.min(
      imageWidth - 1,
      x,
    ),
    y: Math.min(
      imageHeight - 1,
      y,
    ),
    width: Math.min(
      imageWidth - x,
      width,
    ),
    height: Math.min(
      imageHeight - y,
      height,
    ),
  };
}

export function pixelCropToNormalized(
  rect: PixelCropRect,
  imageWidth: number,
  imageHeight: number,
): NormalizedCropRect {
  return normalizeCropRect({
    x: rect.x / imageWidth,
    y: rect.y / imageHeight,
    width: rect.width / imageWidth,
    height: rect.height / imageHeight,
  });
}

export function enforceAspectRatio(
  rect: NormalizedCropRect,
  aspectRatio: number | null,
): NormalizedCropRect {
  if (
    !aspectRatio ||
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0
  ) {
    return normalizeCropRect(rect);
  }

  const normalized =
    normalizeCropRect(rect);

  const current =
    normalized.width /
    normalized.height;

  let width = normalized.width;
  let height = normalized.height;

  if (current > aspectRatio) {
    width = height * aspectRatio;
  } else {
    height = width / aspectRatio;
  }

  return normalizeCropRect({
    x:
      normalized.x +
      (normalized.width - width) / 2,
    y:
      normalized.y +
      (normalized.height - height) / 2,
    width,
    height,
  });
}

export function addCropPadding(
  rect: NormalizedCropRect,
  padding: number,
): NormalizedCropRect {
  const normalized =
    normalizeCropRect(rect);

  const safePadding =
    Math.max(0, padding);

  return normalizeCropRect({
    x:
      normalized.x -
      safePadding,
    y:
      normalized.y -
      safePadding,
    width:
      normalized.width +
      safePadding * 2,
    height:
      normalized.height +
      safePadding * 2,
  });
}
