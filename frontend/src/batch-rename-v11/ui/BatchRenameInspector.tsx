import React from "react";
import type {
  BatchRenameDocument,
  RenamePlan,
  RenameRule,
  RenameRuleVariant,
} from "../model/types.js";
import {
  createDefaultRenameRule,
} from "../model/defaults.js";

export interface BatchRenameInspectorProps {
  document: BatchRenameDocument;
  plan: RenamePlan;
  onDocumentChange(
    document: BatchRenameDocument,
  ): void;
  onExecute(): void;
}

const ruleLabels:
  Record<
    RenameRuleVariant,
    string
  > = {
  findReplace: "查找替换",
  regexReplace: "正则替换",
  prefix: "添加前缀",
  suffix: "添加后缀",
  insert: "插入文字",
  remove: "删除字符",
  sequence: "序列编号",
  caseStyle: "大小写与命名风格",
  extension: "扩展名",
  dateTime: "日期时间",
  cleanup: "清理文件名",
  template: "模板重命名",
};

export function BatchRenameInspector({
  document,
  plan,
  onDocumentChange,
  onExecute,
}: BatchRenameInspectorProps) {
  const update = (
    mutate: (
      next: BatchRenameDocument,
    ) => void,
  ) => {
    const next =
      structuredClone(document);

    mutate(next);
    onDocumentChange(next);
  };

  const addRule = (
    variant: RenameRuleVariant,
  ) => {
    update((next) => {
      next.rules.push(
        createDefaultRenameRule(
          variant,
        ),
      );
    });
  };

  const updateRule = (
    ruleId: string,
    patch: Partial<RenameRule>,
  ) => {
    update((next) => {
      const index =
        next.rules.findIndex(
          (rule) =>
            rule.id === ruleId,
        );

      if (index < 0) return;

      next.rules[index] = {
        ...next.rules[index],
        ...patch,
      } as RenameRule;
    });
  };

  const removeRule = (
    ruleId: string,
  ) => {
    update((next) => {
      next.rules =
        next.rules.filter(
          (rule) =>
            rule.id !== ruleId,
        );
    });
  };

  return (
    <div className="batch-rename-inspector">
      <section>
        <h3>规则</h3>

        <select
          defaultValue=""
          onChange={(event) => {
            if (
              !event.target.value
            ) {
              return;
            }

            addRule(
              event.target
                .value as
                RenameRuleVariant,
            );

            event.target.value = "";
          }}
        >
          <option value="">
            添加规则
          </option>

          {Object.entries(
            ruleLabels,
          ).map(
            ([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ),
          )}
        </select>

        <ol>
          {document.rules.map(
            (rule, index) => (
              <li key={rule.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={
                      rule.enabled
                    }
                    onChange={(
                      event,
                    ) =>
                      updateRule(
                        rule.id,
                        {
                          enabled:
                            event
                              .target
                              .checked,
                        },
                      )
                    }
                  />

                  {index + 1}
                  {". "}
                  {
                    ruleLabels[
                      rule.variant
                    ]
                  }
                </label>

                <button
                  type="button"
                  onClick={() =>
                    removeRule(
                      rule.id,
                    )
                  }
                >
                  删除
                </button>
              </li>
            ),
          )}
        </ol>
      </section>

      <section>
        <h3>预览</h3>

        <div>
          {plan.selectedCount}
          {" 个选中项目"}
        </div>

        <div>
          {plan.changedCount}
          {" 个名称变化"}
        </div>

        <div>
          {plan.invalidCount}
          {" 个问题"}
        </div>

        <table>
          <thead>
            <tr>
              <th>原名称</th>
              <th>新名称</th>
              <th>状态</th>
            </tr>
          </thead>

          <tbody>
            {plan.entries
              .slice(0, 50)
              .map((entry) => (
                <tr
                  key={entry.assetId}
                >
                  <td>
                    {
                      entry.originalName
                    }
                  </td>
                  <td>
                    {
                      entry.outputName
                    }
                  </td>
                  <td>
                    {entry.valid
                      ? "正常"
                      : entry.issues
                          .map(
                            (issue) =>
                              issue.message,
                          )
                          .join("; ")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>执行</h3>

        <select
          value={
            document.executionMode
          }
          onChange={(event) =>
            update((next) => {
              next.executionMode =
                event.target
                  .value as
                  BatchRenameDocument[
                    "executionMode"
                  ];
            })
          }
        >
          <option value="virtual">
            仅修改内部资产名
          </option>

          <option value="zip">
            导出 ZIP 副本
          </option>

          <option value="directExperimental">
            直接修改本地文件（实验性）
          </option>
        </select>

        <button
          type="button"
          disabled={
            !plan.canExecute
          }
          onClick={onExecute}
        >
          执行重命名计划
        </button>
      </section>
    </div>
  );
}
