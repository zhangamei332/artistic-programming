import type {
  ExportFrameRequest,
  ExportFrameSource,
  ResolvedVideoExportConfig,
} from "../model/types.js";
import {
  fitRect,
} from "../core/resolution.js";

export type DeterministicRenderCallback =
  (
    request: ExportFrameRequest,
  ) => Promise<void> | void;

export class DeterministicRenderFrameSource
  implements ExportFrameSource {
  public readonly durationSeconds: number;

  public constructor(
    durationSeconds: number,
    private readonly render:
      DeterministicRenderCallback,
    private readonly prepareCallback?:
      (
        config:
          ResolvedVideoExportConfig,
      ) => Promise<void> | void,
    private readonly disposeCallback?:
      () => Promise<void> | void,
  ) {
    this.durationSeconds =
      durationSeconds;
  }

  public async prepare(
    config:
      ResolvedVideoExportConfig,
  ): Promise<void> {
    await this.prepareCallback?.(
      config,
    );
  }

  public async renderFrame(
    request:
      ExportFrameRequest,
  ): Promise<void> {
    await this.render(request);
  }

  public async dispose(): Promise<void> {
    await this.disposeCallback?.();
  }
}

export class CanvasSnapshotFrameSource
  implements ExportFrameSource {
  public readonly durationSeconds: number;

  public constructor(
    private readonly source:
      HTMLCanvasElement |
      OffscreenCanvas,
    durationSeconds: number,
    private readonly fit:
      "contain" |
      "cover" |
      "stretch" =
      "contain",
  ) {
    this.durationSeconds =
      durationSeconds;
  }

  public async prepare(): Promise<void> {}

  public async renderFrame(
    request:
      ExportFrameRequest,
  ): Promise<void> {
    const rect =
      fitRect(
        this.source.width,
        this.source.height,
        request.width,
        request.height,
        this.fit,
      );

    request.context.drawImage(
      this.source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
  }

  public async dispose(): Promise<void> {}
}

export class CachedBitmapFrameSource
  implements ExportFrameSource {
  public readonly durationSeconds: number;

  public constructor(
    private readonly frames:
      readonly CanvasImageSource[],
    private readonly sourceFrameRate:
      number,
    private readonly sourceWidth:
      number,
    private readonly sourceHeight:
      number,
    private readonly fit:
      "contain" |
      "cover" |
      "stretch" =
      "contain",
    private readonly ownsFrames =
      false,
  ) {
    this.durationSeconds =
      frames.length /
      sourceFrameRate;
  }

  public async prepare(): Promise<void> {
    if (
      this.frames.length === 0
    ) {
      throw new Error(
        "The cached frame source is empty.",
      );
    }
  }

  public async renderFrame(
    request:
      ExportFrameRequest,
  ): Promise<void> {
    const sourceIndex =
      Math.min(
        this.frames.length - 1,
        Math.max(
          0,
          Math.round(
            request.timeSeconds *
            this.sourceFrameRate,
          ),
        ),
      );

    const frame =
      this.frames[sourceIndex];

    const rect =
      fitRect(
        this.sourceWidth,
        this.sourceHeight,
        request.width,
        request.height,
        this.fit,
      );

    request.context.drawImage(
      frame,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
  }

  public async dispose(): Promise<void> {
    if (!this.ownsFrames) return;

    for (
      const frame of
      this.frames
    ) {
      const closable =
        frame as unknown as {
          close?: () => void;
        };

      closable.close?.();
    }
  }
}
