import type {
  AlphaMask,
  BackgroundOptions,
  CropOptions,
  ImageTransform,
} from "../model/types.js";
import {
  cropRectToPixels,
} from "../core/cropMath.js";
import {
  createCanvas,
  get2d,
  canvasToPngBlob,
} from "./ImageDecodeAdapter.js";

export interface RenderCutoutRequest {
  foreground: ImageData;
  alphaMask: AlphaMask;
  crop: CropOptions;
  transform: ImageTransform;
  background: BackgroundOptions;
  outputWidth: number;
  outputHeight: number;
  backgroundImage?: CanvasImageSource;
}

export interface RenderCutoutResult {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  blob: Blob;
}

export async function renderCutout(
  request: RenderCutoutRequest,
): Promise<RenderCutoutResult> {
  const sourceCanvas =
    createCanvas(
      request.foreground.width,
      request.foreground.height,
    );

  const sourceContext =
    get2d(sourceCanvas);

  const masked =
    new ImageData(
      new Uint8ClampedArray(
        request.foreground.data,
      ),
      request.foreground.width,
      request.foreground.height,
    );

  for (
    let pixel = 0;
    pixel <
    request.alphaMask.data.length;
    pixel += 1
  ) {
    masked.data[
      pixel * 4 + 3
    ] =
      request.alphaMask.data[
        pixel
      ];
  }

  sourceContext.putImageData(
    masked,
    0,
    0,
  );

  const crop =
    request.crop.enabled
      ? cropRectToPixels(
          request.crop.rect,
          masked.width,
          masked.height,
        )
      : {
          x: 0,
          y: 0,
          width: masked.width,
          height: masked.height,
        };

  const output =
    createCanvas(
      request.outputWidth,
      request.outputHeight,
    );

  const context =
    get2d(output);

  drawBackground(
    context,
    output.width,
    output.height,
    request.background,
    request.backgroundImage,
  );

  context.save();

  const centerX =
    output.width / 2 +
    request.transform.translateX;

  const centerY =
    output.height / 2 +
    request.transform.translateY;

  context.translate(
    centerX,
    centerY,
  );

  context.rotate(
    request.transform.rotationDeg *
    Math.PI /
    180,
  );

  context.scale(
    request.transform.zoom *
      (request.transform.flipX
        ? -1
        : 1),
    request.transform.zoom *
      (request.transform.flipY
        ? -1
        : 1),
  );

  if (
    request.background
      .subjectShadow.enabled
  ) {
    context.shadowColor =
      withAlpha(
        request.background
          .subjectShadow.color,
        request.background
          .subjectShadow.opacity,
      );

    context.shadowBlur =
      request.background
        .subjectShadow.blur;

    context.shadowOffsetX =
      request.background
        .subjectShadow.offsetX;

    context.shadowOffsetY =
      request.background
        .subjectShadow.offsetY;
  }

  const fitScale =
    Math.min(
      output.width /
        crop.width,
      output.height /
        crop.height,
    );

  const drawWidth =
    crop.width *
    fitScale;

  const drawHeight =
    crop.height *
    fitScale;

  context.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );

  context.restore();

  return {
    canvas: output,
    blob:
      await canvasToPngBlob(
        output,
      ),
  };
}

function drawBackground(
  context:
    CanvasRenderingContext2D |
    OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundOptions,
  image: CanvasImageSource | undefined,
): void {
  if (
    background.mode ===
    "transparent"
  ) {
    context.clearRect(
      0,
      0,
      width,
      height,
    );
    return;
  }

  if (
    background.mode ===
    "color"
  ) {
    context.fillStyle =
      background.color;

    context.fillRect(
      0,
      0,
      width,
      height,
    );

    return;
  }

  if (!image) {
    context.clearRect(
      0,
      0,
      width,
      height,
    );
    return;
  }

  context.save();

  context.filter = [
    background.blur > 0
      ? `blur(${background.blur}px)`
      : "",
    background.brightness !== 1
      ? `brightness(${background.brightness})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const sourceWidth =
    sourceDimension(
      image,
      "width",
    );

  const sourceHeight =
    sourceDimension(
      image,
      "height",
    );

  if (
    background.fit ===
    "stretch"
  ) {
    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );
  } else {
    const scale =
      background.fit ===
      "cover"
        ? Math.max(
            width /
              sourceWidth,
            height /
              sourceHeight,
          )
        : Math.min(
            width /
              sourceWidth,
            height /
              sourceHeight,
          );

    const drawWidth =
      sourceWidth * scale;

    const drawHeight =
      sourceHeight * scale;

    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }

  context.restore();
}

function sourceDimension(
  source: CanvasImageSource,
  axis: "width" | "height",
): number {
  const value =
    axis === "width"
      ? (
          source as {
            width?: number;
            videoWidth?: number;
            naturalWidth?: number;
          }
        ).width ??
        (
          source as {
            videoWidth?: number;
          }
        ).videoWidth ??
        (
          source as {
            naturalWidth?: number;
          }
        ).naturalWidth
      : (
          source as {
            height?: number;
            videoHeight?: number;
            naturalHeight?: number;
          }
        ).height ??
        (
          source as {
            videoHeight?: number;
          }
        ).videoHeight ??
        (
          source as {
            naturalHeight?: number;
          }
        ).naturalHeight;

  return Math.max(
    1,
    value ?? 1,
  );
}

function withAlpha(
  color: string,
  alpha: number,
): string {
  if (
    /^#[0-9a-f]{6}$/iu.test(
      color,
    )
  ) {
    const red =
      Number.parseInt(
        color.slice(1, 3),
        16,
      );

    const green =
      Number.parseInt(
        color.slice(3, 5),
        16,
      );

    const blue =
      Number.parseInt(
        color.slice(5, 7),
        16,
      );

    return `rgba(${red}, ${green}, ${blue}, ${Math.max(
      0,
      Math.min(1, alpha),
    )})`;
  }

  return color;
}
