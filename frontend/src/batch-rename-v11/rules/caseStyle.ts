import type {
  CaseStyle,
} from "../model/types.js";

export function applyCaseStyle(
  value: string,
  style: CaseStyle,
): string {
  switch (style) {
    case "uppercase":
      return value.toUpperCase();

    case "lowercase":
      return value.toLowerCase();

    case "titleCase":
      return value.replace(
        /\p{L}[\p{L}\p{N}'’-]*/gu,
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase(),
      );

    case "sentenceCase":
      return value.length
        ? value.charAt(0).toUpperCase() +
            value.slice(1).toLowerCase()
        : value;

    case "camelCase": {
      const words = splitWords(value);
      return words
        .map((word, index) =>
          index === 0
            ? word.toLowerCase()
            : capitalize(word),
        )
        .join("");
    }

    case "snakeCase":
      return splitWords(value)
        .map((word) => word.toLowerCase())
        .join("_");

    case "kebabCase":
      return splitWords(value)
        .map((word) => word.toLowerCase())
        .join("-");
  }
}

function splitWords(value: string): string[] {
  return value
    .replace(
      /([\p{Ll}\p{N}])(\p{Lu})/gu,
      "$1 $2",
    )
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function capitalize(value: string): string {
  return value.length
    ? value.charAt(0).toUpperCase() +
        value.slice(1).toLowerCase()
    : value;
}
