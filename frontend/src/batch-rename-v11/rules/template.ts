import type {
  RenameAsset,
} from "../model/types.js";
import {
  extractFolder,
  extractType,
} from "./filename.js";
import {
  formatRenameDate,
} from "./dateFormat.js";

export interface TemplateContext {
  asset: RenameAsset;
  stem: string;
  extension: string;
  index: number;
  date: Date;
}

export function renderRenameTemplate(
  template: string,
  context: TemplateContext,
): string {
  return template.replace(
    /\{([a-zA-Z]+)(?::([^}]+))?\}/g,
    (_match, token: string, format?: string) => {
      switch (token) {
        case "name":
          return context.stem;

        case "ext":
          return context.extension.replace(/^\./, "");

        case "index": {
          const raw = context.index.toString();

          if (!format) return raw;

          if (/^0+$/.test(format)) {
            return raw.padStart(
              format.length,
              "0",
            );
          }

          return raw;
        }

        case "date":
          return formatRenameDate(
            context.date,
            format || "YYYY-MM-DD",
          );

        case "width":
          return valueOrEmpty(
            context.asset.metadata?.width,
          );

        case "height":
          return valueOrEmpty(
            context.asset.metadata?.height,
          );

        case "folder":
          return extractFolder(
            context.asset.relativePath,
          );

        case "type":
          return extractType(
            context.asset.mimeType,
            context.extension,
          );

        default:
          return "";
      }
    },
  );
}

function valueOrEmpty(
  value: unknown,
): string {
  return value === undefined ||
    value === null
    ? ""
    : String(value);
}
