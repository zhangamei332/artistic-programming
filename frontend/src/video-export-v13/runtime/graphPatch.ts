import type {
  VideoExportDocument,
  VideoFrameRate,
  VideoQualityPreset,
  VideoSizePreset,
} from "../model/types.js";
import {
  createDefaultVideoExportDocument,
} from "../model/defaults.js";

export type VideoExportGraphOperation =
  | {
      op: "setVideoExportSize";
      previewNodeId: string;
      preset: VideoSizePreset;
      width?: number;
      height?: number;
    }
  | {
      op: "setVideoExportFrameRate";
      previewNodeId: string;
      frameRate: VideoFrameRate;
    }
  | {
      op: "setVideoExportRange";
      previewNodeId: string;
      startSeconds?: number;
      endSeconds?: number;
      durationSeconds?: number;
      loops?: number;
    }
  | {
      op: "setVideoExportQuality";
      previewNodeId: string;
      preset: VideoQualityPreset;
      bitrate?: number;
    }
  | {
      op: "setVideoExportCodec";
      previewNodeId: string;
      update:
        Partial<
          VideoExportDocument[
            "h264"
          ]
        >;
    }
  | {
      op: "setVideoExportBackground";
      previewNodeId: string;
      update:
        Partial<
          VideoExportDocument[
            "background"
          ]
        >;
    }
  | {
      op: "setVideoExportFileName";
      previewNodeId: string;
      fileName: string;
    }
  | {
      op: "resetVideoExport";
      previewNodeId: string;
    };

export function applyVideoExportGraphOperation(
  document: VideoExportDocument,
  operation: VideoExportGraphOperation,
): VideoExportDocument {
  const next =
    structuredClone(document);

  switch (operation.op) {
    case "setVideoExportSize":
      next.size.preset =
        operation.preset;

      if (
        operation.width !==
        undefined
      ) {
        next.size.width =
          operation.width;
      }

      if (
        operation.height !==
        undefined
      ) {
        next.size.height =
          operation.height;
      }

      return next;

    case "setVideoExportFrameRate":
      next.frameRate =
        operation.frameRate;
      return next;

    case "setVideoExportRange":
      Object.assign(
        next.range,
        {
          startSeconds:
            operation.startSeconds ??
            next.range.startSeconds,
          endSeconds:
            operation.endSeconds ??
            next.range.endSeconds,
          durationSeconds:
            operation.durationSeconds ??
            next.range.durationSeconds,
          loops:
            operation.loops ??
            next.range.loops,
        },
      );
      return next;

    case "setVideoExportQuality":
      next.qualityPreset =
        operation.preset;

      if (
        operation.bitrate !==
        undefined
      ) {
        next.h264.bitrate =
          operation.bitrate;
      }

      return next;

    case "setVideoExportCodec":
      next.h264 = {
        ...next.h264,
        ...operation.update,
      };
      return next;

    case "setVideoExportBackground":
      next.background = {
        ...next.background,
        ...operation.update,
      };
      return next;

    case "setVideoExportFileName":
      next.fileName =
        operation.fileName;
      return next;

    case "resetVideoExport":
      return createDefaultVideoExportDocument();
  }
}
