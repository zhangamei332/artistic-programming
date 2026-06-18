import type {
  SmartCutoutDocument,
} from "../model/types.js";

export function createInferenceRevision(
  document: SmartCutoutDocument,
  sourceRevision: string,
): string {
  return stableStringify({
    sourceRevision,
    model:
      document.inference.model,
    processOrder:
      document.inference.processOrder,
    maxInferenceDimension:
      document.inference.maxInferenceDimension,
    modelBaseUrl:
      document.inference.modelBaseUrl,
    transform:
      document.inference.processOrder ===
      "transformThenCutout"
        ? document.transform
        : null,
    crop:
      document.inference.processOrder ===
      "transformThenCutout"
        ? document.crop
        : null,
  });
}

export function createRefinementRevision(
  document: SmartCutoutDocument,
  inferenceRevision: string,
): string {
  return stableStringify({
    inferenceRevision,
    alpha: document.alpha,
  });
}

export function createRenderRevision(
  document: SmartCutoutDocument,
  refinementRevision: string,
): string {
  return stableStringify({
    refinementRevision,
    crop:
      document.inference.processOrder ===
      "cutoutThenTransform"
        ? document.crop
        : null,
    transform:
      document.inference.processOrder ===
      "cutoutThenTransform"
        ? document.transform
        : null,
    background:
      document.background,
    export:
      document.export,
  });
}

function stableStringify(
  value: unknown,
): string {
  return JSON.stringify(
    sortValue(value),
  );
}

function sortValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as
          Record<string, unknown>,
      )
        .sort(
          ([left], [right]) =>
            left.localeCompare(
              right,
            ),
        )
        .map(
          ([key, nested]) => [
            key,
            sortValue(nested),
          ],
        ),
    );
  }

  return value;
}
