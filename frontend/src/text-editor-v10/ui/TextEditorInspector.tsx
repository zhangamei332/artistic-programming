import React from "react";
import type {
  HorizontalAlign,
  ParagraphStyle,
  TextBoxMode,
  TextDocument,
  VerticalAlign,
} from "../model/types.js";
import type {
  TextDocumentStore,
} from "../model/TextDocumentStore.js";
import {
  setDefaultTextStyle,
  setParagraphStyle,
  setTextBox,
  setTextContent,
  setTextTransform,
} from "../model/commands.js";
import type {
  TextToSvgOptions,
} from "../runtime/TextToSvgConverter.js";

export interface TextEditorInspectorProps {
  document: TextDocument;
  store: TextDocumentStore;
  onConvertToSvg(
    options: TextToSvgOptions,
  ): Promise<void> | void;
  availableFonts?: Array<{
    id: string;
    family: string;
  }>;
}

export function TextEditorInspector({
  document,
  store,
  onConvertToSvg,
  availableFonts = [],
}: TextEditorInspectorProps) {
  const style =
    document.defaultStyle;

  const paragraph =
    document.paragraphs[0];

  const applyParagraph = (
    update: Partial<ParagraphStyle>,
  ) => {
    if (!paragraph) return;

    store.apply(
      setParagraphStyle(
        paragraph.id,
        update,
      ),
    );
  };

  return (
    <div className="text-editor-inspector">
      <Section title="内容">
        <label>
          文字内容
          <textarea
            value={document.text}
            rows={5}
            onChange={(event) =>
              store.apply(
                setTextContent(
                  event.target.value,
                ),
              )
            }
          />
        </label>

        <SelectField
          label="文本框模式"
          value={document.box.mode}
          options={[
            ["autoWidth", "自动宽度"],
            ["autoHeight", "自动高度"],
            ["fixed", "固定文本框"],
          ]}
          onChange={(value) =>
            store.apply(
              setTextBox({
                mode:
                  value as TextBoxMode,
              }),
            )
          }
        />

        <NumberField
          label="文本框宽度"
          value={document.box.width}
          min={1}
          onChange={(width) =>
            store.apply(
              setTextBox({ width }),
            )
          }
        />

        <NumberField
          label="文本框高度"
          value={document.box.height}
          min={1}
          onChange={(height) =>
            store.apply(
              setTextBox({ height }),
            )
          }
        />
      </Section>

      <Section title="字体">
        <label>
          字体资源
          <select
            value={
              style.fontAssetId ??
              ""
            }
            onChange={(event) => {
              const font =
                availableFonts.find(
                  (entry) =>
                    entry.id ===
                    event.target.value,
                );

              store.apply(
                setDefaultTextStyle({
                  fontAssetId:
                    font?.id ?? null,
                  fontFamily:
                    font?.family ??
                    style.fontFamily,
                }),
              );
            }}
          >
            <option value="">
              请选择字体资源
            </option>
            {availableFonts.map(
              (font) => (
                <option
                  key={font.id}
                  value={font.id}
                >
                  {font.family}
                </option>
              ),
            )}
          </select>
        </label>

        <NumberField
          label="字号"
          value={style.fontSize}
          min={1}
          max={1000}
          onChange={(fontSize) =>
            store.apply(
              setDefaultTextStyle({
                fontSize,
              }),
            )
          }
        />

        <NumberField
          label="字重"
          value={
            typeof style.fontWeight ===
            "number"
              ? style.fontWeight
              : 400
          }
          min={100}
          max={900}
          step={100}
          onChange={(fontWeight) =>
            store.apply(
              setDefaultTextStyle({
                fontWeight,
              }),
            )
          }
        />

        <NumberField
          label="字距"
          value={style.letterSpacing}
          min={-100}
          max={500}
          onChange={(letterSpacing) =>
            store.apply(
              setDefaultTextStyle({
                letterSpacing,
              }),
            )
          }
        />

        <ToggleField
          label="斜体"
          checked={
            style.fontStyle !==
            "normal"
          }
          onChange={(checked) =>
            store.apply(
              setDefaultTextStyle({
                fontStyle: checked
                  ? "italic"
                  : "normal",
              }),
            )
          }
        />

        <ToggleField
          label="Kerning"
          checked={style.kerning}
          onChange={(kerning) =>
            store.apply(
              setDefaultTextStyle({
                kerning,
              }),
            )
          }
        />

        <ToggleField
          label="Ligatures"
          checked={
            style.ligatures
          }
          onChange={(ligatures) =>
            store.apply(
              setDefaultTextStyle({
                ligatures,
              }),
            )
          }
        />
      </Section>

      <Section title="排版">
        <ButtonGroup<
          HorizontalAlign
        >
          label="水平对齐"
          value={
            paragraph?.align ??
            "left"
          }
          items={[
            ["left", "左"],
            ["center", "中"],
            ["right", "右"],
            ["justify", "两端"],
          ]}
          onChange={(align) =>
            applyParagraph({
              align,
            })
          }
        />

        <ButtonGroup<
          VerticalAlign
        >
          label="垂直对齐"
          value={
            document.box
              .verticalAlign
          }
          items={[
            ["top", "上"],
            ["middle", "中"],
            ["bottom", "下"],
          ]}
          onChange={(
            verticalAlign,
          ) =>
            store.apply(
              setTextBox({
                verticalAlign,
              }),
            )
          }
        />

        <NumberField
          label="行距"
          value={
            paragraph?.lineHeight ??
            1.2
          }
          min={0.1}
          max={10}
          step={0.05}
          onChange={(lineHeight) =>
            applyParagraph({
              lineHeight,
            })
          }
        />

        <NumberField
          label="段前"
          value={
            paragraph
              ?.paragraphBefore ??
            0
          }
          onChange={(
            paragraphBefore,
          ) =>
            applyParagraph({
              paragraphBefore,
            })
          }
        />

        <NumberField
          label="段后"
          value={
            paragraph
              ?.paragraphAfter ??
            0
          }
          onChange={(
            paragraphAfter,
          ) =>
            applyParagraph({
              paragraphAfter,
            })
          }
        />

        <NumberField
          label="首行缩进"
          value={
            paragraph
              ?.firstLineIndent ??
            0
          }
          onChange={(
            firstLineIndent,
          ) =>
            applyParagraph({
              firstLineIndent,
            })
          }
        />
      </Section>

      <Section title="外观">
        <ColorField
          label="填充色"
          value={style.fill}
          onChange={(fill) =>
            store.apply(
              setDefaultTextStyle({
                fill,
              }),
            )
          }
        />

        <ColorField
          label="描边色"
          value={
            style.stroke ??
            "#000000"
          }
          onChange={(stroke) =>
            store.apply(
              setDefaultTextStyle({
                stroke,
              }),
            )
          }
        />

        <NumberField
          label="描边宽度"
          value={style.strokeWidth}
          min={0}
          max={100}
          step={0.1}
          onChange={(strokeWidth) =>
            store.apply(
              setDefaultTextStyle({
                strokeWidth,
              }),
            )
          }
        />

        <NumberField
          label="透明度"
          value={style.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) =>
            store.apply(
              setDefaultTextStyle({
                opacity,
              }),
            )
          }
        />
      </Section>

      <Section title="变换">
        <NumberField
          label="X"
          value={document.transform.x}
          onChange={(x) =>
            store.apply(
              setTextTransform({ x }),
            )
          }
        />

        <NumberField
          label="Y"
          value={document.transform.y}
          onChange={(y) =>
            store.apply(
              setTextTransform({ y }),
            )
          }
        />

        <NumberField
          label="旋转"
          value={
            document.transform
              .rotation
          }
          onChange={(rotation) =>
            store.apply(
              setTextTransform({
                rotation,
              }),
            )
          }
        />

        <NumberField
          label="水平缩放"
          value={
            document.transform.scaleX
          }
          step={0.01}
          onChange={(scaleX) =>
            store.apply(
              setTextTransform({
                scaleX,
              }),
            )
          }
        />

        <NumberField
          label="垂直缩放"
          value={
            document.transform.scaleY
          }
          step={0.01}
          onChange={(scaleY) =>
            store.apply(
              setTextTransform({
                scaleY,
              }),
            )
          }
        />
      </Section>

      <Section title="转换">
        {!style.fontAssetId && (
          <div
            role="alert"
            className="text-editor-warning"
          >
            转换轮廓前必须选择可解析的字体资源。
          </div>
        )}

        <button
          type="button"
          disabled={
            !style.fontAssetId
          }
          onClick={() =>
            onConvertToSvg({
              mode: "duplicate",
              groupByLine: true,
              groupByGlyph: true,
              mergeGlyphs: false,
              preserveFill: true,
              preserveStroke: true,
              outlineStroke: false,
              applyTransform: true,
              openSvgEditor: true,
            })
          }
        >
          转换为 SVG
        </button>

        <small>
          默认保留原文字节点，并自动创建可编辑的 SVG 编辑器节点。
        </small>
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

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />
      {label}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options:
    Array<[string, string]>;
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      >
        {options.map(
          ([optionValue, text]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {text}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function ButtonGroup<
  TValue extends string,
>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: TValue;
  items:
    Array<[TValue, string]>;
  onChange(value: TValue): void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {items.map(
        ([itemValue, text]) => (
          <button
            key={itemValue}
            type="button"
            data-active={
              itemValue === value
            }
            onClick={() =>
              onChange(itemValue)
            }
          >
            {text}
          </button>
        ),
      )}
    </fieldset>
  );
}
