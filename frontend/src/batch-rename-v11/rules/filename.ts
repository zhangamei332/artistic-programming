export interface SplitFileName {
  stem: string;
  extension: string;
}

export function splitFileName(
  fileName: string,
): SplitFileName {
  const slashIndex = Math.max(
    fileName.lastIndexOf("/"),
    fileName.lastIndexOf("\\"),
  );

  const name =
    slashIndex >= 0
      ? fileName.slice(slashIndex + 1)
      : fileName;

  const lastDot = name.lastIndexOf(".");

  if (
    lastDot <= 0 ||
    lastDot === name.length - 1
  ) {
    return {
      stem: name,
      extension:
        lastDot === name.length - 1
          ? "."
          : "",
    };
  }

  return {
    stem: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  };
}

export function normalizeExtension(
  extension: string,
): string {
  const trimmed = extension.trim();

  if (!trimmed) return "";

  return trimmed.startsWith(".")
    ? trimmed
    : `.${trimmed}`;
}

export function joinRelativePath(
  relativePath: string | undefined,
  fileName: string,
): string {
  const folder = extractFolder(relativePath);
  return folder
    ? `${folder}/${fileName}`
    : fileName;
}

export function extractFolder(
  relativePath: string | undefined,
): string {
  if (!relativePath) return "";

  const normalized =
    relativePath.replaceAll("\\", "/");

  const slash =
    normalized.lastIndexOf("/");

  return slash >= 0
    ? normalized.slice(0, slash)
    : "";
}

export function extractType(
  mimeType: string | undefined,
  extension: string,
): string {
  if (mimeType) {
    const slash = mimeType.indexOf("/");
    return slash >= 0
      ? mimeType.slice(0, slash)
      : mimeType;
  }

  return extension
    .replace(/^\./, "")
    .toLowerCase();
}
