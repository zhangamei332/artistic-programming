import type {
  RenameIssue,
  RenamePlatform,
  RenameValidationOptions,
} from "../model/types.js";
import {
  splitFileName,
} from "../rules/filename.js";

const WINDOWS_RESERVED =
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;

export function validateOutputName(
  outputName: string,
  originalName: string,
  options: RenameValidationOptions,
): RenameIssue[] {
  const issues: RenameIssue[] = [];
  const split =
    splitFileName(outputName);

  if (!split.stem.trim()) {
    issues.push({
      code: "emptyName",
      severity: "error",
      message:
        "Filename stem cannot be empty.",
    });
  }

  const invalid =
    invalidCharacterPattern(
      options.platform,
    );

  if (invalid.test(outputName)) {
    issues.push({
      code: "invalidCharacters",
      severity: "error",
      message:
        `Filename contains characters not allowed on ${options.platform}.`,
    });
  }

  if (
    options.platform === "windows" &&
    WINDOWS_RESERVED.test(
      outputName.trim(),
    )
  ) {
    issues.push({
      code: "reservedName",
      severity: "error",
      message:
        "Filename uses a reserved Windows device name.",
    });
  }

  if (
    options.platform === "windows" &&
    /[. ]$/u.test(outputName)
  ) {
    issues.push({
      code: "trailingSpaceOrPeriod",
      severity: "error",
      message:
        "Windows filenames cannot end with a space or period.",
    });
  }

  if (
    outputName.length >
    options.maxNameLength
  ) {
    issues.push({
      code: "nameTooLong",
      severity: "error",
      message:
        `Filename exceeds ${options.maxNameLength} characters.`,
    });
  }

  const original =
    splitFileName(originalName);

  if (
    options.preserveExtension &&
    original.extension &&
    !split.extension
  ) {
    issues.push({
      code: "extensionRemoved",
      severity: "warning",
      message:
        "The original extension was removed.",
    });
  }

  if (outputName === originalName) {
    issues.push({
      code: "unchanged",
      severity: "info",
      message:
        "The filename is unchanged.",
    });
  }

  return issues;
}

export function hasBlockingIssue(
  issues: RenameIssue[],
): boolean {
  return issues.some(
    (issue) =>
      issue.severity === "error",
  );
}

function invalidCharacterPattern(
  platform: RenamePlatform,
): RegExp {
  switch (platform) {
    case "windows":
      // Includes ASCII control characters.
      return /[<>:"/\\|?*\u0000-\u001F]/u;

    case "macos":
      return /[:/\u0000]/u;

    case "linux":
      return /[/\u0000]/u;
  }
}
