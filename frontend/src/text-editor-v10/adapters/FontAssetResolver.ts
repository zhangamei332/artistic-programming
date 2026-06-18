import { parse as parseOpenTypeFont } from "opentype.js";

export interface FontAssetRecord {
  id: string;
  family: string;
  sourceUrl?: string;
  arrayBuffer?: ArrayBuffer;
}

export interface FontAssetRepository {
  getFontAsset(
    assetId: string,
  ): Promise<FontAssetRecord | undefined>;
}

export interface OpenTypePathLike {
  toPathData(
    decimalPlaces?: number,
  ): string;
}

export interface OpenTypeGlyphLike {
  index?: number;
  name?: string;
  unicode?: number;
  advanceWidth?: number;
  getPath(
    x: number,
    y: number,
    fontSize: number,
    options?: Record<string, unknown>,
  ): OpenTypePathLike;
}

export interface OpenTypeFontLike {
  unitsPerEm: number;
  ascender: number;
  descender: number;

  getAdvanceWidth(
    text: string,
    fontSize: number,
    options?: {
      kerning?: boolean;
      features?: Record<
        string,
        boolean
      >;
      variation?: Record<
        string,
        number
      >;
    },
  ): number;

  stringToGlyphs(
    text: string,
    options?: Record<string, unknown>,
  ): OpenTypeGlyphLike[];

  getKerningValue?(
    leftGlyph: OpenTypeGlyphLike,
    rightGlyph: OpenTypeGlyphLike,
  ): number;
}

export class FontAssetResolver {
  public constructor(
    private readonly repository: FontAssetRepository,
  ) {}

  public async load(
    assetId: string,
  ): Promise<OpenTypeFontLike> {
    const asset =
      await this.repository.getFontAsset(
        assetId,
      );

    if (!asset) {
      throw new Error(
        `Font asset not found: ${assetId}`,
      );
    }

    let buffer = asset.arrayBuffer;

    if (!buffer && asset.sourceUrl) {
      const response = await fetch(
        asset.sourceUrl,
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load font: ${response.status}`,
        );
      }

      buffer =
        await response.arrayBuffer();
    }

    if (!buffer) {
      throw new Error(
        `Font asset has no binary source: ${assetId}`,
      );
    }

    return parseOpenTypeFont(buffer) as OpenTypeFontLike;
  }
}
