import type {
  ParagraphStyle,
  TextDocument,
  TextStyle,
  TextTransform,
} from "./types.js";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createDefaultTextStyle(): TextStyle {
  return {
    fontAssetId: null,
    fontFamily: "Inter",
    fontSize: 72,
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: 0,
    baselineShift: 0,

    fill: "#111111",
    stroke: null,
    strokeWidth: 0,
    opacity: 1,
    blendMode: "normal",

    underline: false,
    strikethrough: false,
    kerning: true,
    ligatures: true,
    variableAxes: [],
  };
}

export function createDefaultParagraphStyle(
  textLength = 0,
): ParagraphStyle {
  return {
    id: createId("paragraph"),
    start: 0,
    end: textLength,
    align: "left",
    lineHeight: 1.2,
    paragraphBefore: 0,
    paragraphAfter: 0,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
  };
}

export function createDefaultTextTransform(): TextTransform {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
  };
}

export function createDefaultTextDocument(
  text = "输入文字",
): TextDocument {
  return {
    version: 10,
    text,
    box: {
      mode: "autoHeight",
      width: 600,
      height: 240,
      overflow: "visible",
      verticalAlign: "top",
      direction: "ltr",
      writingMode: "horizontal",
      columns: 1,
      columnGap: 24,
    },
    defaultStyle: createDefaultTextStyle(),
    runs: [],
    paragraphs: [createDefaultParagraphStyle(text.length)],
    transform: createDefaultTextTransform(),
    selection: {
      start: 0,
      end: 0,
    },
  };
}

export function clampSelection(
  document: TextDocument,
): TextDocument {
  const length = document.text.length;
  document.selection.start = Math.max(
    0,
    Math.min(length, document.selection.start),
  );
  document.selection.end = Math.max(
    document.selection.start,
    Math.min(length, document.selection.end),
  );
  return document;
}
