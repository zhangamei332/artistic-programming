import type {
  RenameAsset,
  RenamePlan,
  RenamedAsset,
} from "../model/types.js";

export function applyVirtualRenamePlan(
  assets: RenameAsset[],
  plan: RenamePlan,
): RenamedAsset[] {
  const entryById =
    new Map(
      plan.entries.map(
        (entry) => [
          entry.assetId,
          entry,
        ],
      ),
    );

  return assets.map(
    (asset) => {
      const entry =
        entryById.get(
          asset.id,
        );

      if (
        !entry ||
        !entry.selected ||
        !entry.valid
      ) {
        return {
          ...asset,
          displayName:
            asset.originalName,
          exportName:
            asset.originalName,
          exportRelativePath:
            asset.relativePath ??
            asset.originalName,
        };
      }

      return {
        ...asset,
        displayName:
          entry.outputName,
        exportName:
          entry.outputName,
        exportRelativePath:
          entry.outputRelativePath,
      };
    },
  );
}
