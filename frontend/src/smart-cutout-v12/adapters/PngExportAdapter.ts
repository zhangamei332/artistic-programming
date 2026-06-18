export interface DownloadPngOptions {
  blob: Blob;
  fileName: string;
}

export function downloadPng(
  options: DownloadPngOptions,
): void {
  if (
    options.blob.type !==
    "image/png"
  ) {
    throw new Error(
      "Smart cutout export must be PNG.",
    );
  }

  const url =
    URL.createObjectURL(
      options.blob,
    );

  try {
    const anchor =
      document.createElement(
        "a",
      );

    anchor.href = url;
    anchor.download =
      ensurePngExtension(
        options.fileName,
      );

    anchor.click();
  } finally {
    queueMicrotask(
      () =>
        URL.revokeObjectURL(
          url,
        ),
    );
  }
}

export function ensurePngExtension(
  fileName: string,
): string {
  const trimmed =
    fileName.trim() ||
    "cutout.png";

  return trimmed
    .toLowerCase()
    .endsWith(".png")
      ? trimmed
      : `${trimmed}.png`;
}
