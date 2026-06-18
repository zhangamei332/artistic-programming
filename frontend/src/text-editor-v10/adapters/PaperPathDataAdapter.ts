import paper from "paper";
import {
  createSvgId,
  createSvgTransform,
  type SvgGroupNode,
  type SvgPathNode,
  type SvgVectorNode,
} from "../integration/svgTypes.js";

export interface PathImportStyle {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blendMode: string;
}

export class PaperPathDataAdapter {
  private readonly scope: paper.PaperScope;

  public constructor() {
    this.scope =
      new paper.PaperScope();

    this.scope.setup(
      new this.scope.Size(
        1,
        1,
      ),
    );
  }

  public importPathData(
    pathData: string,
    parentId: string,
    style: PathImportStyle,
    name = "Glyph Outline",
  ): {
    rootId: string;
    nodes: SvgVectorNode[];
  } {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      `<path d="${escapeAttribute(
        pathData,
      )}"/>`,
      "</svg>",
    ].join("");

    const imported =
      this.scope.project.importSVG(
        svg,
        {
          insert: false,
          expandShapes: true,
        },
      );

    const item =
      imported instanceof this.scope.Group
        ? imported.firstChild
        : imported;

    if (!item) {
      throw new Error(
        "Paper.js returned no path",
      );
    }

    return this.itemToVectorNodes(
      item,
      parentId,
      style,
      name,
    );
  }

  public unitePathData(
    pathDataList: string[],
    parentId: string,
    style: PathImportStyle,
    name = "Merged Text Outline",
  ): {
    rootId: string;
    nodes: SvgVectorNode[];
  } {
    const items = pathDataList.map(
      (pathData) => {
        const path =
          new this.scope.CompoundPath(
            pathData,
          );
        return path;
      },
    );

    if (!items.length) {
      throw new Error(
        "No glyph paths to merge",
      );
    }

    let result:
      paper.PathItem = items[0];

    for (
      let index = 1;
      index < items.length;
      index += 1
    ) {
      result =
        result.unite(
          items[index],
        );
    }

    return this.itemToVectorNodes(
      result,
      parentId,
      style,
      name,
    );
  }

  public dispose(): void {
    this.scope.project.clear();
  }

  private itemToVectorNodes(
    item: paper.Item,
    parentId: string,
    style: PathImportStyle,
    name: string,
  ): {
    rootId: string;
    nodes: SvgVectorNode[];
  } {
    if (
      item instanceof
      this.scope.CompoundPath
    ) {
      const groupId =
        createSvgId(
          "compound",
        );

      const group:
        SvgGroupNode = {
        id: groupId,
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

      const nodes:
        SvgVectorNode[] = [
        group,
      ];

      for (
        const child of
        item.children
      ) {
        if (
          !(
            child instanceof
            this.scope.Path
          )
        ) {
          continue;
        }

        const path =
          this.pathToNode(
            child,
            groupId,
            style,
            `${name} Path`,
          );

        group.childIds.push(
          path.id,
        );

        nodes.push(path);
      }

      return {
        rootId: groupId,
        nodes,
      };
    }

    if (
      item instanceof
      this.scope.Path
    ) {
      const path =
        this.pathToNode(
          item,
          parentId,
          style,
          name,
        );

      return {
        rootId: path.id,
        nodes: [path],
      };
    }

    throw new Error(
      "Unsupported Paper.js item",
    );
  }

  private pathToNode(
    path: paper.Path,
    parentId: string,
    style: PathImportStyle,
    name: string,
  ): SvgPathNode {
    return {
      id: createSvgId("path"),
      type: "path",
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
      closed: path.closed,
      segments:
        path.segments.map(
          (segment) => ({
            id: createSvgId(
              "segment",
            ),
            point: {
              x: segment.point.x,
              y: segment.point.y,
            },
            handleIn: {
              x:
                segment.handleIn.x,
              y:
                segment.handleIn.y,
            },
            handleOut: {
              x:
                segment.handleOut.x,
              y:
                segment.handleOut.y,
            },
            anchorMode:
              inferAnchorMode(
                segment,
              ),
          }),
        ),
    };
  }
}

function inferAnchorMode(
  segment: paper.Segment,
):
  | "corner"
  | "smooth"
  | "symmetric" {
  const inLength =
    segment.handleIn.length;
  const outLength =
    segment.handleOut.length;

  if (
    inLength < 1e-5 &&
    outLength < 1e-5
  ) {
    return "corner";
  }

  if (
    Math.abs(
      inLength - outLength,
    ) < 1e-4
  ) {
    return "symmetric";
  }

  return "smooth";
}

function escapeAttribute(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
}
