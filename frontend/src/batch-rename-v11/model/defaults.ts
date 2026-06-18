import type {
  BatchRenameDocument,
  RenameRule,
  RenameRuleVariant,
} from "./types.js";

export function createRenameId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}_${randomId}`;
}

export function createDefaultBatchRenameDocument(): BatchRenameDocument {
  return {
    version: 11,
    rules: [],
    selection: {
      selectedAssetIds: [],
      includeUnselectedInPreview: true,
    },
    sort: {
      key: "inputOrder",
      direction: "ascending",
    },
    executionMode: "virtual",
    validation: {
      platform: "windows",
      maxNameLength: 255,
      blockConflicts: true,
      preserveExtension: true,
      caseSensitiveConflicts: false,
      preserveRelativePath: true,
    },
  };
}

export function createDefaultRenameRule(
  variant: RenameRuleVariant,
): RenameRule {
  const base = {
    id: createRenameId("rename_rule"),
    enabled: true,
  } as const;

  switch (variant) {
    case "findReplace":
      return {
        ...base,
        variant,
        find: "",
        replace: "",
        caseSensitive: false,
        replaceAll: true,
      };

    case "regexReplace":
      return {
        ...base,
        variant,
        pattern: "",
        replacement: "",
        flags: "gi",
      };

    case "prefix":
      return {
        ...base,
        variant,
        text: "",
      };

    case "suffix":
      return {
        ...base,
        variant,
        text: "",
      };

    case "insert":
      return {
        ...base,
        variant,
        text: "",
        index: 0,
      };

    case "remove":
      return {
        ...base,
        variant,
        mode: "first",
        count: 1,
        start: 0,
        end: 1,
        characters: "",
        pattern: "",
      };

    case "sequence":
      return {
        ...base,
        variant,
        position: "prefix",
        start: 1,
        step: 1,
        padding: 3,
        separator: "_",
        format: "{index}",
      };

    case "caseStyle":
      return {
        ...base,
        variant,
        style: "lowercase",
      };

    case "extension":
      return {
        ...base,
        variant,
        action: "lowercase",
        extension: "",
      };

    case "dateTime":
      return {
        ...base,
        variant,
        source: "current",
        format: "YYYY-MM-DD",
        position: "prefix",
        separator: "_",
      };

    case "cleanup":
      return {
        ...base,
        variant,
        trimSpaces: true,
        collapseSpaces: true,
        removeCharacters: "",
        replaceSpacesWith: "_",
        removeRepeatedSeparators: true,
      };

    case "template":
      return {
        ...base,
        variant,
        template: "{name}_{index:000}",
        start: 1,
        step: 1,
      };
  }
}
