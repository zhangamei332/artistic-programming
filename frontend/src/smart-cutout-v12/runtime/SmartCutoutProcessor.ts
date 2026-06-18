import type {
  AlphaMask,
  CutoutProgress,
  ImageAssetLike,
  SmartCutoutDocument,
  SmartCutoutResult,
} from "../model/types.js";
import {
  createInferenceRevision,
  createRefinementRevision,
  createRenderRevision,
} from "../core/cacheKeys.js";
import {
  refineAlphaMask,
} from "../core/maskRefinement.js";
import {
  resolveOutputSize,
} from "../core/transformMath.js";
import type {
  BackgroundRemovalEngine,
} from "../adapters/RembgWebAdapter.js";
import {
  blobToImageData,
  extractAlphaMaskFromImageData,
} from "../adapters/ImageDecodeAdapter.js";
import {
  renderCutout,
} from "../adapters/CanvasRenderAdapter.js";

export interface SmartCutoutProcessorDependencies {
  backgroundRemoval:
    BackgroundRemovalEngine;
  resolveAsset(
    assetId: string,
  ): Promise<ImageAssetLike | undefined>;
  resolveBackgroundImage?(
    assetId: string,
  ): Promise<CanvasImageSource | undefined>;
}

interface SegmentationCacheEntry {
  revision: string;
  transparentBlob: Blob;
  imageData: ImageData;
  rawMask: AlphaMask;
  processingMs: number;
}

interface RefinementCacheEntry {
  revision: string;
  mask: AlphaMask;
}

interface RenderCacheEntry {
  revision: string;
  result: SmartCutoutResult;
}

export class SmartCutoutProcessor {
  private segmentationCache?: SegmentationCacheEntry;
  private refinementCache?: RefinementCacheEntry;
  private renderCache?: RenderCacheEntry;

  public constructor(
    private readonly dependencies:
      SmartCutoutProcessorDependencies,
  ) {}

  public async process(
    document: SmartCutoutDocument,
    options: {
      sourceRevision?: string;
      signal?: AbortSignal;
      onProgress?: (
        progress: CutoutProgress,
      ) => void;
    } = {},
  ): Promise<SmartCutoutResult> {
    if (!document.sourceAssetId) {
      throw new Error(
        "No source image is connected.",
      );
    }

    const source =
      await this.dependencies.resolveAsset(
        document.sourceAssetId,
      );

    if (!source) {
      throw new Error(
        `Image asset not found: ${document.sourceAssetId}`,
      );
    }

    const sourceBlob =
      source.blob ??
      source.file;

    if (!sourceBlob) {
      throw new Error(
        "Source image has no Blob or File.",
      );
    }

    const sourceRevision =
      options.sourceRevision ??
      [
        source.id,
        source.name,
        sourceBlob.size,
        sourceBlob.type,
      ].join(":");

    const inferenceRevision =
      createInferenceRevision(
        document,
        sourceRevision,
      );

    const segmentation =
      await this.ensureSegmentation(
        sourceBlob,
        document,
        inferenceRevision,
        options,
      );

    const refinementRevision =
      createRefinementRevision(
        document,
        inferenceRevision,
      );

    const refined =
      this.ensureRefinedMask(
        segmentation,
        document,
        refinementRevision,
        options.onProgress,
      );

    const renderRevision =
      createRenderRevision(
        document,
        refinementRevision,
      );

    if (
      this.renderCache?.revision ===
      renderRevision
    ) {
      return this.renderCache.result;
    }

    options.onProgress?.({
      stage: "rendering",
      progress: 0.92,
      message:
        "Rendering transparent PNG",
    });

    const outputSize =
      resolveOutputSize(
        segmentation.imageData.width,
        segmentation.imageData.height,
        document.transform,
        document.export.width,
        document.export.height,
        document.export
          .preserveAspectRatio,
        document.export.scale,
      );

    const backgroundImage =
      document.background.mode ===
        "image" &&
      document.background.imageAssetId &&
      this.dependencies
        .resolveBackgroundImage
        ? await this.dependencies.resolveBackgroundImage(
            document.background
              .imageAssetId,
          )
        : undefined;

    const rendered =
      await renderCutout({
        foreground:
          segmentation.imageData,
        alphaMask: refined.mask,
        crop: document.crop,
        transform:
          document.transform,
        background:
          document.background,
        outputWidth:
          outputSize.width,
        outputHeight:
          outputSize.height,
        backgroundImage,
      });

    const result:
      SmartCutoutResult = {
      imageBlob: rendered.blob,
      transparentPng:
        rendered.blob,
      alphaMask: refined.mask,
      metadata: {
        width:
          outputSize.width,
        height:
          outputSize.height,
        mimeType: "image/png",
        transparent:
          document.background.mode ===
            "transparent" &&
          document.export.transparent,
        model:
          document.inference.model,
        processingMs:
          segmentation.processingMs,
      },
    };

    this.renderCache = {
      revision:
        renderRevision,
      result,
    };

    options.onProgress?.({
      stage: "complete",
      progress: 1,
      message:
        "Cutout complete",
    });

    return result;
  }

  public invalidateAll(): void {
    this.segmentationCache = undefined;
    this.refinementCache = undefined;
    this.renderCache = undefined;
  }

  public invalidateRender(): void {
    this.renderCache = undefined;
  }

  public async dispose(): Promise<void> {
    this.invalidateAll();
    await this.dependencies
      .backgroundRemoval
      .dispose();
  }

  private async ensureSegmentation(
    source: Blob | File,
    document: SmartCutoutDocument,
    revision: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (
        progress: CutoutProgress,
      ) => void;
    },
  ): Promise<SegmentationCacheEntry> {
    if (
      this.segmentationCache
        ?.revision === revision
    ) {
      return this.segmentationCache;
    }

    const started =
      performance.now();

    const transparentBlob =
      await this.dependencies
        .backgroundRemoval
        .removeBackground({
          input: source,
          model:
            document.inference.model,
          modelBaseUrl:
            document.inference
              .modelBaseUrl,
          preferWebNN:
            document.inference
              .preferWebNN,
          preferWebGPU:
            document.inference
              .preferWebGPU,
          signal: options.signal,
          onProgress:
            options.onProgress,
        });

    options.onProgress?.({
      stage: "decoding",
      progress: 0.86,
      message:
        "Decoding transparent result",
    });

    const imageData =
      await blobToImageData(
        transparentBlob,
      );

    const rawMask =
      extractAlphaMaskFromImageData(
        imageData,
      );

    const entry:
      SegmentationCacheEntry = {
      revision,
      transparentBlob,
      imageData,
      rawMask,
      processingMs:
        performance.now() -
        started,
    };

    this.segmentationCache =
      entry;

    this.refinementCache =
      undefined;

    this.renderCache =
      undefined;

    return entry;
  }

  private ensureRefinedMask(
    segmentation:
      SegmentationCacheEntry,
    document:
      SmartCutoutDocument,
    revision: string,
    onProgress:
      | ((
          progress:
            CutoutProgress,
        ) => void)
      | undefined,
  ): RefinementCacheEntry {
    if (
      this.refinementCache
        ?.revision === revision
    ) {
      return this.refinementCache;
    }

    onProgress?.({
      stage:
        "refining-mask",
      progress: 0.88,
      message:
        "Refining cutout edges",
    });

    const mask =
      refineAlphaMask(
        segmentation.rawMask,
        document.alpha,
      );

    const entry:
      RefinementCacheEntry = {
      revision,
      mask,
    };

    this.refinementCache =
      entry;

    this.renderCache =
      undefined;

    return entry;
  }
}
