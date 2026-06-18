import type {
  TextDocument,
} from "../model/types.js";
import type {
  FontAssetResolver,
} from "../adapters/FontAssetResolver.js";
import type {
  TextToSvgConverter,
  TextToSvgOptions,
} from "./TextToSvgConverter.js";
import type {
  SvgDocumentV9,
} from "../integration/svgTypes.js";

export interface GraphNodeRecord {
  id: string;
  type: string;
  label: string;
  params?: Record<
    string,
    unknown
  >;
  data?: Record<
    string,
    unknown
  >;
}

export interface GraphEdgeRecord {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface GraphTransactionApi {
  beginTransaction(
    label: string,
  ): void;

  addNode(
    node: GraphNodeRecord,
  ): void;

  removeNode(
    nodeId: string,
  ): void;

  setNodeVisible?(
    nodeId: string,
    visible: boolean,
  ): void;

  connect(
    edge: GraphEdgeRecord,
  ): void;

  getOutgoingEdges(
    nodeId: string,
  ): GraphEdgeRecord[];

  isPortCompatible(
    sourceType: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string,
  ): boolean;

  commitTransaction(): void;
  rollbackTransaction(): void;

  openNodeEditor?(
    nodeId: string,
  ): void;
}

export interface ConvertTextNodeRequest {
  textNodeId: string;
  textDocument: TextDocument;
  options: TextToSvgOptions;
}

export interface ConvertTextNodeResult {
  svgNodeId: string;
  svgDocument: SvgDocumentV9;
  glyphCount: number;
  pathCount: number;
}

export class ConvertTextNodeToSvgService {
  public constructor(
    private readonly fonts:
      FontAssetResolver,
    private readonly converter:
      TextToSvgConverter,
    private readonly graph:
      GraphTransactionApi,
  ) {}

  public async execute(
    request: ConvertTextNodeRequest,
  ): Promise<ConvertTextNodeResult> {
    const fontAssetId =
      request.textDocument
        .defaultStyle
        .fontAssetId;

    if (!fontAssetId) {
      throw new Error(
        "请选择可解析的字体资源后再转换为 SVG",
      );
    }

    const font =
      await this.fonts.load(
        fontAssetId,
      );

    const result =
      this.converter.convert(
        request.textDocument,
        font,
        request.options,
      );

    const svgNodeId =
      `svg_editor_${crypto.randomUUID()}`;

    this.graph.beginTransaction(
      "Convert text to SVG",
    );

    try {
      this.graph.addNode({
        id: svgNodeId,
        type: "vector.svgEditor",
        label: "文字轮廓 SVG",
        data: {
          document:
            result.svgDocument,
          sourceTextNodeId:
            request.textNodeId,
          linkMode:
            request.options.mode ===
            "linkedSnapshot"
              ? "linkedSnapshot"
              : "detached",
          outlineEdited: false,
        },
      });

      const outgoing =
        this.graph.getOutgoingEdges(
          request.textNodeId,
        );

      for (
        const edge of
        outgoing
      ) {
        const sourcePort =
          compatibleSourcePort(
            edge.sourcePort,
          );

        if (
          !sourcePort ||
          !this.graph.isPortCompatible(
            "vector.svgEditor",
            sourcePort,
            edge.targetNodeId,
            edge.targetPort,
          )
        ) {
          continue;
        }

        this.graph.connect({
          id:
            `edge_${crypto.randomUUID()}`,
          sourceNodeId:
            svgNodeId,
          sourcePort,
          targetNodeId:
            edge.targetNodeId,
          targetPort:
            edge.targetPort,
        });
      }

      if (
        request.options.mode ===
        "replace"
      ) {
        this.graph.removeNode(
          request.textNodeId,
        );
      }

      if (
        request.options.mode ===
        "duplicate"
      ) {
        this.graph.setNodeVisible?.(
          request.textNodeId,
          true,
        );
      }

      this.graph.commitTransaction();

      if (
        request.options.openSvgEditor
      ) {
        this.graph.openNodeEditor?.(
          svgNodeId,
        );
      }

      return {
        svgNodeId,
        svgDocument:
          result.svgDocument,
        glyphCount:
          result.glyphCount,
        pathCount:
          result.pathCount,
      };
    } catch (error) {
      this.graph.rollbackTransaction();
      throw error;
    }
  }
}

function compatibleSourcePort(
  textPort: string,
): string | undefined {
  const map:
    Record<string, string> = {
    texture: "texture",
    svgPreview: "svg",
    glyphPoints: "points",
  };

  return map[textPort];
}
