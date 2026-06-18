import React from "react";
import type {
  RenamePlan,
} from "../model/types.js";

export interface BatchRenameNodeProps {
  plan?: RenamePlan;
  selected?: boolean;
  onOpen(): void;
}

export function BatchRenameNode({
  plan,
  selected = false,
  onOpen,
}: BatchRenameNodeProps) {
  return (
    <article
      className="batch-rename-node"
      data-selected={selected}
    >
      <header>
        <strong>批量重命名</strong>
      </header>

      <div>
        <div>
          {plan?.selectedCount ?? 0}
          {" 个项目"}
        </div>
        <div>
          {plan?.ruleCount ?? 0}
          {" 条规则"}
        </div>
        <div>
          {plan?.validCount ?? 0}
          {" 可执行 / "}
          {plan?.invalidCount ?? 0}
          {" 个问题"}
        </div>
      </div>

      <footer>
        <button
          type="button"
          onClick={onOpen}
        >
          打开重命名工具
        </button>
      </footer>
    </article>
  );
}
