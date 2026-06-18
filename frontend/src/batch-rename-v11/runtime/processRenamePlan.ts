import type {
  BatchRenameDocument,
  ConflictReport,
  RenameAsset,
  RenameConflictGroup,
  RenameIssue,
  RenamePlan,
  RenamePlanEntry,
} from "../model/types.js";
import {
  applyRenameRule,
} from "../rules/applyRenameRule.js";
import {
  joinRelativePath,
  splitFileName,
} from "../rules/filename.js";
import {
  hasBlockingIssue,
  validateOutputName,
} from "./validation.js";
import {
  sortRenameAssets,
} from "./sortAssets.js";

export interface ProcessRenamePlanOptions {
  now?: Date;
}

export function processRenamePlan(
  assets: RenameAsset[],
  document: BatchRenameDocument,
  options: ProcessRenamePlanOptions = {},
): RenamePlan {
  const now =
    options.now ??
    new Date();

  const selectedIds =
    new Set(
      document.selection
        .selectedAssetIds,
    );

  const hasExplicitSelection =
    selectedIds.size > 0;

  const sorted =
    sortRenameAssets(
      assets,
      document.sort,
    );

  let entries:
    RenamePlanEntry[] =
    sorted.map(
      (
        {
          asset,
          inputIndex,
        },
        sortedIndex,
      ) => {
        const selected =
          hasExplicitSelection
            ? selectedIds.has(
                asset.id,
              )
            : asset.selected !==
              false;

        const originalSplit =
          splitFileName(
            asset.originalName,
          );

        let state = {
          stem:
            originalSplit.stem,
          extension:
            originalSplit.extension,
        };

        const issues:
          RenameIssue[] = [];

        for (
          const rule of
          document.rules
        ) {
          const result =
            applyRenameRule(
              state,
              rule,
              {
                asset,
                sortedIndex,
                now,
              },
            );

          state = result.state;
          issues.push(
            ...result.issues,
          );
        }

        const outputName =
          `${state.stem}${state.extension}`;

        issues.push(
          ...validateOutputName(
            outputName,
            asset.originalName,
            document.validation,
          ),
        );

        const outputRelativePath =
          document.validation
            .preserveRelativePath
            ? joinRelativePath(
                asset.relativePath,
                outputName,
              )
            : outputName;

        return {
          assetId: asset.id,
          inputIndex,
          sortedIndex,
          selected,
          originalName:
            asset.originalName,
          originalRelativePath:
            asset.relativePath ??
            asset.originalName,
          outputName,
          outputRelativePath,
          changed:
            outputName !==
              asset.originalName ||
            outputRelativePath !==
              (asset.relativePath ??
                asset.originalName),
          valid:
            !hasBlockingIssue(
              issues,
            ),
          issues,
          asset,
        };
      },
    );

  if (
    !document.selection
      .includeUnselectedInPreview
  ) {
    entries = entries.filter(
      (entry) => entry.selected,
    );
  }

  const conflicts =
    detectConflicts(
      entries,
      document.validation
        .caseSensitiveConflicts,
    );

  const conflictByAsset =
    new Map<
      string,
      RenameConflictGroup
    >();

  for (
    const group of
    conflicts.groups
  ) {
    for (
      const assetId of
      group.assetIds
    ) {
      conflictByAsset.set(
        assetId,
        group,
      );
    }
  }

  entries = entries.map(
    (entry) => {
      const conflict =
        conflictByAsset.get(
          entry.assetId,
        );

      if (!conflict) {
        return entry;
      }

      const issues = [
        ...entry.issues,
        {
          code:
            "duplicateOutput",
          severity: "error",
          message:
            `Multiple selected items resolve to ${conflict.outputPath}.`,
        },
      ] satisfies RenameIssue[];

      return {
        ...entry,
        issues,
        valid: false,
      };
    },
  );

  const selectedEntries =
    entries.filter(
      (entry) => entry.selected,
    );

  const validCount =
    selectedEntries.filter(
      (entry) => entry.valid,
    ).length;

  const changedCount =
    selectedEntries.filter(
      (entry) =>
        entry.changed,
    ).length;

  const invalidCount =
    selectedEntries.length -
    validCount;

  return {
    entries,
    conflicts,
    selectedCount:
      selectedEntries.length,
    validCount,
    invalidCount,
    changedCount,
    unchangedCount:
      selectedEntries.length -
      changedCount,
    ruleCount:
      document.rules.filter(
        (rule) => rule.enabled,
      ).length,
    canExecute:
      selectedEntries.length > 0 &&
      changedCount > 0 &&
      invalidCount === 0 &&
      (!document.validation
        .blockConflicts ||
        conflicts.count === 0),
  };
}

export function detectConflicts(
  entries: RenamePlanEntry[],
  caseSensitive: boolean,
): ConflictReport {
  const groups =
    new Map<
      string,
      RenamePlanEntry[]
    >();

  for (
    const entry of
    entries
  ) {
    if (!entry.selected) continue;

    const key =
      caseSensitive
        ? entry.outputRelativePath
        : entry.outputRelativePath
            .toLocaleLowerCase();

    const list =
      groups.get(key) ?? [];

    list.push(entry);
    groups.set(key, list);
  }

  const conflictGroups:
    RenameConflictGroup[] = [];

  for (
    const [key, group] of
    groups
  ) {
    if (group.length < 2) {
      continue;
    }

    conflictGroups.push({
      key,
      outputPath:
        group[0]
          .outputRelativePath,
      assetIds:
        group.map(
          (entry) =>
            entry.assetId,
        ),
    });
  }

  return {
    groups: conflictGroups,
    count:
      conflictGroups.length,
  };
}
