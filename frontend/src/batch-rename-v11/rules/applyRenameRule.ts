import type {
  RenameAsset,
  RenameIssue,
  RenameRule,
} from "../model/types.js";
import {
  applyCaseStyle,
} from "./caseStyle.js";
import {
  formatRenameDate,
} from "./dateFormat.js";
import {
  normalizeExtension,
  splitFileName,
} from "./filename.js";
import {
  renderRenameTemplate,
} from "./template.js";

export interface RenameNameState {
  stem: string;
  extension: string;
}

export interface ApplyRenameRuleContext {
  asset: RenameAsset;
  sortedIndex: number;
  now: Date;
}

export interface ApplyRenameRuleResult {
  state: RenameNameState;
  issues: RenameIssue[];
}

export function applyRenameRule(
  input: RenameNameState,
  rule: RenameRule,
  context: ApplyRenameRuleContext,
): ApplyRenameRuleResult {
  if (!rule.enabled) {
    return {
      state: input,
      issues: [],
    };
  }

  const state = {
    ...input,
  };

  try {
    switch (rule.variant) {
      case "findReplace":
        state.stem = applyFindReplace(
          state.stem,
          rule.find,
          rule.replace,
          rule.caseSensitive,
          rule.replaceAll,
        );
        break;

      case "regexReplace": {
        if (!rule.pattern) break;

        const safeFlags =
          sanitizeRegexFlags(
            rule.flags,
          );

        state.stem = state.stem.replace(
          new RegExp(
            rule.pattern,
            safeFlags,
          ),
          rule.replacement,
        );
        break;
      }

      case "prefix":
        state.stem =
          rule.text + state.stem;
        break;

      case "suffix":
        state.stem =
          state.stem + rule.text;
        break;

      case "insert": {
        const index = clampInteger(
          rule.index,
          0,
          state.stem.length,
        );

        state.stem =
          state.stem.slice(0, index) +
          rule.text +
          state.stem.slice(index);
        break;
      }

      case "remove":
        state.stem =
          applyRemove(
            state.stem,
            rule,
          );
        break;

      case "sequence": {
        const value =
          rule.start +
          context.sortedIndex *
            rule.step;

        const padded = Math.trunc(value)
          .toString()
          .padStart(
            Math.max(0, rule.padding),
            "0",
          );

        const formatted =
          rule.format.includes("{index}")
            ? rule.format.replaceAll(
                "{index}",
                padded,
              )
            : padded;

        if (
          rule.position === "prefix"
        ) {
          state.stem =
            formatted +
            rule.separator +
            state.stem;
        } else if (
          rule.position === "suffix"
        ) {
          state.stem =
            state.stem +
            rule.separator +
            formatted;
        } else {
          state.stem = formatted;
        }

        break;
      }

      case "caseStyle":
        state.stem =
          applyCaseStyle(
            state.stem,
            rule.style,
          );
        break;

      case "extension":
        state.extension =
          applyExtension(
            state.extension,
            rule.action,
            rule.extension,
          );
        break;

      case "dateTime": {
        const sourceDate =
          rule.source === "modified" &&
          context.asset.lastModified
            ? new Date(
                context.asset.lastModified,
              )
            : context.now;

        const formatted =
          formatRenameDate(
            sourceDate,
            rule.format,
          );

        if (
          rule.position === "prefix"
        ) {
          state.stem =
            formatted +
            rule.separator +
            state.stem;
        } else if (
          rule.position === "suffix"
        ) {
          state.stem =
            state.stem +
            rule.separator +
            formatted;
        } else {
          state.stem = formatted;
        }

        break;
      }

      case "cleanup":
        state.stem =
          applyCleanup(
            state.stem,
            rule,
          );
        break;

      case "template": {
        const number =
          rule.start +
          context.sortedIndex *
            rule.step;

        const rendered =
          renderRenameTemplate(
            rule.template,
            {
              asset: context.asset,
              stem: state.stem,
              extension:
                state.extension,
              index: number,
              date: context.now,
            },
          );

        if (
          rule.template.includes(
            "{ext",
          )
        ) {
          const split =
            splitFileName(rendered);

          state.stem = split.stem;
          state.extension =
            split.extension;
        } else {
          state.stem = rendered;
        }

        break;
      }
    }

    return {
      state,
      issues: [],
    };
  } catch (error) {
    return {
      state: input,
      issues: [
        {
          code:
            rule.variant ===
            "regexReplace"
              ? "invalidRegex"
              : "ruleError",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown rename rule error",
          ruleId: rule.id,
        },
      ],
    };
  }
}

function applyFindReplace(
  input: string,
  find: string,
  replace: string,
  caseSensitive: boolean,
  replaceAll: boolean,
): string {
  if (!find) return input;

  const flags = [
    replaceAll ? "g" : "",
    caseSensitive ? "" : "i",
    "u",
  ].join("");

  return input.replace(
    new RegExp(
      escapeRegex(find),
      flags,
    ),
    replace,
  );
}

function applyRemove(
  input: string,
  rule: Extract<
    RenameRule,
    { variant: "remove" }
  >,
): string {
  switch (rule.mode) {
    case "first":
      return input.slice(
        Math.max(0, rule.count),
      );

    case "last": {
      const count =
        Math.max(0, rule.count);

      return count === 0
        ? input
        : input.slice(0, -count);
    }

    case "range": {
      const start = clampInteger(
        rule.start,
        0,
        input.length,
      );

      const end = clampInteger(
        rule.end,
        start,
        input.length,
      );

      return (
        input.slice(0, start) +
        input.slice(end)
      );
    }

    case "specific": {
      const chars =
        new Set(
          Array.from(
            rule.characters,
          ),
        );

      return Array.from(input)
        .filter(
          (character) =>
            !chars.has(character),
        )
        .join("");
    }

    case "pattern":
      if (!rule.pattern) return input;

      return input.replace(
        new RegExp(
          rule.pattern,
          "gu",
        ),
        "",
      );
  }
}

function applyExtension(
  extension: string,
  action:
    | "lowercase"
    | "uppercase"
    | "change"
    | "add"
    | "remove",
  nextExtension: string,
): string {
  switch (action) {
    case "lowercase":
      return extension.toLowerCase();

    case "uppercase":
      return extension.toUpperCase();

    case "change":
      return normalizeExtension(
        nextExtension,
      );

    case "add":
      return (
        extension +
        normalizeExtension(
          nextExtension,
        )
      );

    case "remove":
      return "";
  }
}

function applyCleanup(
  input: string,
  rule: Extract<
    RenameRule,
    { variant: "cleanup" }
  >,
): string {
  let output = input;

  if (rule.trimSpaces) {
    output = output.trim();
  }

  if (rule.collapseSpaces) {
    output = output.replace(
      /\s+/gu,
      " ",
    );
  }

  if (rule.removeCharacters) {
    const chars =
      new Set(
        Array.from(
          rule.removeCharacters,
        ),
      );

    output = Array.from(output)
      .filter(
        (character) =>
          !chars.has(character),
      )
      .join("");
  }

  if (
    rule.replaceSpacesWith !== ""
  ) {
    output = output.replace(
      /\s/gu,
      rule.replaceSpacesWith,
    );
  }

  if (
    rule.removeRepeatedSeparators
  ) {
    output = output.replace(
      /([_\-.])\1+/gu,
      "$1",
    );
  }

  return output;
}

function sanitizeRegexFlags(
  flags: string,
): string {
  const allowed =
    new Set([
      "g",
      "i",
      "m",
      "s",
      "u",
      "y",
    ]);

  return Array.from(
    new Set(
      Array.from(flags).filter(
        (flag) =>
          allowed.has(flag),
      ),
    ),
  ).join("");
}

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function clampInteger(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(
      max,
      Math.trunc(value),
    ),
  );
}
