import type {
  TextDocument,
  TextEditorOutputs,
} from "../model/types.js";
import {
  serializeTextPreviewSvg,
} from "./serializeTextPreviewSvg.js";

export class TextEditorNodeAdapter {
  public cook(
    document: TextDocument,
  ): TextEditorOutputs {
    const svgPreview =
      serializeTextPreviewSvg(
        document,
      );

    return {
      document,
      text:
        document.text,
      svgPreview,
      textureSource:
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          svgPreview,
        )}`,
    };
  }
}
