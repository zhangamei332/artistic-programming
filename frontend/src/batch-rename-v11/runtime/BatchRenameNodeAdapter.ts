import type {
  BatchRenameDocument,
  BatchRenameOutputs,
  RenameAsset,
} from "../model/types.js";
import {
  applyVirtualRenamePlan,
} from "../adapters/VirtualRenameAdapter.js";
import {
  processRenamePlan,
} from "./processRenamePlan.js";

export interface BatchRenameCookContext {
  now?: Date;
}

export class BatchRenameNodeAdapter {
  public cook(
    assets: RenameAsset[],
    document: BatchRenameDocument,
    context: BatchRenameCookContext = {},
  ): BatchRenameOutputs {
    const renamePlan =
      processRenamePlan(
        assets,
        document,
        {
          now: context.now,
        },
      );

    const renamedAssets =
      applyVirtualRenamePlan(
        assets,
        renamePlan,
      );

    return {
      renamedAssets,
      renamePlan,
      conflicts:
        renamePlan.conflicts,
    };
  }
}
