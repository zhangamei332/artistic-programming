import type {
  VideoExportDocument,
} from "./types.js";
import {
  createDefaultVideoExportDocument,
} from "./defaults.js";

export class VideoExportStore {
  private document: VideoExportDocument;
  private undoStack: VideoExportDocument[] = [];
  private redoStack: VideoExportDocument[] = [];
  private listeners =
    new Set<(document: VideoExportDocument) => void>();

  public constructor(
    initial = createDefaultVideoExportDocument(),
  ) {
    this.document = structuredClone(initial);
  }

  public getSnapshot(): VideoExportDocument {
    return this.document;
  }

  public subscribe(
    listener: (document: VideoExportDocument) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public update(
    updater: (document: VideoExportDocument) => void,
  ): void {
    const previous =
      structuredClone(this.document);

    const next =
      structuredClone(this.document);

    updater(next);

    this.undoStack.push(previous);
    this.redoStack = [];
    this.document = next;
    this.emit();
  }

  public replace(
    document: VideoExportDocument,
    recordHistory = true,
  ): void {
    if (recordHistory) {
      this.undoStack.push(
        structuredClone(this.document),
      );
      this.redoStack = [];
    }

    this.document =
      structuredClone(document);

    this.emit();
  }

  public undo(): void {
    const previous =
      this.undoStack.pop();

    if (!previous) return;

    this.redoStack.push(
      structuredClone(this.document),
    );

    this.document = previous;
    this.emit();
  }

  public redo(): void {
    const next =
      this.redoStack.pop();

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
