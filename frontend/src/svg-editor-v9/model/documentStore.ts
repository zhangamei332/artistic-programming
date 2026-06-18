import type { SvgDocument, VectorNode } from "./types.js";

export interface DocumentCommand {
  label: string;
  execute(document: SvgDocument): SvgDocument;
}

export class SvgDocumentStore {
  private document: SvgDocument;
  private undoStack: SvgDocument[] = [];
  private redoStack: SvgDocument[] = [];
  private listeners = new Set<(document: SvgDocument) => void>();
  private transactionStart?: SvgDocument;

  public constructor(initialDocument: SvgDocument) {
    this.document = structuredClone(initialDocument);
  }

  public getSnapshot(): SvgDocument {
    return this.document;
  }

  public subscribe(listener: (document: SvgDocument) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public beginTransaction(): void {
    if (!this.transactionStart) this.transactionStart = structuredClone(this.document);
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

  public apply(command: DocumentCommand): void {
    const before = structuredClone(this.document);
    this.document = command.execute(structuredClone(this.document));
    if (!this.transactionStart) {
      this.undoStack.push(before);
      this.redoStack = [];
    }
    this.emit();
  }

  public replaceDocument(next: SvgDocument, recordHistory = true): void {
    if (recordHistory) {
      this.undoStack.push(structuredClone(this.document));
      this.redoStack = [];
    }
    this.document = structuredClone(next);
    this.emit();
  }

  public updateNode(nodeId: string, update: Partial<VectorNode>): void {
    this.apply({
      label: "Update vector node",
      execute: (document) => {
        const current = document.nodes[nodeId];
        if (!current) throw new Error(`Vector node not found: ${nodeId}`);
        document.nodes[nodeId] = { ...current, ...update } as VectorNode;
        return document;
      },
    });
  }

  public undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(structuredClone(this.document));
    this.document = previous;
    this.emit();
  }

  public redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(structuredClone(this.document));
    this.document = next;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.document);
  }
}
