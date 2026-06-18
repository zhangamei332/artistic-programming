import Cropper from "cropperjs";
import type {
  ImageTransform,
  NormalizedCropRect,
} from "../model/types.js";
import {
  pixelCropToNormalized,
} from "../core/cropMath.js";

interface CropperImageElement
  extends HTMLElement {
  $ready?(
    callback?:
      (image: HTMLImageElement) => void,
  ): Promise<HTMLImageElement>;
  $center?(
    size?: "contain" | "cover",
  ): this;
  $move?(
    x: number,
    y?: number,
  ): this;
  $moveTo?(
    x: number,
    y?: number,
  ): this;
  $rotate?(
    angle: number | string,
    x?: number,
    y?: number,
  ): this;
  $scale?(
    x: number,
    y?: number,
  ): this;
  $zoom?(
    scale: number,
    x?: number,
    y?: number,
  ): this;
  $resetTransform?(): this;
}

interface CropperSelectionElement
  extends HTMLElement {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: number;
  $change?(
    x: number,
    y: number,
    width?: number,
    height?: number,
    aspectRatio?: number,
  ): this;
  $reset?(): this;
  $toCanvas?(
    options?: {
      width?: number;
      height?: number;
      beforeDraw?: (
        context:
          CanvasRenderingContext2D,
        canvas:
          HTMLCanvasElement,
      ) => void;
    },
  ): Promise<HTMLCanvasElement>;
}

export interface CropperWorkspaceChange {
  crop: NormalizedCropRect;
  matrix: number[];
}

export class CropperWorkspaceAdapter {
  private cropper?: Cropper;
  private cropperImage?: CropperImageElement;
  private selection?: CropperSelectionElement;
  private container?: HTMLElement;
  private sourceImage?: HTMLImageElement;
  private listeners: Array<() => void> = [];

  public mount(
    container: HTMLElement,
    sourceUrl: string,
    onChange: (
      change: CropperWorkspaceChange,
    ) => void,
  ): void {
    this.destroy();

    this.container =
      container;

    const image =
      new Image();

    image.src = sourceUrl;
    image.alt =
      "Smart cutout source";

    this.sourceImage =
      image;

    this.cropper =
      new Cropper(
        image,
        {
          container,
        },
      );

    this.cropperImage =
      this.cropper
        .getCropperImage() as
        CropperImageElement |
        null ??
      undefined;

    this.selection =
      this.cropper
        .getCropperSelection() as
        CropperSelectionElement |
        null ??
      undefined;

    const onSelection =
      (event: Event) => {
        const detail =
          (
            event as CustomEvent<{
              x: number;
              y: number;
              width: number;
              height: number;
            }>
          ).detail;

        const canvas =
          this.cropper
            ?.getCropperCanvas();

        if (
          !detail ||
          !canvas
        ) {
          return;
        }

        const bounds =
          canvas.getBoundingClientRect();

        onChange({
          crop:
            pixelCropToNormalized(
              detail,
              bounds.width,
              bounds.height,
            ),
          matrix:
            this.readTransformMatrix(),
        });
      };

    const onTransform =
      (event: Event) => {
        const detail =
          (
            event as CustomEvent<{
              matrix: number[];
            }>
          ).detail;

        const crop =
          this.readNormalizedCrop();

        onChange({
          crop,
          matrix:
            detail?.matrix ??
            this.readTransformMatrix(),
        });
      };

    this.selection
      ?.addEventListener(
        "change",
        onSelection,
      );

    this.cropperImage
      ?.addEventListener(
        "transform",
        onTransform,
      );

    this.listeners.push(
      () =>
        this.selection
          ?.removeEventListener(
            "change",
            onSelection,
          ),
      () =>
        this.cropperImage
          ?.removeEventListener(
            "transform",
            onTransform,
          ),
    );
  }

  public setAspectRatio(
    ratio: number | null,
  ): void {
    if (!this.selection) return;

    this.selection.aspectRatio =
      ratio ?? Number.NaN;
  }

  public rotate(
    degrees: number,
  ): void {
    this.cropperImage
      ?.$rotate?.(
        `${degrees}deg`,
      );
  }

  public zoom(
    delta: number,
  ): void {
    this.cropperImage
      ?.$zoom?.(delta);
  }

  public move(
    x: number,
    y: number,
  ): void {
    this.cropperImage
      ?.$move?.(
        x,
        y,
      );
  }

  public setFlip(
    flipX: boolean,
    flipY: boolean,
    zoom = 1,
  ): void {
    this.cropperImage
      ?.$scale?.(
        zoom *
          (flipX
            ? -1
            : 1),
        zoom *
          (flipY
            ? -1
            : 1),
      );
  }

  public applyTransform(
    transform: ImageTransform,
  ): void {
    this.cropperImage
      ?.$resetTransform?.();

    this.cropperImage
      ?.$scale?.(
        transform.zoom *
          (transform.flipX
            ? -1
            : 1),
        transform.zoom *
          (transform.flipY
            ? -1
            : 1),
      );

    this.cropperImage
      ?.$rotate?.(
        `${transform.rotationDeg}deg`,
      );

    this.cropperImage
      ?.$move?.(
        transform.translateX,
        transform.translateY,
      );
  }

  public reset(): void {
    this.cropperImage
      ?.$resetTransform?.();

    this.cropperImage
      ?.$center?.(
        "contain",
      );

    this.selection
      ?.$reset?.();
  }

  public async exportSelection(
    width?: number,
    height?: number,
  ): Promise<HTMLCanvasElement> {
    if (
      !this.selection
        ?.$toCanvas
    ) {
      throw new Error(
        "Cropper selection is unavailable.",
      );
    }

    return this.selection
      .$toCanvas({
        width,
        height,
      });
  }

  public destroy(): void {
    for (
      const cleanup of
      this.listeners
    ) {
      cleanup();
    }

    this.listeners = [];

    this.cropper?.destroy();

    this.cropper =
      undefined;

    this.cropperImage =
      undefined;

    this.selection =
      undefined;

    this.container =
      undefined;

    this.sourceImage =
      undefined;
  }

  private readNormalizedCrop(): NormalizedCropRect {
    const canvas =
      this.cropper
        ?.getCropperCanvas();

    if (
      !canvas ||
      !this.selection
    ) {
      return {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      };
    }

    const bounds =
      canvas.getBoundingClientRect();

    return pixelCropToNormalized(
      {
        x:
          this.selection.x,
        y:
          this.selection.y,
        width:
          this.selection.width,
        height:
          this.selection.height,
      },
      bounds.width,
      bounds.height,
    );
  }

  private readTransformMatrix(): number[] {
    const transform =
      getComputedStyle(
        this.cropperImage ??
        document.documentElement,
      ).transform;

    if (
      !transform ||
      transform === "none"
    ) {
      return [
        1,
        0,
        0,
        1,
        0,
        0,
      ];
    }

    const matrix =
      new DOMMatrix(
        transform,
      );

    return [
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f,
    ];
  }
}
