import type {
  TextDocument,
} from "../model/types.js";

export function serializeTextPreviewSvg(
  document: TextDocument,
): string {
  const style =
    document.defaultStyle;

  const lines =
    document.text.split("\n");

  const lineHeight =
    style.fontSize *
    (document.paragraphs[0]
      ?.lineHeight ??
      1.2);

  const textAnchor =
    document.paragraphs[0]
      ?.align === "center"
      ? "middle"
      : document.paragraphs[0]
          ?.align === "right"
        ? "end"
        : "start";

  const x =
    textAnchor === "middle"
      ? document.box.width / 2
      : textAnchor === "end"
        ? document.box.width
        : 0;

  const body =
    lines.map(
      (line, index) =>
        `<tspan x="${x}" dy="${
          index === 0
            ? style.fontSize
            : lineHeight
        }">${escapeXml(line)}</tspan>`,
    ).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${document.box.width}"`,
    ` height="${document.box.height}"`,
    ` viewBox="0 0 ${document.box.width} ${document.box.height}">`,
    `<text`,
    ` font-family="${escapeXml(style.fontFamily)}"`,
    ` font-size="${style.fontSize}"`,
    ` font-weight="${style.fontWeight}"`,
    ` font-style="${style.fontStyle}"`,
    ` letter-spacing="${style.letterSpacing}"`,
    ` text-anchor="${textAnchor}"`,
    ` fill="${escapeXml(style.fill)}"`,
    ` stroke="${style.stroke ? escapeXml(style.stroke) : "none"}"`,
    ` stroke-width="${style.strokeWidth}"`,
    ` opacity="${style.opacity}">`,
    body,
    `</text></svg>`,
  ].join("");
}

function escapeXml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
