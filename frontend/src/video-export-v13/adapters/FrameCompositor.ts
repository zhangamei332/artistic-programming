import type {
  ExportFrameRequest,
  VideoBackground,
} from "../model/types.js";
import {
  fitRect,
} from "../core/resolution.js";

export interface FrameCompositorOptions {
  background:
    VideoBackground;
  resolveBackgroundImage?:
    (
      assetId: string,
    ) =>
      Promise<
        CanvasImageSource |
        undefined
      >;
  overlayRenderers?:
    Array<
      (
        request:
          ExportFrameRequest,
      ) =>
        Promise<void> |
        void
    >;
}

export class FrameCompositor {
  private backgroundImage?:
    CanvasImageSource;

  public constructor(
    private readonly options:
      FrameCompositorOptions,
  ) {}

  public async prepare(): Promise<void> {
    if (
      this.options.background
        .mode === "image" &&
      this.options.background
        .imageAssetId &&
      this.options
        .resolveBackgroundImage
    ) {
      this.backgroundImage =
        await this.options
          .resolveBackgroundImage(
            this.options
              .background
              .imageAssetId,
          );
    }
  }

  public beginFrame(
    request:
      ExportFrameRequest,
  ): void {
    const {
      context,
      width,
      height,
    } = request;

    context.save();
    context.setTransform(
      1,
      0,
      0,
      1,
      0,
      0,
    );

    context.globalAlpha = 1;
    context.globalCompositeOperation =
      "source-over";

    if (
      this.options.background
        .mode === "color" ||
      !this.backgroundImage
    ) {
      context.fillStyle =
        this.options.background
          .color;

      context.fillRect(
        0,
        0,
        width,
        height,
      );
    } else {
      const sourceWidth =
        readDimension(
          this.backgroundImage,
          "width",
        );

      const sourceHeight =
        readDimension(
          this.backgroundImage,
          "height",
        );

      const rect =
        fitRect(
          sourceWidth,
          sourceHeight,
          width,
          height,
          this.options
            .background.fit,
        );

      context.drawImage(
        this.backgroundImage,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      );
    }

    context.restore();
  }

  public async endFrame(
    request:
      ExportFrameRequest,
  ): Promise<void> {
    for (
      const renderer of
      this.options
        .overlayRenderers ??
      []
    ) {
      await renderer(request);
    }
  }
}

function readDimension(
  source: CanvasImageSource,
  axis: "width" | "height",
): number {
  const object =
    source as unknown as
      Record<string, number>;

  const keys =
    axis === "width"
      ? [
          "width",
          "videoWidth",
          "naturalWidth",
          "displayWidth",
        ]
      : [
          "height",
          "videoHeight",
          "naturalHeight",
          "displayHeight",
        ];

  for (const key of keys) {
    const value = object[key];

    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      return value;
    }
  }

  return 1;
}
