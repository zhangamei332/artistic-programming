import { Canvas, Textbox } from "fabric";
import type { SvgDocumentStore } from "../model/documentStore.js";
import type { TextNode } from "../model/types.js";

export class FabricTextBridge {
  private readonly canvas: Canvas;
  private activeNodeId?: string;

  public constructor(
    element: HTMLCanvasElement,
    private readonly store: SvgDocumentStore,
  ) {
    this.canvas = new Canvas(element, {
      selection: false,
      preserveObjectStacking: true,
    });
    this.canvas.on("object:modified", () => this.commit());
    this.canvas.on("text:changed", () => this.commit());
  }

  public edit(node: TextNode): void {
    this.canvas.clear();
    this.activeNodeId = node.id;

    const textbox = new Textbox(node.text, {
      left: node.transform.x,
      top: node.transform.y,
      width: node.width,
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      charSpacing: node.letterSpacing,
      lineHeight: node.lineHeight,
      textAlign: node.textAlign,
      fill: node.fill ?? "transparent",
      stroke: node.stroke ?? undefined,
      strokeWidth: node.strokeWidth,
      opacity: node.opacity,
      angle: node.transform.rotation,
      scaleX: node.transform.scaleX,
      scaleY: node.transform.scaleY,
    });

    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);
    textbox.enterEditing();
    this.canvas.requestRenderAll();
  }

  public close(): void {
    this.commit();
    this.activeNodeId = undefined;
    this.canvas.clear();
  }

  public dispose(): void {
    this.canvas.dispose();
  }

  private commit(): void {
    if (!this.activeNodeId) return;
    const object = this.canvas.getActiveObject();
    if (!(object instanceof Textbox)) return;

    const node = this.store.getSnapshot().nodes[this.activeNodeId];
    if (!node || node.type !== "text") return;

    this.store.updateNode(node.id, {
      text: object.text ?? "",
      width: object.width ?? node.width,
      height: object.height ?? node.height,
      fontFamily: object.fontFamily ?? node.fontFamily,
      fontSize: object.fontSize ?? node.fontSize,
      fontWeight: object.fontWeight ?? node.fontWeight,
      letterSpacing: object.charSpacing ?? node.letterSpacing,
      lineHeight: object.lineHeight ?? node.lineHeight,
      textAlign: (object.textAlign as TextNode["textAlign"]) ?? node.textAlign,
      opacity: object.opacity ?? node.opacity,
      transform: {
        ...node.transform,
        x: object.left ?? node.transform.x,
        y: object.top ?? node.transform.y,
        rotation: object.angle ?? node.transform.rotation,
        scaleX: object.scaleX ?? node.transform.scaleX,
        scaleY: object.scaleY ?? node.transform.scaleY,
      },
    });
  }
}
