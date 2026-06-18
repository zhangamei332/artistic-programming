import type {
  CutoutProgress,
  SmartCutoutDocument,
  SmartCutoutResult,
} from "../model/types.js";
import type {
  SmartCutoutProcessor,
} from "./SmartCutoutProcessor.js";

export interface SmartCutoutCookContext {
  signal?: AbortSignal;
  sourceRevision?: string;
  onProgress?: (
    progress: CutoutProgress,
  ) => void;
}

export class SmartCutoutNodeAdapter {
  public constructor(
    private readonly processor:
      SmartCutoutProcessor,
  ) {}

  public cook(
    document: SmartCutoutDocument,
    context:
      SmartCutoutCookContext = {},
  ): Promise<SmartCutoutResult> {
    return this.processor.process(
      document,
      context,
    );
  }

  public dispose(): Promise<void> {
    return this.processor.dispose();
  }
}
