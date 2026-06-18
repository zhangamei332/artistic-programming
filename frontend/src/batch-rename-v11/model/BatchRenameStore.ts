import type {
  BatchRenameDocument,
  RenameRule,
  RenameRuleVariant,
} from "./types.js";
import {
  createDefaultBatchRenameDocument,
  createDefaultRenameRule,
  createRenameId,
} from "./defaults.js";

export type BatchRenameListener =
  (document: BatchRenameDocument) => void;

export class BatchRenameStore {
  private document: BatchRenameDocument;
  private undoStack: BatchRenameDocument[] = [];
  private redoStack: BatchRenameDocument[] = [];
  private listeners = new Set<BatchRenameListener>();
  private transactionStart?: BatchRenameDocument;

  public constructor(
    initialDocument = createDefaultBatchRenameDocument(),
  ) {
    this.document = structuredClone(initialDocument);
  }

  public getSnapshot(): BatchRenameDocument {
    return this.document;
  }

  public subscribe(
    listener: BatchRenameListener,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public beginTransaction(): void {
    if (!this.transactionStart) {
      this.transactionStart =
        structuredClone(this.document);
    }
  }

  public commitTransaction(): void {
    if (!this.transactionStart) return;
    this.undoStack.push(this.transactionStart);
    this.redoStack = [];
    this.transactionStart = undefined;
    this.emit();
  }

  public rollbackTransaction(): void {
    if (!this.transactionStart) return;
    this.document = this.transactionStart;
    this.transactionStart = undefined;
    this.emit();
  }

  public replaceDocument(
    document: BatchRenameDocument,
    recordHistory = true,
  ): void {
    if (recordHistory) {
      this.undoStack.push(
        structuredClone(this.document),
      );
      this.redoStack = [];
    }

    this.document = structuredClone(document);
    this.emit();
  }

  public addRule(
    variantOrRule: RenameRuleVariant | RenameRule,
  ): RenameRule {
    const rule =
      typeof variantOrRule === "string"
        ? createDefaultRenameRule(variantOrRule)
        : structuredClone(variantOrRule);

    const next = structuredClone(this.document);
    next.rules.push(rule);
    this.replaceDocument(next);
    return rule;
  }

  public updateRule(
    ruleId: string,
    update: Partial<RenameRule>,
  ): void {
    const next = structuredClone(this.document);
    const index = next.rules.findIndex(
      (rule) => rule.id === ruleId,
    );

    if (index < 0) {
      throw new Error(
        `Rename rule not found: ${ruleId}`,
      );
    }

    next.rules[index] = {
      ...next.rules[index],
      ...update,
    } as RenameRule;

    this.replaceDocument(next);
  }

  public removeRule(ruleId: string): void {
    const next = structuredClone(this.document);
    next.rules = next.rules.filter(
      (rule) => rule.id !== ruleId,
    );
    this.replaceDocument(next);
  }

  public duplicateRule(ruleId: string): RenameRule {
    const source = this.document.rules.find(
      (rule) => rule.id === ruleId,
    );

    if (!source) {
      throw new Error(
        `Rename rule not found: ${ruleId}`,
      );
    }

    const duplicate = {
      ...structuredClone(source),
      id: createRenameId("rename_rule"),
      label: source.label
        ? `${source.label} Copy`
        : undefined,
    } as RenameRule;

    const next = structuredClone(this.document);
    const index = next.rules.findIndex(
      (rule) => rule.id === ruleId,
    );

    next.rules.splice(index + 1, 0, duplicate);
    this.replaceDocument(next);
    return duplicate;
  }

  public reorderRule(
    ruleId: string,
    beforeRuleId: string | null,
  ): void {
    const next = structuredClone(this.document);
    const source = next.rules.find(
      (rule) => rule.id === ruleId,
    );

    if (!source) {
      throw new Error(
        `Rename rule not found: ${ruleId}`,
      );
    }

    next.rules = next.rules.filter(
      (rule) => rule.id !== ruleId,
    );

    if (beforeRuleId === null) {
      next.rules.push(source);
    } else {
      const index = next.rules.findIndex(
        (rule) => rule.id === beforeRuleId,
      );

      if (index < 0) {
        throw new Error(
          `Before rule not found: ${beforeRuleId}`,
        );
      }

      next.rules.splice(index, 0, source);
    }

    this.replaceDocument(next);
  }

  public clearRules(): void {
    const next = structuredClone(this.document);
    next.rules = [];
    this.replaceDocument(next);
  }

  public undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;

    this.redoStack.push(
      structuredClone(this.document),
    );

    this.document = previous;
    this.emit();
  }

  public redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;

    this.undoStack.push(
      structuredClone(this.document),
    );

    this.document = next;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.document);
    }
  }
}
