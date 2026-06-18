import type {
  TextDocument,
  TextStyle,
} from "../model/types.js";
import {
  layoutTextDocument,
} from "../layout/layoutText.js";
import {
  resolveStyleAt,
} from "../layout/styleResolver.js";
import type {
  OpenTypeFontLike,
} from "../adapters/FontAssetResolver.js";
import {
  OpenTypeTextMeasurer,
} from "../adapters/OpenTypeTextMeasurer.js";
import {
  PaperPathDataAdapter,
} from "../adapters/PaperPathDataAdapter.js";
import {
  createSvgId,
  createSvgTransform,
  type SvgDocumentV9,
  type SvgGroupNode,
  type SvgVectorNode,
} from "../integration/svgTypes.js";

export type TextToSvgMode =
  | "duplicate"
  | "replace"
  | "linkedSnapshot";

export interface TextToSvgOptions {
  mode: TextToSvgMode;
  groupByLine: boolean;
  groupByGlyph: boolean;
  mergeGlyphs: boolean;
  preserveFill: boolean;
  preserveStroke: boolean;
  outlineStroke: boolean;
  applyTransform: boolean;
  openSvgEditor: boolean;
}

export interface TextToSvgResult {
  svgDocument: SvgDocumentV9;
  glyphCount: number;
  pathCount: number;
}

export class TextToSvgConverter {
  public constructor(
    private readonly pathAdapter:
      PaperPathDataAdapter,
  ) {}

  public convert(
    document: TextDocument,
    font: OpenTypeFontLike,
    options: TextToSvgOptions,
  ): TextToSvgResult {
    if (
      !document.defaultStyle.fontAssetId
    ) {
      throw new Error(
        "Text outline conversion requires a FontAsset",
      );
    }

    const measurer =
      new OpenTypeTextMeasurer(
        font,
      );

    const layout =
      layoutTextDocument(
        document,
        measurer,
      );

    const svgDocument:
      SvgDocumentV9 = {
      version: 9,
      width: Math.max(
        1,
        layout.width,
      ),
      height: Math.max(
        1,
        layout.height,
      ),
      viewBox: [
        0,
        0,
        Math.max(
          1,
          layout.width,
        ),
        Math.max(
          1,
          layout.height,
        ),
      ],
      rootIds: [],
      nodes: {},
      selection: {
        nodeIds: [],
        anchorRefs: [],
      },
    };

    const rootId =
      createSvgId(
        "text_outline",
      );

    const root:
      SvgGroupNode = {
      id: rootId,
      type: "group",
      name: "Text Outline",
      parentId: null,
      visible: true,
      locked: false,
      transform: {
        ...createSvgTransform(),
        x:
          document.transform.x,
        y:
          document.transform.y,
        rotation:
          document.transform.rotation,
        scaleX:
          document.transform.scaleX,
        scaleY:
          document.transform.scaleY,
        skewX:
          document.transform.skewX,
        skewY:
          document.transform.skewY,
      },
      fill:
        document.defaultStyle.fill,
      stroke:
        document.defaultStyle.stroke,
      strokeWidth:
        document.defaultStyle.strokeWidth,
      opacity:
        document.defaultStyle.opacity,
      blendMode:
        document.defaultStyle.blendMode,
      fillRule: "evenodd",
      childIds: [],
    };

    svgDocument.rootIds.push(
      rootId,
    );

    svgDocument.nodes[rootId] =
      root;

    let glyphCount = 0;
    let pathCount = 0;

    for (
      let lineIndex = 0;
      lineIndex <
      layout.lines.length;
      lineIndex += 1
    ) {
      const line =
        layout.lines[lineIndex];

      const lineParentId =
        options.groupByLine
          ? createGroup(
              svgDocument,
              rootId,
              `Line ${lineIndex + 1}`,
              document.defaultStyle,
            )
          : rootId;

      if (
        options.groupByLine
      ) {
        root.childIds.push(
          lineParentId,
        );
      }

      let cursorX = line.x;
      let textIndex =
        line.start;
      const mergedPathData:
        string[] = [];

      for (
        const character of
        Array.from(line.text)
      ) {
        const style =
          resolveStyleAt(
            document,
            textIndex,
          );

        const glyphs =
          font.stringToGlyphs(
            character,
            {
              features: {
                liga:
                  style.ligatures,
              },
              variation:
                Object.fromEntries(
                  style.variableAxes.map(
                    (axis) => [
                      axis.tag,
                      axis.value,
                    ],
                  ),
                ),
            },
          );

        const glyphParentId =
          options.groupByGlyph &&
          !options.mergeGlyphs
            ? createGroup(
                svgDocument,
                lineParentId,
                `Glyph ${glyphCount + 1}`,
                style,
              )
            : lineParentId;

        if (
          options.groupByGlyph &&
          !options.mergeGlyphs
        ) {
          getGroup(
            svgDocument,
            lineParentId,
          ).childIds.push(
            glyphParentId,
          );
        }

        for (
          const glyph of glyphs
        ) {
          const path =
            glyph.getPath(
              cursorX,
              line.baselineY,
              style.fontSize,
              {
                kerning:
                  style.kerning,
                variation:
                  Object.fromEntries(
                    style.variableAxes.map(
                      (axis) => [
                        axis.tag,
                        axis.value,
                      ],
                    ),
                  ),
              },
            );

          const pathData =
            path.toPathData(4);

          if (
            pathData.trim()
          ) {
            if (
              options.mergeGlyphs
            ) {
              mergedPathData.push(
                pathData,
              );
            } else {
              const imported =
                this.pathAdapter.importPathData(
                  pathData,
                  glyphParentId,
                  styleToPathStyle(
                    style,
                    options,
                  ),
                  `Glyph ${glyphCount + 1}`,
                );

              addImportedNodes(
                svgDocument,
                glyphParentId,
                imported,
              );

              pathCount +=
                imported.nodes.filter(
                  (node) =>
                    node.type === "path",
                ).length;
            }
          }

          cursorX +=
            glyphAdvance(
              glyph.advanceWidth,
              font.unitsPerEm,
              style.fontSize,
            );
        }

        cursorX +=
          style.letterSpacing;

        textIndex +=
          character.length;

        glyphCount += 1;
      }

      if (
        options.mergeGlyphs &&
        mergedPathData.length
      ) {
        const imported =
          this.pathAdapter.unitePathData(
            mergedPathData,
            lineParentId,
            styleToPathStyle(
              document.defaultStyle,
              options,
            ),
            `Merged Line ${lineIndex + 1}`,
          );

        addImportedNodes(
          svgDocument,
          lineParentId,
          imported,
        );

        pathCount +=
          imported.nodes.filter(
            (node) =>
              node.type === "path",
          ).length;
      }
    }

    return {
      svgDocument,
      glyphCount,
      pathCount,
    };
  }
}

function createGroup(
  document: SvgDocumentV9,
  parentId: string,
  name: string,
  style: TextStyle,
): string {
  const id =
    createSvgId("group");

  const group:
    SvgGroupNode = {
    id,
    type: "group",
    name,
    parentId,
    visible: true,
    locked: false,
    transform:
      createSvgTransform(),
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth:
      style.strokeWidth,
    opacity: style.opacity,
    blendMode:
      style.blendMode,
    fillRule: "evenodd",
    childIds: [],
  };

  document.nodes[id] =
    group;

  return id;
}

function getGroup(
  document: SvgDocumentV9,
  groupId: string,
): SvgGroupNode {
  const node =
    document.nodes[groupId];

  if (
    !node ||
    node.type !== "group"
  ) {
    throw new Error(
      `SVG group not found: ${groupId}`,
    );
  }

  return node;
}

function addImportedNodes(
  document: SvgDocumentV9,
  parentId: string,
  imported: {
    rootId: string;
    nodes: SvgVectorNode[];
  },
): void {
  for (
    const node of
    imported.nodes
  ) {
    document.nodes[node.id] =
      node;
  }

  getGroup(
    document,
    parentId,
  ).childIds.push(
    imported.rootId,
  );
}

function styleToPathStyle(
  style: TextStyle,
  options: TextToSvgOptions,
) {
  return {
    fill:
      options.preserveFill
        ? style.fill
        : null,
    stroke:
      options.preserveStroke
        ? style.stroke
        : null,
    strokeWidth:
      options.preserveStroke
        ? style.strokeWidth
        : 0,
    opacity: style.opacity,
    blendMode:
      style.blendMode,
  };
}

function glyphAdvance(
  advanceWidth: number | undefined,
  unitsPerEm: number,
  fontSize: number,
): number {
  return (
    (advanceWidth ??
      unitsPerEm * 0.5) /
    unitsPerEm
  ) * fontSize;
}
