import type {
  ResolvedTextRun,
  TextDocument,
  TextStyle,
} from "../model/types.js";

export function resolveStyleAt(
  document: TextDocument,
  index: number,
): TextStyle {
  const matching = document.runs.filter(
    (run) => index >= run.start && index < run.end,
  );

  return matching.reduce<TextStyle>(
    (style, run) => ({
      ...style,
      ...run.style,
      variableAxes:
        run.style.variableAxes ??
        style.variableAxes,
    }),
    { ...document.defaultStyle },
  );
}

export function resolveTextRuns(
  document: TextDocument,
): ResolvedTextRun[] {
  if (!document.text.length) return [];

  const boundaries = new Set<number>([
    0,
    document.text.length,
  ]);

  for (const run of document.runs) {
    boundaries.add(
      Math.max(0, Math.min(document.text.length, run.start)),
    );
    boundaries.add(
      Math.max(0, Math.min(document.text.length, run.end)),
    );
  }

  const ordered = [...boundaries].sort((a, b) => a - b);
  const output: ResolvedTextRun[] = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];

    if (end <= start) continue;

    output.push({
      start,
      end,
      text: document.text.slice(start, end),
      style: resolveStyleAt(document, start),
    });
  }

  return output;
}
