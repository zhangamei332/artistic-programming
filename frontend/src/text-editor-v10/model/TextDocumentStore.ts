import type { TextDocument } from "./types.js";

export interface TextDocumentCommand {
  label: string;
  execute(document: TextDocument): TextDocument;
}

export class TextDocumentStore {
  private document: TextDocument;
  private undoStack: TextDocument[] = [];
  private redoStack: TextDocument[] = [];
  private transactionStart?: TextDocument;
  private listeners = new Set<(document: TextDocument) => void>();

  public constructor(initialDocument: TextDocument) {
    this.document = structuredClone(initialDocument);
  }

  public getSnapshot(): TextDocument {
    return this.document;
  }

  public subscribe(
    listener: (document: TextDocument) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public beginTransaction(): void {
    if (!this.transactionStart) {
      this.transactionStart = structuredClone(this.document);
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

  public apply(command: TextDocumentCommand): void {
    const previous = structuredClone(this.document);
    this.document = command.execute(
      structuredClone(this.document),
    );

    if (!this.transactionStart) {
      this.undoStack.push(previous);
      this.redoStack = [];
      this.emit();
    }
  }

  public replaceDocument(
    document: TextDocument,
    recordHistory = true,
  ): void {
    if (recordHistory) {
      this.undoStack.push(structuredClone(this.document));
      this.redoStack = [];
    }
    this.document = structuredClone(document);
    this.emit();
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
