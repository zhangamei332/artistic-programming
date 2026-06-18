import {
  Encoders,
  Recorder,
} from "canvas-record";
import type {
  ExportFrameRequest,
  ResolvedVideoExportConfig,
  VideoExportProgress,
} from "../model/types.js";
import {
  checkH264Capability,
} from "../core/codec.js";

export interface CanvasRecordExportOptions {
  config: ResolvedVideoExportConfig;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  signal?: AbortSignal;
  renderFrame(
    request: ExportFrameRequest,
  ): Promise<void>;
  onProgress?(
    progress: VideoExportProgress,
  ): void;
}

export interface CanvasRecordExportResult {
  blob: Blob | null;
  encoder:
    | "webcodecs"
    | "wasm";
  savedToFileSystem: boolean;
}

export class CanvasRecordH264Adapter {
  public async export(
    options:
      CanvasRecordExportOptions,
  ): Promise<CanvasRecordExportResult> {
    const {
      config,
      canvas,
      context,
      signal,
      renderFrame,
      onProgress,
    } = options;

    const encoderConfig:
      VideoEncoderConfig = {
      codec: config.codec,
      width: config.width,
      height: config.height,
      framerate:
        config.frameRate,
      bitrate: config.bitrate,
      bitrateMode:
        config.h264
          .bitrateMode,
      hardwareAcceleration:
        config.h264
          .hardwareAcceleration,
      latencyMode:
        config.h264
          .latencyMode,
      avc: {
        format: "avc",
      },
    };

    const capability =
      await checkH264Capability(
        encoderConfig,
      );

    const useWebCodecs =
      config.strategy ===
        "webcodecs" ||
      (
        config.strategy ===
          "auto" &&
        capability.supported
      );

    if (
      config.strategy ===
        "webcodecs" &&
      !capability.supported
    ) {
      throw new Error(
        capability.reason ??
        "H.264 WebCodecs is unsupported.",
      );
    }

    const encoder =
      useWebCodecs
        ? new Encoders
            .WebCodecsEncoder({
              groupOfPictures:
                config.gopFrames,
              flushFrequency: 10,
            })
        : new Encoders
            .H264MP4Encoder({
              debug: false,
            });

    const encoderOptions =
      useWebCodecs
        ? encoderConfig
        : {
            kbps:
              Math.round(
                config.bitrate /
                1000,
              ),
            speed:
              config.h264
                .latencyMode ===
              "realtime"
                ? 8
                : 3,
            quantizationParameter:
              qualityToQp(
                config.bitrate,
                config.width,
                config.height,
                config.frameRate,
              ),
            groupOfPictures:
              config.gopFrames,
          };

    const recorder =
      new Recorder(
        context,
        {
          name: "",
          duration:
            config.frameCount /
            config.frameRate,
          frameRate:
            config.frameRate,
          extension: "mp4",
          target:
            config.target,
          download: false,
          encoder,
          encoderOptions,
        },
      );

    const started =
      performance.now();

    try {
      throwIfAborted(signal);

      await recorder.start({
        filename:
          config.fileName,
        initOnly: true,
      });

      for (
        let frameIndex = 0;
        frameIndex <
        config.frameCount;
        frameIndex += 1
      ) {
        throwIfAborted(signal);

        const request:
          ExportFrameRequest = {
          frameIndex,
          frameCount:
            config.frameCount,
          timeSeconds:
            config.startSeconds +
            frameIndex /
              config.frameRate,
          deltaSeconds:
            1 /
            config.frameRate,
          width: config.width,
          height:
            config.height,
          seed: config.seed,
          canvas,
          context,
        };

        await renderFrame(
          request,
        );

        throwIfAborted(signal);

        await recorder.step();

        const elapsedMs =
          performance.now() -
          started;

        const completed =
          frameIndex + 1;

        const remainingFrames =
          config.frameCount -
          completed;

        const averageMs =
          elapsedMs /
          completed;

        onProgress?.({
          stage: "encoding",
          frameIndex:
            completed,
          frameCount:
            config.frameCount,
          progress:
            completed /
            config.frameCount,
          elapsedMs,
          estimatedRemainingMs:
            averageMs *
            remainingFrames,
          message:
            `Encoding ${completed}/${config.frameCount}`,
        });
      }

      onProgress?.({
        stage: "muxing",
        frameIndex:
          config.frameCount,
        frameCount:
          config.frameCount,
        progress: 0.99,
        elapsedMs:
          performance.now() -
          started,
        estimatedRemainingMs:
          null,
        message:
          "Finalizing MP4",
      });

      const buffer =
        await recorder.stop();

      if (
        config.target ===
        "file-system"
      ) {
        return {
          blob: null,
          encoder:
            useWebCodecs
              ? "webcodecs"
              : "wasm",
          savedToFileSystem:
            true,
        };
      }

      if (!buffer) {
        throw new Error(
          "The encoder returned no MP4 data.",
        );
      }

      const parts =
        Array.isArray(buffer)
          ? buffer
          : [buffer];

      return {
        blob:
          new Blob(
            parts,
            {
              type:
                "video/mp4",
            },
          ),
        encoder:
          useWebCodecs
            ? "webcodecs"
            : "wasm",
        savedToFileSystem:
          false,
      };
    } finally {
      await recorder.dispose();
    }
  }
}

function qualityToQp(
  bitrate: number,
  width: number,
  height: number,
  frameRate: number,
): number {
  const bpp =
    bitrate /
    (
      width *
      height *
      frameRate
    );

  if (bpp >= 0.16) return 18;
  if (bpp >= 0.1) return 23;
  if (bpp >= 0.07) return 28;
  return 33;
}

function throwIfAborted(
  signal:
    AbortSignal |
    undefined,
): void {
  if (signal?.aborted) {
    throw new DOMException(
      "Video export was cancelled.",
      "AbortError",
    );
  }
}
