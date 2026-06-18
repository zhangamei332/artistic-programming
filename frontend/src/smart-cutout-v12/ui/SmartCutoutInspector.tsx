import React from "react";
import type {
  CutoutModel,
  SmartCutoutDocument,
} from "../model/types.js";

export interface SmartCutoutInspectorProps {
  document: SmartCutoutDocument;
  onChange(
    document: SmartCutoutDocument,
  ): void;
  onRun(): void;
  onDownload(): void;
  onClearModelCache(): void;
}

const modelOptions:
  Array<[CutoutModel, string]> = [
  ["u2netp", "快速 · U²-Net P"],
  ["u2net", "标准 · U²-Net"],
  ["u2net_human_seg", "人像"],
  ["u2net_cloth_seg", "服装"],
  ["isnet-general-use", "高质量 · ISNet"],
  ["isnet-anime", "动漫"],
  ["silueta", "Silueta"],
];

export function SmartCutoutInspector({
  document,
  onChange,
  onRun,
  onDownload,
  onClearModelCache,
}: SmartCutoutInspectorProps) {
  const update = (
    mutate: (
      next: SmartCutoutDocument,
    ) => void,
  ) => {
    const next =
      structuredClone(document);

    mutate(next);
    onChange(next);
  };

  return (
    <div className="smart-cutout-inspector">
      <Section title="抠图">
        <label>
          模型
          <select
            value={document.inference.model}
            onChange={(event) =>
              update((next) => {
                next.inference.model =
                  event.target.value as
                    CutoutModel;
              })
            }
          >
            {modelOptions.map(
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
        </label>

        <label>
          <input
            type="checkbox"
            checked={
              document.inference.autoRun
            }
            onChange={(event) =>
              update((next) => {
                next.inference.autoRun =
                  event.target.checked;
              })
            }
          />
          自动执行
        </label>

        <label>
          处理顺序
          <select
            value={
              document.inference
                .processOrder
            }
            onChange={(event) =>
              update((next) => {
                next.inference.processOrder =
                  event.target.value as
                    SmartCutoutDocument[
                      "inference"
                    ]["processOrder"];
              })
            }
          >
            <option value="cutoutThenTransform">
              先抠图后编辑
            </option>
            <option value="transformThenCutout">
              先裁剪后抠图
            </option>
          </select>
        </label>

        <button
          type="button"
          onClick={onRun}
        >
          一键抠图
        </button>

        <button
          type="button"
          onClick={onClearModelCache}
        >
          清除模型缓存
        </button>
      </Section>

      <Section title="边缘">
        <RangeField
          label="Alpha 阈值"
          value={document.alpha.threshold}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            update((next) => {
              next.alpha.threshold = value;
            })
          }
        />

        <RangeField
          label="羽化"
          value={
            document.alpha.featherRadius
          }
          min={0}
          max={32}
          step={1}
          onChange={(value) =>
            update((next) => {
              next.alpha.featherRadius =
                value;
            })
          }
        />

        <RangeField
          label="扩张"
          value={
            document.alpha.dilateRadius
          }
          min={0}
          max={16}
          step={1}
          onChange={(value) =>
            update((next) => {
              next.alpha.dilateRadius =
                value;
            })
          }
        />

        <RangeField
          label="收缩"
          value={
            document.alpha.erodeRadius
          }
          min={0}
          max={16}
          step={1}
          onChange={(value) =>
            update((next) => {
              next.alpha.erodeRadius =
                value;
            })
          }
        />

        <label>
          <input
            type="checkbox"
            checked={document.alpha.invert}
            onChange={(event) =>
              update((next) => {
                next.alpha.invert =
                  event.target.checked;
              })
            }
          />
          反转 Alpha
        </label>
      </Section>

      <Section title="裁剪">
        <label>
          <input
            type="checkbox"
            checked={document.crop.enabled}
            onChange={(event) =>
              update((next) => {
                next.crop.enabled =
                  event.target.checked;
              })
            }
          />
          启用裁剪
        </label>

        <label>
          比例
          <select
            value={
              document.crop.aspectRatio ??
              "free"
            }
            onChange={(event) =>
              update((next) => {
                next.crop.aspectRatio =
                  event.target.value ===
                  "free"
                    ? null
                    : Number(
                        event.target.value,
                      );
              })
            }
          >
            <option value="free">自由</option>
            <option value="1">1:1</option>
            <option value={4 / 3}>4:3</option>
            <option value={3 / 4}>3:4</option>
            <option value={16 / 9}>16:9</option>
            <option value={9 / 16}>9:16</option>
          </select>
        </label>

        <RangeField
          label="留白"
          value={document.crop.padding}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(value) =>
            update((next) => {
              next.crop.padding = value;
            })
          }
        />
      </Section>

      <Section title="变换">
        <RangeField
          label="缩放"
          value={document.transform.zoom}
          min={0.1}
          max={8}
          step={0.01}
          onChange={(value) =>
            update((next) => {
              next.transform.zoom = value;
            })
          }
        />

        <NumberField
          label="旋转"
          value={
            document.transform.rotationDeg
          }
          onChange={(value) =>
            update((next) => {
              next.transform.rotationDeg =
                value;
            })
          }
        />

        <button
          type="button"
          onClick={() =>
            update((next) => {
              next.transform.rotationDeg -=
                90;
            })
          }
        >
          左转 90°
        </button>

        <button
          type="button"
          onClick={() =>
            update((next) => {
              next.transform.rotationDeg +=
                90;
            })
          }
        >
          右转 90°
        </button>

        <button
          type="button"
          onClick={() =>
            update((next) => {
              next.transform.flipX =
                !next.transform.flipX;
            })
          }
        >
          水平翻转
        </button>

        <button
          type="button"
          onClick={() =>
            update((next) => {
              next.transform.flipY =
                !next.transform.flipY;
            })
          }
        >
          垂直翻转
        </button>
      </Section>

      <Section title="背景">
        <label>
          背景
          <select
            value={document.background.mode}
            onChange={(event) =>
              update((next) => {
                next.background.mode =
                  event.target.value as
                    SmartCutoutDocument[
                      "background"
                    ]["mode"];

                next.export.transparent =
                  next.background.mode ===
                  "transparent";
              })
            }
          >
            <option value="transparent">
              透明
            </option>
            <option value="color">
              纯色
            </option>
            <option value="image">
              图片
            </option>
          </select>
        </label>

        <label>
          背景颜色
          <input
            type="color"
            value={document.background.color}
            disabled={
              document.background.mode !==
              "color"
            }
            onChange={(event) =>
              update((next) => {
                next.background.color =
                  event.target.value;
              })
            }
          />
        </label>
      </Section>

      <Section title="导出">
        <label>
          文件名
          <input
            value={document.export.fileName}
            onChange={(event) =>
              update((next) => {
                next.export.fileName =
                  event.target.value;
              })
            }
          />
        </label>

        <label>
          倍率
          <select
            value={document.export.scale}
            onChange={(event) =>
              update((next) => {
                next.export.scale =
                  Number(
                    event.target.value,
                  ) as
                    SmartCutoutDocument[
                      "export"
                    ]["scale"];
              })
            }
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onDownload}
        >
          保存透明 PNG
        </button>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: React.PropsWithChildren<{
  title: string;
}>) {
  return (
    <section>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      {label}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(
            Number(event.target.value),
          )
        }
      />
      <output>{value}</output>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) =>
          onChange(
            Number(event.target.value),
          )
        }
      />
    </label>
  );
}
