import type {
  SmartCutoutDocument,
} from "./types.js";
import {
  createDefaultSmartCutoutDocument,
} from "./defaults.js";

export class SmartCutoutStore {
  private document: SmartCutoutDocument;
  private undoStack: SmartCutoutDocument[] = [];
  private redoStack: SmartCutoutDocument[] = [];
  private transactionStart?: SmartCutoutDocument;
  private listeners =
    new Set<(document: SmartCutoutDocument) => void>();

  public constructor(
    initial = createDefaultSmartCutoutDocument(),
  ) {
    this.document = structuredClone(initial);
  }

  public getSnapshot(): SmartCutoutDocument {
    return this.document;
  }

  public subscribe(
    listener: (document: SmartCutoutDocument) => void,
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

  public replace(
    document: SmartCutoutDocument,
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

  public update(
    updater: (document: SmartCutoutDocument) => void,
  ): void {
    const next = structuredClone(this.document);
    updater(next);
    this.replace(next);
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
