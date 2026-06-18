import React from "react";
import type {
  TextDocument,
} from "../model/types.js";

export interface TextEditorNodeProps {
  document: TextDocument;
  selected?: boolean;
  onOpenEditor(): void;
  onConvertToSvg(): void;
}

export function TextEditorNode({
  document,
  selected = false,
  onOpenEditor,
  onConvertToSvg,
}: TextEditorNodeProps) {
  const preview =
    document.text
      .split("\n")
      .slice(0, 2)
      .join("\n");

  return (
    <article
      className="text-editor-node"
      data-selected={selected}
    >
      <header>
        <strong>字体编辑器</strong>
        <span>
          {document.defaultStyle.fontFamily}
          {" · "}
          {document.defaultStyle.fontSize}
        </span>
      </header>

      <div
        className="text-editor-node-preview"
        style={{
          fontFamily:
            document.defaultStyle.fontFamily,
          fontSize: Math.min(
            30,
            document.defaultStyle.fontSize,
          ),
          fontWeight:
            document.defaultStyle.fontWeight,
          fontStyle:
            document.defaultStyle.fontStyle,
          color:
            document.defaultStyle.fill,
          opacity:
            document.defaultStyle.opacity,
          textAlign:
            document.paragraphs[0]
              ?.align === "justify"
              ? "left"
              : document.paragraphs[0]
                  ?.align ??
                "left",
          whiteSpace: "pre-wrap",
        }}
      >
        {preview || "输入文字"}
      </div>

      <footer>
        <button
          type="button"
          onClick={onOpenEditor}
        >
          打开文字编辑器
        </button>

        <button
          type="button"
          disabled={
            !document.defaultStyle
              .fontAssetId
          }
          onClick={onConvertToSvg}
        >
          转换为 SVG
        </button>
      </footer>
    </article>
  );
}
