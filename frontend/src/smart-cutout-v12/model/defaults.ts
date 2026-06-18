import type {
  CutoutModel,
  CutoutQualityPreset,
  SmartCutoutDocument,
} from "./types.js";

export const qualityToModel:
  Record<CutoutQualityPreset, CutoutModel> = {
  fast: "u2netp",
  standard: "u2net",
  portrait: "u2net_human_seg",
  clothing: "u2net_cloth_seg",
  highQuality: "isnet-general-use",
  anime: "isnet-anime",
};

export function createDefaultSmartCutoutDocument(): SmartCutoutDocument {
  return {
    version: 12,
    sourceAssetId: null,
    backgroundAssetId: null,

    inference: {
      model: "u2netp",
      qualityPreset: "fast",
      processOrder: "cutoutThenTransform",
      autoRun: false,
      maxInferenceDimension: 2048,
      preferWebNN: false,
      preferWebGPU: false,
      modelBaseUrl: "/models/rembg",
      keepRawResult: true,
    },

    alpha: {
      threshold: 0,
      featherRadius: 0,
      erodeRadius: 0,
      dilateRadius: 0,
      removeSmallRegions: 0,
      decontaminateEdges: 0,
      invert: false,
    },

    crop: {
      enabled: false,
      rect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
      aspectRatio: null,
      padding: 0,
      fitSubject: false,
    },

    transform: {
      translateX: 0,
      translateY: 0,
      zoom: 1,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
    },

    background: {
      mode: "transparent",
      color: "#ffffff",
      imageAssetId: null,
      fit: "cover",
      blur: 0,
      brightness: 1,
      subjectShadow: {
        enabled: false,
        color: "#000000",
        opacity: 0.25,
        blur: 24,
        offsetX: 0,
        offsetY: 12,
      },
    },

    export: {
      format: "png",
      fileName: "cutout.png",
      transparent: true,
      scale: 1,
      width: null,
      height: null,
      preserveAspectRatio: true,
      writeToAssetLibrary: true,
    },

    preview: {
      checkerboard: true,
      showAlpha: false,
      compareBeforeAfter: false,
    },
  };
}
