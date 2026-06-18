import type {
  TextMeasureRequest,
  TextMeasurer,
  TextStyle,
} from "../model/types.js";
import type {
  OpenTypeFontLike,
} from "./FontAssetResolver.js";

export class OpenTypeTextMeasurer
  implements TextMeasurer {
  public constructor(
    private readonly font: OpenTypeFontLike,
  ) {}

  public measure(
    request: TextMeasureRequest,
  ): number {
    return this.font.getAdvanceWidth(
      request.text,
      request.style.fontSize,
      {
        kerning:
          request.style.kerning,
        features: {
          liga:
            request.style.ligatures,
        },
        variation:
          variationMap(
            request.style,
          ),
      },
    );
  }

  public ascender(
    style: TextStyle,
  ): number {
    return (
      this.font.ascender /
      this.font.unitsPerEm
    ) * style.fontSize;
  }

  public descender(
    style: TextStyle,
  ): number {
    return (
      this.font.descender /
      this.font.unitsPerEm
    ) * style.fontSize;
  }
}

function variationMap(
  style: TextStyle,
): Record<string, number> {
  return Object.fromEntries(
    style.variableAxes.map(
      (axis) => [
        axis.tag,
        axis.value,
      ],
    ),
  );
}
