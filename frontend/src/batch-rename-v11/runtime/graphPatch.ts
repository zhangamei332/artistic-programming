import type {
  BatchRenameDocument,
  RenameExecutionMode,
  RenamePreset,
  RenameRule,
} from "../model/types.js";
import {
  createDefaultRenameRule,
  createRenameId,
} from "../model/defaults.js";

export type BatchRenameGraphOperation =
  | {
      op: "addRenameRule";
      nodeId: string;
      rule: RenameRule |
        RenameRule["variant"];
      beforeRuleId?: string;
    }
  | {
      op: "updateRenameRule";
      nodeId: string;
      ruleId: string;
      update: Partial<RenameRule>;
    }
  | {
      op: "removeRenameRule";
      nodeId: string;
      ruleId: string;
    }
  | {
      op: "duplicateRenameRule";
      nodeId: string;
      ruleId: string;
    }
  | {
      op: "reorderRenameRule";
      nodeId: string;
      ruleId: string;
      beforeRuleId: string | null;
    }
  | {
      op: "clearRenameRules";
      nodeId: string;
    }
  | {
      op: "applyRenamePreset";
      nodeId: string;
      preset: RenamePreset;
      replaceExisting: boolean;
    }
  | {
      op: "setRenameExecutionMode";
      nodeId: string;
      mode: RenameExecutionMode;
    }
  | {
      op: "setRenameSelection";
      nodeId: string;
      assetIds: string[];
    };

export function applyBatchRenameGraphOperation(
  document: BatchRenameDocument,
  operation: BatchRenameGraphOperation,
): BatchRenameDocument {
  const next =
    structuredClone(document);

  switch (operation.op) {
    case "addRenameRule": {
      const rule =
        typeof operation.rule ===
        "string"
          ? createDefaultRenameRule(
              operation.rule,
            )
          : structuredClone(
              operation.rule,
            );

      if (
        !rule.id
      ) {
        rule.id =
          createRenameId(
            "rename_rule",
          );
      }

      if (
        operation.beforeRuleId
      ) {
        const index =
          next.rules.findIndex(
            (entry) =>
              entry.id ===
              operation.beforeRuleId,
          );

        if (index < 0) {
          throw new Error(
            `Before rule not found: ${operation.beforeRuleId}`,
          );
        }

        next.rules.splice(
          index,
          0,
          rule,
        );
      } else {
        next.rules.push(rule);
      }

      return next;
    }

    case "updateRenameRule": {
      const index =
        next.rules.findIndex(
          (rule) =>
            rule.id ===
            operation.ruleId,
        );

      if (index < 0) {
        throw new Error(
          `Rename rule not found: ${operation.ruleId}`,
        );
      }

      next.rules[index] = {
        ...next.rules[index],
        ...operation.update,
      } as RenameRule;

      return next;
    }

    case "removeRenameRule":
      next.rules =
        next.rules.filter(
          (rule) =>
            rule.id !==
            operation.ruleId,
        );
      return next;

    case "duplicateRenameRule": {
      const index =
        next.rules.findIndex(
          (rule) =>
            rule.id ===
            operation.ruleId,
        );

      if (index < 0) {
        throw new Error(
          `Rename rule not found: ${operation.ruleId}`,
        );
      }

      const duplicate = {
        ...structuredClone(
          next.rules[index],
        ),
        id:
          createRenameId(
            "rename_rule",
          ),
      } as RenameRule;

      next.rules.splice(
        index + 1,
        0,
        duplicate,
      );

      return next;
    }

    case "reorderRenameRule": {
      const source =
        next.rules.find(
          (rule) =>
            rule.id ===
            operation.ruleId,
        );

      if (!source) {
        throw new Error(
          `Rename rule not found: ${operation.ruleId}`,
        );
      }

      next.rules =
        next.rules.filter(
          (rule) =>
            rule.id !==
            operation.ruleId,
        );

      if (
        operation.beforeRuleId ===
        null
      ) {
        next.rules.push(source);
      } else {
        const targetIndex =
          next.rules.findIndex(
            (rule) =>
              rule.id ===
              operation.beforeRuleId,
          );

        if (targetIndex < 0) {
          throw new Error(
            `Before rule not found: ${operation.beforeRuleId}`,
          );
        }

        next.rules.splice(
          targetIndex,
          0,
          source,
        );
      }

      return next;
    }

    case "clearRenameRules":
      next.rules = [];
      return next;

    case "applyRenamePreset": {
      const presetRules =
        operation.preset.rules.map(
          (rule) => ({
            ...structuredClone(rule),
            id:
              createRenameId(
                "rename_rule",
              ),
          }),
        );

      next.rules =
        operation.replaceExisting
          ? presetRules
          : [
              ...next.rules,
              ...presetRules,
            ];

      return next;
    }

    case "setRenameExecutionMode":
      next.executionMode =
        operation.mode;
      return next;

    case "setRenameSelection":
      next.selection
        .selectedAssetIds =
        [...operation.assetIds];
      return next;
  }
}
