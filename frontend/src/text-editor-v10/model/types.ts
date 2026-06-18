export type TextBoxMode = "autoWidth" | "autoHeight" | "fixed";
export type TextOverflow = "visible" | "clip" | "shrink";
export type HorizontalAlign = "left" | "center" | "right" | "justify";
export type VerticalAlign = "top" | "middle" | "bottom";
export type TextDirection = "ltr" | "rtl";
export type WritingMode = "horizontal" | "vertical";
export type FontStyle = "normal" | "italic" | "oblique";

export interface VariableFontAxis {
  tag: string;
  value: number;
  min?: number;
  max?: number;
}

export interface TextStyle {
  fontAssetId: string | null;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: FontStyle;
  letterSpacing: number;
  baselineShift: number;

  fill: string;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blendMode: string;

  underline: boolean;
  strikethrough: boolean;
  kerning: boolean;
  ligatures: boolean;
  variableAxes: VariableFontAxis[];
}

export interface TextRun {
  id: string;
  start: number;
  end: number;
  style: Partial<TextStyle>;
}

export interface ParagraphStyle {
  id: string;
  start: number;
  end: number;
  align: HorizontalAlign;
  lineHeight: number;
  paragraphBefore: number;
  paragraphAfter: number;
  firstLineIndent: number;
  leftIndent: number;
  rightIndent: number;
}

export interface TextBox {
  mode: TextBoxMode;
  width: number;
  height: number;
  overflow: TextOverflow;
  verticalAlign: VerticalAlign;
  direction: TextDirection;
  writingMode: WritingMode;
  columns: number;
  columnGap: number;
}

export interface TextTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}

export interface TextSelection {
  start: number;
  end: number;
}

export interface TextDocument {
  version: 10;
  text: string;
  box: TextBox;
  defaultStyle: TextStyle;
  runs: TextRun[];
  paragraphs: ParagraphStyle[];
  transform: TextTransform;
  selection: TextSelection;
}

export interface ResolvedTextRun {
  start: number;
  end: number;
  text: string;
  style: TextStyle;
}

export interface TextMeasureRequest {
  text: string;
  style: TextStyle;
}

export interface TextMeasurer {
  measure(request: TextMeasureRequest): number;
  ascender(style: TextStyle): number;
  descender(style: TextStyle): number;
}

export interface LayoutGlyph {
  textStart: number;
  textEnd: number;
  text: string;
  x: number;
  baselineY: number;
  advance: number;
  style: TextStyle;
}

export interface LayoutLine {
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
  baselineY: number;
  width: number;
  height: number;
  align: HorizontalAlign;
  glyphs: LayoutGlyph[];
}

export interface TextLayoutResult {
  lines: LayoutLine[];
  width: number;
  height: number;
  overflowed: boolean;
}

export interface TextEditorOutputs {
  document: TextDocument;
  text: string;
  svgPreview: string;
  textureSource: string;
}
