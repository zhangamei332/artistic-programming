import type {
  RenameAsset,
  RenameSort,
} from "../model/types.js";
import {
  extractType,
  splitFileName,
} from "../rules/filename.js";

export interface IndexedRenameAsset {
  asset: RenameAsset;
  inputIndex: number;
}

export function sortRenameAssets(
  assets: RenameAsset[],
  sort: RenameSort,
): IndexedRenameAsset[] {
  const indexed = assets.map(
    (asset, inputIndex) => ({
      asset,
      inputIndex,
    }),
  );

  const key = sort.key;

  if (
    key === "inputOrder"
  ) {
    return sort.direction ===
      "ascending"
      ? indexed
      : indexed.reverse();
  }

  const direction =
    sort.direction ===
    "ascending"
      ? 1
      : -1;

  return indexed.sort(
    (left, right) => {
      const compared = compare(
        left.asset,
        right.asset,
        key,
      );

      return (
        compared * direction ||
        left.inputIndex -
          right.inputIndex
      );
    },
  );
}

function compare(
  left: RenameAsset,
  right: RenameAsset,
  key: Exclude<
    RenameSort["key"],
    "inputOrder"
  >,
): number {
  switch (key) {
    case "originalName":
      return left.originalName.localeCompare(
        right.originalName,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );

    case "size":
      return (
        (left.size ?? 0) -
        (right.size ?? 0)
      );

    case "lastModified":
      return (
        (left.lastModified ?? 0) -
        (right.lastModified ?? 0)
      );

    case "type": {
      const leftSplit =
        splitFileName(
          left.originalName,
        );

      const rightSplit =
        splitFileName(
          right.originalName,
        );

      return extractType(
        left.mimeType,
        leftSplit.extension,
      ).localeCompare(
        extractType(
          right.mimeType,
          rightSplit.extension,
        ),
      );
    }
  }
}
