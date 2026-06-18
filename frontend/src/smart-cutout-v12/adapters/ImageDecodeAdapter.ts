export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  mimeType: string;
  dispose(): void;
}

export async function decodeImage(
  source: Blob | File,
): Promise<DecodedImage> {
  const bitmap =
    await createImageBitmap(
      source,
      {
        imageOrientation:
          "from-image",
        premultiplyAlpha:
          "premultiply",
        colorSpaceConversion:
          "default",
      },
    );

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    mimeType:
      source.type ||
      "application/octet-stream",
    dispose() {
      bitmap.close();
    },
  };
}

export async function blobToImageData(
  blob: Blob,
): Promise<ImageData> {
  const decoded =
    await decodeImage(blob);

  try {
    const canvas =
      createCanvas(
        decoded.width,
        decoded.height,
      );

    const context =
      get2d(canvas);

    context.drawImage(
      decoded.bitmap,
      0,
      0,
    );

    return context.getImageData(
      0,
      0,
      decoded.width,
      decoded.height,
    );
  } finally {
    decoded.dispose();
  }
}

export function extractAlphaMaskFromImageData(
  imageData: ImageData,
): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const alpha =
    new Uint8ClampedArray(
      imageData.width *
      imageData.height,
    );

  for (
    let pixel = 0;
    pixel < alpha.length;
    pixel += 1
  ) {
    alpha[pixel] =
      imageData.data[
        pixel * 4 + 3
      ];
  }

  return {
    width: imageData.width,
    height: imageData.height,
    data: alpha,
  };
}

export function applyAlphaMaskToImageData(
  imageData: ImageData,
  alpha: Uint8ClampedArray,
): ImageData {
  const output =
    new ImageData(
      new Uint8ClampedArray(
        imageData.data,
      ),
      imageData.width,
      imageData.height,
    );

  if (
    alpha.length !==
    imageData.width *
      imageData.height
  ) {
    throw new Error(
      "Alpha mask size does not match image.",
    );
  }

  for (
    let pixel = 0;
    pixel < alpha.length;
    pixel += 1
  ) {
    output.data[
      pixel * 4 + 3
    ] = alpha[pixel];
  }

  return output;
}

export function createCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (
    typeof OffscreenCanvas !==
    "undefined"
  ) {
    return new OffscreenCanvas(
      width,
      height,
    );
  }

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

export function get2d(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true,
      },
    );

  if (!context) {
    throw new Error(
      "Canvas 2D context is unavailable.",
    );
  }

  return context;
}

export async function canvasToPngBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> {
  if (
    "convertToBlob" in canvas
  ) {
    return canvas.convertToBlob({
      type: "image/png",
    });
  }

  return new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "PNG export failed.",
              ),
            );
          }
        },
        "image/png",
      );
    },
  );
}
