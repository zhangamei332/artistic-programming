import type {
  HorizontalAlign,
  LayoutGlyph,
  LayoutLine,
  ParagraphStyle,
  TextDocument,
  TextLayoutResult,
  TextMeasurer,
  TextStyle,
} from "../model/types.js";
import { resolveStyleAt } from "./styleResolver.js";

interface Token {
  start: number;
  end: number;
  text: string;
  style: TextStyle;
  width: number;
  breakable: boolean;
  newline: boolean;
}

export function layoutTextDocument(
  document: TextDocument,
  measurer: TextMeasurer,
): TextLayoutResult {
  const tokens = tokenize(document, measurer);
  const lines = buildLines(
    document,
    tokens,
    measurer,
  );

  const totalHeight = lines.reduce(
    (sum, line) => sum + line.height,
    0,
  );

  const boxHeight =
    document.box.mode === "fixed"
      ? document.box.height
      : totalHeight;

  const verticalOffset = resolveVerticalOffset(
    document.box.verticalAlign,
    boxHeight,
    totalHeight,
  );

  for (const line of lines) {
    line.y += verticalOffset;
    line.baselineY += verticalOffset;

    for (const glyph of line.glyphs) {
      glyph.baselineY += verticalOffset;
    }
  }

  const width =
    document.box.mode === "autoWidth"
      ? Math.max(
          0,
          ...lines.map((line) => line.width),
        )
      : document.box.width;

  return {
    lines,
    width,
    height:
      document.box.mode === "autoHeight"
        ? totalHeight
        : boxHeight,
    overflowed:
      document.box.mode === "fixed" &&
      totalHeight > document.box.height,
  };
}

function tokenize(
  document: TextDocument,
  measurer: TextMeasurer,
): Token[] {
  const output: Token[] = [];
  const pattern = /(\n|\s+|[^\s\n]+)/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(document.text))) {
    const text = match[0];
    const start = match.index;
    const end = start + text.length;
    const style = resolveStyleAt(document, start);

    output.push({
      start,
      end,
      text,
      style,
      width:
        text === "\n"
          ? 0
          : measureWithLetterSpacing(
              text,
              style,
              measurer,
            ),
      breakable:
        text !== "\n" &&
        /^\s+$/u.test(text),
      newline: text === "\n",
    });
  }

  return output;
}

function buildLines(
  document: TextDocument,
  tokens: Token[],
  measurer: TextMeasurer,
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  const maxWidth =
    document.box.mode === "autoWidth"
      ? Number.POSITIVE_INFINITY
      : document.box.width;

  let current: Token[] = [];
  let currentWidth = 0;
  let cursorY = 0;

  const flush = (
    paragraph: ParagraphStyle,
    forceEmpty = false,
  ) => {
    if (!current.length && !forceEmpty) return;

    const line = createLine(
      document,
      current,
      currentWidth,
      cursorY,
      maxWidth,
      paragraph,
      measurer,
    );

    lines.push(line);
    cursorY += line.height;
    current = [];
    currentWidth = 0;
  };

  for (const token of tokens) {
    const paragraph = paragraphAt(
      document,
      token.start,
    );

    if (token.newline) {
      flush(paragraph, true);
      cursorY += paragraph.paragraphAfter;
      continue;
    }

    const projected = currentWidth + token.width;
    const shouldWrap =
      current.length > 0 &&
      projected >
        Math.max(
          0,
          maxWidth -
            paragraph.leftIndent -
            paragraph.rightIndent,
        );

    if (shouldWrap) {
      flush(paragraph);

      if (token.breakable) {
        continue;
      }
    }

    current.push(token);
    currentWidth += token.width;
  }

  const finalParagraph = paragraphAt(
    document,
    Math.max(0, document.text.length - 1),
  );

  flush(finalParagraph, document.text.endsWith("\n"));
  return lines;
}

function createLine(
  document: TextDocument,
  tokens: Token[],
  contentWidth: number,
  y: number,
  maxWidth: number,
  paragraph: ParagraphStyle,
  measurer: TextMeasurer,
): LayoutLine {
  const style =
    tokens[0]?.style ??
    document.defaultStyle;

  const ascender = Math.max(
    ...tokens.map((token) =>
      measurer.ascender(token.style),
    ),
    measurer.ascender(style),
  );

  const descender = Math.max(
    ...tokens.map((token) =>
      Math.abs(
        measurer.descender(token.style),
      ),
    ),
    Math.abs(
      measurer.descender(style),
    ),
  );

  const naturalHeight = ascender + descender;
  const lineHeight = Math.max(
    naturalHeight,
    style.fontSize * paragraph.lineHeight,
  );

  const availableWidth = Number.isFinite(maxWidth)
    ? Math.max(
        0,
        maxWidth -
          paragraph.leftIndent -
          paragraph.rightIndent,
      )
    : contentWidth;

  const align = paragraph.align;
  const lineX =
    paragraph.leftIndent +
    alignmentOffset(
      align,
      availableWidth,
      contentWidth,
    );

  const baselineY =
    y +
    paragraph.paragraphBefore +
    ascender;

  const glyphs = buildGlyphs(
    tokens,
    lineX,
    baselineY,
    align,
    availableWidth,
    contentWidth,
  );

  return {
    start: tokens[0]?.start ?? 0,
    end:
      tokens.at(-1)?.end ??
      tokens[0]?.start ??
      0,
    text: tokens.map((token) => token.text).join(""),
    x: lineX,
    y: y + paragraph.paragraphBefore,
    baselineY,
    width: contentWidth,
    height:
      lineHeight +
      paragraph.paragraphBefore,
    align,
    glyphs,
  };
}

function buildGlyphs(
  tokens: Token[],
  startX: number,
  baselineY: number,
  align: HorizontalAlign,
  availableWidth: number,
  contentWidth: number,
): LayoutGlyph[] {
  const spaces = tokens.filter(
    (token) =>
      token.breakable &&
      token.text.includes(" "),
  );

  const justifyExtra =
    align === "justify" &&
    spaces.length > 0
      ? Math.max(
          0,
          (availableWidth - contentWidth) /
            spaces.length,
        )
      : 0;

  const output: LayoutGlyph[] = [];
  let x = startX;

  for (const token of tokens) {
    const characters =
      Array.from(token.text);

    let utf16Offset = 0;

    for (
      const character of
      characters
    ) {
      const characterWidth =
        token.width /
        Math.max(
          1,
          characters.length,
        );

      output.push({
        textStart:
          token.start +
          utf16Offset,
        textEnd:
          token.start +
          utf16Offset +
          character.length,
        text: character,
        x,
        baselineY:
          baselineY -
          token.style.baselineShift,
        advance:
          characterWidth +
          (character === " "
            ? justifyExtra
            : 0),
        style: token.style,
      });

      x +=
        characterWidth +
        (character === " "
          ? justifyExtra
          : 0);

      utf16Offset +=
        character.length;
    }
  }

  return output;
}

function measureWithLetterSpacing(
  text: string,
  style: TextStyle,
  measurer: TextMeasurer,
): number {
  const count = [...text].length;
  return (
    measurer.measure({ text, style }) +
    Math.max(0, count - 1) *
      style.letterSpacing
  );
}

function paragraphAt(
  document: TextDocument,
  index: number,
): ParagraphStyle {
  return (
    document.paragraphs.find(
      (paragraph) =>
        index >= paragraph.start &&
        index <= paragraph.end,
    ) ??
    document.paragraphs[0] ?? {
      id: "fallback",
      start: 0,
      end: document.text.length,
      align: "left",
      lineHeight: 1.2,
      paragraphBefore: 0,
      paragraphAfter: 0,
      firstLineIndent: 0,
      leftIndent: 0,
      rightIndent: 0,
    }
  );
}

function alignmentOffset(
  align: HorizontalAlign,
  available: number,
  content: number,
): number {
  if (!Number.isFinite(available)) return 0;

  if (align === "center") {
    return (available - content) / 2;
  }

  if (align === "right") {
    return available - content;
  }

  return 0;
}

function resolveVerticalOffset(
  align: "top" | "middle" | "bottom",
  boxHeight: number,
  contentHeight: number,
): number {
  const free = Math.max(
    0,
    boxHeight - contentHeight,
  );

  if (align === "middle") return free / 2;
  if (align === "bottom") return free;
  return 0;
}
