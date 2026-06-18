import {
  Canvas,
  Textbox,
} from "fabric";
import type {
  TextDocument,
  TextRun,
  TextStyle,
} from "../model/types.js";
import type {
  TextDocumentStore,
} from "../model/TextDocumentStore.js";
import {
  setDefaultTextStyle,
  setTextBox,
  setTextContent,
  setTextTransform,
} from "../model/commands.js";

export class FabricTextEditorBridge {
  private readonly canvas:
    Canvas;

  private textbox?: Textbox;

  public constructor(
    element:
      HTMLCanvasElement,
    private readonly store:
      TextDocumentStore,
  ) {
    this.canvas =
      new Canvas(element, {
        selection: false,
        preserveObjectStacking:
          true,
      });

    this.canvas.on(
      "text:changed",
      () => this.commitText(),
    );

    this.canvas.on(
      "object:modified",
      () => this.commitObject(),
    );
  }

  public edit(
    document: TextDocument,
  ): void {
    this.canvas.clear();

    const style =
      document.defaultStyle;

    const textbox =
      new Textbox(
        document.text,
        {
          left:
            document.transform.x,
          top:
            document.transform.y,
          width:
            document.box.width,
          height:
            document.box.height,

          fontFamily:
            style.fontFamily,
          fontSize:
            style.fontSize,
          fontWeight:
            style.fontWeight,
          fontStyle:
            style.fontStyle,

          charSpacing:
            style.letterSpacing,
          lineHeight:
            document.paragraphs[0]
              ?.lineHeight ??
            1.2,
          textAlign:
            document.paragraphs[0]
              ?.align ??
            "left",

          fill:
            style.fill,
          stroke:
            style.stroke ??
            undefined,
          strokeWidth:
            style.strokeWidth,
          opacity:
            style.opacity,

          angle:
            document.transform.rotation,
          scaleX:
            document.transform.scaleX,
          scaleY:
            document.transform.scaleY,

          direction:
            document.box.direction,
          editable: true,
        },
      );

    textbox.styles =
      textRunsToFabricStyles(
        document.text,
        document.runs,
        style,
      );

    this.textbox = textbox;

    this.canvas.add(textbox);
    this.canvas.setActiveObject(
      textbox,
    );

    textbox.enterEditing();
    this.canvas.requestRenderAll();
  }

  public close(): void {
    this.commitText();
    this.commitObject();

    this.textbox = undefined;
    this.canvas.clear();
  }

  public dispose(): void {
    this.canvas.dispose();
  }

  private commitText(): void {
    const textbox =
      this.textbox;

    if (!textbox) return;

    this.store.apply(
      setTextContent(
        textbox.text ?? "",
      ),
    );
  }

  private commitObject(): void {
    const textbox =
      this.textbox;

    if (!textbox) return;

    this.store.beginTransaction();

    try {
      this.store.apply(
        setTextTransform({
          x:
            textbox.left ?? 0,
          y:
            textbox.top ?? 0,
          rotation:
            textbox.angle ?? 0,
          scaleX:
            textbox.scaleX ?? 1,
          scaleY:
            textbox.scaleY ?? 1,
        }),
      );

      this.store.apply(
        setTextBox({
          width:
            textbox.width ?? 0,
          height:
            textbox.height ?? 0,
        }),
      );

      this.store.apply(
        setDefaultTextStyle({
          fontFamily:
            textbox.fontFamily ??
            "Inter",
          fontSize:
            textbox.fontSize ??
            72,
          fontWeight:
            textbox.fontWeight ??
            400,
          fontStyle:
            (textbox.fontStyle as
              TextStyle["fontStyle"]) ??
            "normal",
          fill:
            typeof textbox.fill ===
            "string"
              ? textbox.fill
              : "#111111",
          stroke:
            typeof textbox.stroke ===
            "string"
              ? textbox.stroke
              : null,
          strokeWidth:
            textbox.strokeWidth ??
            0,
          opacity:
            textbox.opacity ?? 1,
        }),
      );

      this.store.commitTransaction();
    } catch (error) {
      this.store.rollbackTransaction();
      throw error;
    }
  }
}

function textRunsToFabricStyles(
  text: string,
  runs: TextRun[],
  fallback: TextStyle,
): Record<
  number,
  Record<
    number,
    Record<string, unknown>
  >
> {
  const styles:
    Record<
      number,
      Record<
        number,
        Record<string, unknown>
      >
    > = {};

  let lineIndex = 0;
  let charIndex = 0;

  for (
    let globalIndex = 0;
    globalIndex < text.length;
    globalIndex += 1
  ) {
    const character =
      text[globalIndex];

    if (
      character === "\n"
    ) {
      lineIndex += 1;
      charIndex = 0;
      continue;
    }

    const run =
      runs.find(
        (entry) =>
          globalIndex >=
            entry.start &&
          globalIndex <
            entry.end,
      );

    if (run) {
      const style = {
        ...fallback,
        ...run.style,
      };

      styles[lineIndex] ??= {};

      styles[lineIndex][
        charIndex
      ] = {
        fontFamily:
          style.fontFamily,
        fontSize:
          style.fontSize,
        fontWeight:
          style.fontWeight,
        fontStyle:
          style.fontStyle,
        fill: style.fill,
        stroke:
          style.stroke ??
          undefined,
        strokeWidth:
          style.strokeWidth,
        charSpacing:
          style.letterSpacing,
        deltaY:
          -style.baselineShift,
      };
    }

    charIndex += 1;
  }

  return styles;
}
