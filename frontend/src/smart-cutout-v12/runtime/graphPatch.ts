import type {
  BackgroundMode,
  CutoutModel,
  SmartCutoutDocument,
} from "../model/types.js";
import {
  createDefaultSmartCutoutDocument,
  qualityToModel,
} from "../model/defaults.js";
import {
  enforceAspectRatio,
  normalizeCropRect,
} from "../core/cropMath.js";
import {
  normalizeRotation,
} from "../core/transformMath.js";

export type SmartCutoutGraphOperation =
  | {
      op: "setCutoutModel";
      nodeId: string;
      model: CutoutModel;
    }
  | {
      op: "setCutoutQuality";
      nodeId: string;
      preset:
        keyof typeof qualityToModel;
    }
  | {
      op: "runBackgroundRemoval";
      nodeId: string;
      model?: CutoutModel;
    }
  | {
      op: "setAlphaRefinement";
      nodeId: string;
      update:
        Partial<
          SmartCutoutDocument[
            "alpha"
          ]
        >;
    }
  | {
      op: "setCrop";
      nodeId: string;
      rect:
        SmartCutoutDocument[
          "crop"
        ]["rect"];
    }
  | {
      op:
        "setCropAspectRatio";
      nodeId: string;
      aspectRatio:
        number | null;
    }
  | {
      op: "setImageTransform";
      nodeId: string;
      update:
        Partial<
          SmartCutoutDocument[
            "transform"
          ]
        >;
    }
  | {
      op: "flipImage";
      nodeId: string;
      axis:
        | "horizontal"
        | "vertical";
    }
  | {
      op: "rotateImage";
      nodeId: string;
      degrees: number;
    }
  | {
      op: "setBackground";
      nodeId: string;
      mode: BackgroundMode;
      color?: string;
      imageAssetId?: string | null;
    }
  | {
      op: "setCutoutExport";
      nodeId: string;
      update:
        Partial<
          SmartCutoutDocument[
            "export"
          ]
        >;
    }
  | {
      op: "resetCutoutNode";
      nodeId: string;
      preserveSource: boolean;
    };

export function applySmartCutoutGraphOperation(
  document: SmartCutoutDocument,
  operation: SmartCutoutGraphOperation,
): SmartCutoutDocument {
  const next =
    structuredClone(document);

  switch (operation.op) {
    case "setCutoutModel":
      next.inference.model =
        operation.model;
      return next;

    case "setCutoutQuality":
      next.inference
        .qualityPreset =
        operation.preset;

      next.inference.model =
        qualityToModel[
          operation.preset
        ];

      return next;

    case "runBackgroundRemoval":
      if (operation.model) {
        next.inference.model =
          operation.model;
      }

      return next;

    case "setAlphaRefinement":
      next.alpha = {
        ...next.alpha,
        ...operation.update,
      };

      return next;

    case "setCrop":
      next.crop.enabled =
        true;

      next.crop.rect =
        normalizeCropRect(
          operation.rect,
        );

      return next;

    case "setCropAspectRatio":
      next.crop.enabled =
        true;

      next.crop.aspectRatio =
        operation.aspectRatio;

      next.crop.rect =
        enforceAspectRatio(
          next.crop.rect,
          operation.aspectRatio,
        );

      return next;

    case "setImageTransform":
      next.transform = {
        ...next.transform,
        ...operation.update,
      };

      next.transform.zoom =
        Math.max(
          0.01,
          next.transform.zoom,
        );

      next.transform.rotationDeg =
        normalizeRotation(
          next.transform
            .rotationDeg,
        );

      return next;

    case "flipImage":
      if (
        operation.axis ===
        "horizontal"
      ) {
        next.transform.flipX =
          !next.transform.flipX;
      } else {
        next.transform.flipY =
          !next.transform.flipY;
      }

      return next;

    case "rotateImage":
      next.transform.rotationDeg =
        normalizeRotation(
          next.transform
            .rotationDeg +
          operation.degrees,
        );

      return next;

    case "setBackground":
      next.background.mode =
        operation.mode;

      if (operation.color) {
        next.background.color =
          operation.color;
      }

      if (
        operation.imageAssetId !==
        undefined
      ) {
        next.background
          .imageAssetId =
          operation.imageAssetId;
      }

      next.export.transparent =
        operation.mode ===
        "transparent";

      return next;

    case "setCutoutExport":
      next.export = {
        ...next.export,
        ...operation.update,
        format: "png",
      };

      return next;

    case "resetCutoutNode": {
      const sourceAssetId =
        operation.preserveSource
          ? next.sourceAssetId
          : null;

      return {
        ...createDefaultSmartCutoutDocument(),
        sourceAssetId,
      };
    }
  }
}
