import type {
  ImageTransform,
} from "../model/types.js";

export interface OutputSize {
  width: number;
  height: number;
}

export function normalizeRotation(
  rotationDeg: number,
): number {
  const result =
    rotationDeg % 360;

  return result < 0
    ? result + 360
    : result;
}

export function rotatedBounds(
  width: number,
  height: number,
  rotationDeg: number,
): OutputSize {
  const radians =
    normalizeRotation(rotationDeg) *
    Math.PI /
    180;

  const cos =
    Math.abs(Math.cos(radians));

  const sin =
    Math.abs(Math.sin(radians));

  return {
    width: Math.max(
      1,
      Math.ceil(
        width * cos +
        height * sin,
      ),
    ),
    height: Math.max(
      1,
      Math.ceil(
        width * sin +
        height * cos,
      ),
    ),
  };
}

export function resolveOutputSize(
  sourceWidth: number,
  sourceHeight: number,
  transform: ImageTransform,
  requestedWidth: number | null,
  requestedHeight: number | null,
  preserveAspectRatio: boolean,
  scale: number,
): OutputSize {
  const rotated =
    rotatedBounds(
      sourceWidth,
      sourceHeight,
      transform.rotationDeg,
    );

  const baseWidth =
    rotated.width *
    Math.max(
      0.0001,
      transform.zoom,
    );

  const baseHeight =
    rotated.height *
    Math.max(
      0.0001,
      transform.zoom,
    );

  let width =
    requestedWidth ??
    baseWidth;

  let height =
    requestedHeight ??
    baseHeight;

  if (
    preserveAspectRatio
  ) {
    const ratio =
      baseWidth /
      baseHeight;

    if (
      requestedWidth &&
      !requestedHeight
    ) {
      height =
        requestedWidth /
        ratio;
    } else if (
      requestedHeight &&
      !requestedWidth
    ) {
      width =
        requestedHeight *
        ratio;
    } else if (
      requestedWidth &&
      requestedHeight
    ) {
      const fitted =
        Math.min(
          requestedWidth /
            baseWidth,
          requestedHeight /
            baseHeight,
        );

      width =
        baseWidth * fitted;
      height =
        baseHeight * fitted;
    }
  }

  return {
    width: Math.max(
      1,
      Math.round(
        width * scale,
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        height * scale,
      ),
    ),
  };
}

export function transformToMatrix(
  transform: ImageTransform,
  centerX: number,
  centerY: number,
): DOMMatrix {
  const scaleX =
    transform.zoom *
    (transform.flipX
      ? -1
      : 1);

  const scaleY =
    transform.zoom *
    (transform.flipY
      ? -1
      : 1);

  return new DOMMatrix()
    .translate(
      centerX +
        transform.translateX,
      centerY +
        transform.translateY,
    )
    .rotate(
      transform.rotationDeg,
    )
    .scale(
      scaleX,
      scaleY,
    )
    .translate(
      -centerX,
      -centerY,
    );
}
