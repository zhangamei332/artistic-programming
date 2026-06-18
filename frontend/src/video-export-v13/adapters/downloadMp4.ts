export function downloadMp4(
  blob: Blob,
  fileName: string,
): void {
  if (
    blob.type &&
    blob.type !== "video/mp4"
  ) {
    throw new Error(
      `Expected video/mp4, received ${blob.type}.`,
    );
  }

  const url =
    URL.createObjectURL(blob);

  try {
    const anchor =
      document.createElement(
        "a",
      );

    anchor.href = url;
    anchor.download =
      fileName
        .toLowerCase()
        .endsWith(".mp4")
        ? fileName
        : `${fileName}.mp4`;

    anchor.rel = "noopener";
    anchor.click();
  } finally {
    window.setTimeout(
      () =>
        URL.revokeObjectURL(
          url,
        ),
      0,
    );
  }
}
