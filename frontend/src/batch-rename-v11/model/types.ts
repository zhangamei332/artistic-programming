export type RenameExecutionMode =
  | "virtual"
  | "zip"
  | "directExperimental";

export type RenamePlatform =
  | "windows"
  | "macos"
  | "linux";

export type RenameSortKey =
  | "inputOrder"
  | "originalName"
  | "size"
  | "lastModified"
  | "type";

export type SortDirection =
  | "ascending"
  | "descending";

export interface RenameMetadata {
  width?: number;
  height?: number;
  duration?: number;
  type?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface RenameAsset {
  id: string;
  originalName: string;
  relativePath?: string;
  size?: number;
  lastModified?: number;
  mimeType?: string;
  selected?: boolean;
  metadata?: RenameMetadata;
  sourceFile?: File;
  sourceHandle?: unknown;
}

export type RenameRuleVariant =
  | "findReplace"
  | "regexReplace"
  | "prefix"
  | "suffix"
  | "insert"
  | "remove"
  | "sequence"
  | "caseStyle"
  | "extension"
  | "dateTime"
  | "cleanup"
  | "template";

export interface BaseRenameRule {
  id: string;
  variant: RenameRuleVariant;
  enabled: boolean;
  label?: string;
}

export interface FindReplaceRule extends BaseRenameRule {
  variant: "findReplace";
  find: string;
  replace: string;
  caseSensitive: boolean;
  replaceAll: boolean;
}

export interface RegexReplaceRule extends BaseRenameRule {
  variant: "regexReplace";
  pattern: string;
  replacement: string;
  flags: string;
}

export interface PrefixRule extends BaseRenameRule {
  variant: "prefix";
  text: string;
}

export interface SuffixRule extends BaseRenameRule {
  variant: "suffix";
  text: string;
}

export interface InsertRule extends BaseRenameRule {
  variant: "insert";
  text: string;
  index: number;
}

export interface RemoveRule extends BaseRenameRule {
  variant: "remove";
  mode:
    | "first"
    | "last"
    | "range"
    | "specific"
    | "pattern";
  count: number;
  start: number;
  end: number;
  characters: string;
  pattern: string;
}

export interface SequenceRule extends BaseRenameRule {
  variant: "sequence";
  position:
    | "prefix"
    | "suffix"
    | "replace";
  start: number;
  step: number;
  padding: number;
  separator: string;
  format: string;
}

export type CaseStyle =
  | "uppercase"
  | "lowercase"
  | "titleCase"
  | "sentenceCase"
  | "camelCase"
  | "snakeCase"
  | "kebabCase";

export interface CaseStyleRule extends BaseRenameRule {
  variant: "caseStyle";
  style: CaseStyle;
}

export interface ExtensionRule extends BaseRenameRule {
  variant: "extension";
  action:
    | "lowercase"
    | "uppercase"
    | "change"
    | "add"
    | "remove";
  extension: string;
}

export interface DateTimeRule extends BaseRenameRule {
  variant: "dateTime";
  source:
    | "current"
    | "modified";
  format: string;
  position:
    | "prefix"
    | "suffix"
    | "replace";
  separator: string;
}

export interface CleanupRule extends BaseRenameRule {
  variant: "cleanup";
  trimSpaces: boolean;
  collapseSpaces: boolean;
  removeCharacters: string;
  replaceSpacesWith: string;
  removeRepeatedSeparators: boolean;
}

export interface TemplateRule extends BaseRenameRule {
  variant: "template";
  template: string;
  start: number;
  step: number;
}

export type RenameRule =
  | FindReplaceRule
  | RegexReplaceRule
  | PrefixRule
  | SuffixRule
  | InsertRule
  | RemoveRule
  | SequenceRule
  | CaseStyleRule
  | ExtensionRule
  | DateTimeRule
  | CleanupRule
  | TemplateRule;

export interface RenameSelection {
  selectedAssetIds: string[];
  includeUnselectedInPreview: boolean;
}

export interface RenameSort {
  key: RenameSortKey;
  direction: SortDirection;
}

export interface RenameValidationOptions {
  platform: RenamePlatform;
  maxNameLength: number;
  blockConflicts: boolean;
  preserveExtension: boolean;
  caseSensitiveConflicts: boolean;
  preserveRelativePath: boolean;
}

export interface BatchRenameDocument {
  version: 11;
  rules: RenameRule[];
  selection: RenameSelection;
  sort: RenameSort;
  executionMode: RenameExecutionMode;
  validation: RenameValidationOptions;
}

export type RenameIssueCode =
  | "emptyName"
  | "invalidCharacters"
  | "reservedName"
  | "trailingSpaceOrPeriod"
  | "nameTooLong"
  | "duplicateOutput"
  | "invalidRegex"
  | "extensionRemoved"
  | "unchanged"
  | "ruleError";

export interface RenameIssue {
  code: RenameIssueCode;
  severity:
    | "error"
    | "warning"
    | "info";
  message: string;
  ruleId?: string;
}

export interface RenamePlanEntry {
  assetId: string;
  inputIndex: number;
  sortedIndex: number;
  selected: boolean;
  originalName: string;
  originalRelativePath: string;
  outputName: string;
  outputRelativePath: string;
  changed: boolean;
  valid: boolean;
  issues: RenameIssue[];
  asset: RenameAsset;
}

export interface RenameConflictGroup {
  key: string;
  outputPath: string;
  assetIds: string[];
}

export interface ConflictReport {
  groups: RenameConflictGroup[];
  count: number;
}

export interface RenamePlan {
  entries: RenamePlanEntry[];
  conflicts: ConflictReport;
  selectedCount: number;
  validCount: number;
  invalidCount: number;
  changedCount: number;
  unchangedCount: number;
  ruleCount: number;
  canExecute: boolean;
}

export interface RenamedAsset extends RenameAsset {
  displayName: string;
  exportName: string;
  exportRelativePath: string;
}

export interface BatchRenameOutputs {
  renamedAssets: RenamedAsset[];
  renamePlan: RenamePlan;
  conflicts: ConflictReport;
}

export interface RenamePreset {
  id: string;
  name: string;
  description: string;
  rules: RenameRule[];
}
