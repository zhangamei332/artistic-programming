import type {
  ExportFrameSource,
  PreviewExportLifecycle,
  VideoExportDocument,
  VideoExportProgress,
  VideoExportResult,
} from "../model/types.js";
import {
  resolveVideoExportConfig,
} from "../core/resolveConfig.js";
import {
  FrameCompositor,
} from "../adapters/FrameCompositor.js";
import {
  CanvasRecordH264Adapter,
} from "../adapters/CanvasRecordH264Adapter.js";
import {
  downloadMp4,
} from "../adapters/downloadMp4.js";

export interface VideoExportControllerDependencies {
  createFrameSource(
    document:
      VideoExportDocument,
  ): Promise<
    ExportFrameSource
  >;
  preview: {
    width: number;
    height: number;
    timelineDuration: number;
  };
  lifecycle?:
    PreviewExportLifecycle;
  resolveBackgroundImage?:
    (
      assetId: string,
    ) =>
      Promise<
        CanvasImageSource |
        undefined
      >;
  overlayRenderers?:
    FrameCompositorOptions["overlayRenderers"];
  onProgress?(
    progress:
      VideoExportProgress,
  ): void;
  download?(
    blob: Blob,
    fileName: string,
  ): void;
}

type FrameCompositorOptions =
  ConstructorParameters<
    typeof FrameCompositor
  >[0];

export class VideoExportController {
  private abortController?:
    AbortController;
  private running = false;

  public constructor(
    private readonly dependencies:
      VideoExportControllerDependencies,
    private readonly encoder =
      new CanvasRecordH264Adapter(),
  ) {}

  public get isRunning(): boolean {
    return this.running;
  }

  public cancel(): void {
    this.abortController?.abort();
  }

  public async export(
    document:
      VideoExportDocument,
  ): Promise<VideoExportResult> {
    if (this.running) {
      throw new Error(
        "A video export is already running.",
      );
    }

    this.running = true;
    this.abortController =
      new AbortController();

    const started =
      performance.now();

    let frameSource:
      ExportFrameSource |
      undefined;

    let lifecycleSnapshot:
      unknown;

    try {
      this.emit({
        stage:
          "validating",
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs:
          null,
        message:
          "Validating export settings",
      });

      const config =
        resolveVideoExportConfig(
          document,
          {
            previewWidth:
              this.dependencies
                .preview.width,
            previewHeight:
              this.dependencies
                .preview.height,
            timelineDuration:
              this.dependencies
                .preview.timelineDuration,
          },
        );

      frameSource =
        await this.dependencies
          .createFrameSource(
            document,
          );

      lifecycleSnapshot =
        await this.dependencies
          .lifecycle
          ?.suspendForExport?.();

      this.emit({
        stage: "preparing",
        frameIndex: 0,
        frameCount:
          config.frameCount,
        progress: 0.01,
        elapsedMs:
          performance.now() -
          started,
        estimatedRemainingMs:
          null,
        message:
          "Preparing offscreen renderer",
      });

      await frameSource.prepare(
        config,
      );

      const canvas =
        globalThis.document.createElement(
          "canvas",
        );

      canvas.width =
        config.width;

      canvas.height =
        config.height;

      const context =
        canvas.getContext(
          "2d",
          {
            alpha: false,
            desynchronized:
              false,
          },
        );

      if (!context) {
        throw new Error(
          "Canvas 2D context is unavailable.",
        );
      }

      const compositor =
        new FrameCompositor({
          background:
            config.background,
          resolveBackgroundImage:
            this.dependencies
              .resolveBackgroundImage,
          overlayRenderers:
            document
              .includeOverlays
              ? this.dependencies
                  .overlayRenderers
              : [],
        });

      await compositor.prepare();

      const encoded =
        await this.encoder.export({
          config,
          canvas,
          context,
          signal:
            this.abortController
              .signal,
          onProgress:
            (progress) =>
              this.emit(
                progress,
              ),
          renderFrame:
            async (
              request,
            ) => {
              this.emit({
                stage:
                  "rendering",
                frameIndex:
                  request.frameIndex,
                frameCount:
                  request.frameCount,
                progress:
                  request.frameIndex /
                  request.frameCount,
                elapsedMs:
                  performance.now() -
                  started,
                estimatedRemainingMs:
                  null,
                message:
                  `Rendering ${request.frameIndex + 1}/${request.frameCount}`,
              });

              compositor.beginFrame(
                request,
              );

              await frameSource!
                .renderFrame(
                  request,
                );

              await compositor.endFrame(
                request,
              );
            },
        });

      if (
        encoded.blob
      ) {
        this.emit({
          stage:
            "downloading",
          frameIndex:
            config.frameCount,
          frameCount:
            config.frameCount,
          progress: 1,
          elapsedMs:
            performance.now() -
            started,
          estimatedRemainingMs:
            0,
          message:
            "Downloading MP4",
        });

        (
          this.dependencies
            .download ??
          downloadMp4
        )(
          encoded.blob,
          config.fileName,
        );
      }

      const result:
        VideoExportResult = {
        blob:
          encoded.blob ??
          new Blob([], {
            type:
              "video/mp4",
          }),
        fileName:
          config.fileName,
        config,
        elapsedMs:
          performance.now() -
          started,
        encoder:
          encoded.encoder,
      };

      this.emit({
        stage: "complete",
        frameIndex:
          config.frameCount,
        frameCount:
          config.frameCount,
        progress: 1,
        elapsedMs:
          result.elapsedMs,
        estimatedRemainingMs:
          0,
        message:
          "Video export complete",
      });

      return result;
    } catch (error) {
      const cancelled =
        error instanceof
          DOMException &&
        error.name ===
          "AbortError";

      this.emit({
        stage:
          cancelled
            ? "cancelled"
            : "error",
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs:
          performance.now() -
          started,
        estimatedRemainingMs:
          null,
        message:
          cancelled
            ? "Video export cancelled"
            : error instanceof
                Error
              ? error.message
              : "Video export failed",
      });

      throw error;
    } finally {
      await frameSource
        ?.dispose();

      await this.dependencies
        .lifecycle
        ?.restoreAfterExport?.(
          lifecycleSnapshot,
        );

      this.running = false;
      this.abortController =
        undefined;
    }
  }

  private emit(
    progress:
      VideoExportProgress,
  ): void {
    this.dependencies
      .onProgress?.(
        progress,
      );
  }
}
