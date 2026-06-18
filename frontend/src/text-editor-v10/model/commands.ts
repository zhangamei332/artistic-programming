import type {
  ParagraphStyle,
  TextBox,
  TextDocument,
  TextRun,
  TextStyle,
  TextTransform,
} from "./types.js";
import type {
  TextDocumentCommand,
} from "./TextDocumentStore.js";
import {
  clampSelection,
} from "./defaults.js";

export function setTextContent(
  text: string,
): TextDocumentCommand {
  return {
    label: "Set text content",
    execute(document) {
      document.text = text;

      for (const run of document.runs) {
        run.start = Math.min(run.start, text.length);
        run.end = Math.min(
          Math.max(run.start, run.end),
          text.length,
        );
      }

      for (const paragraph of document.paragraphs) {
        paragraph.start = Math.min(
          paragraph.start,
          text.length,
        );
        paragraph.end = Math.min(
          Math.max(paragraph.start, paragraph.end),
          text.length,
        );
      }

      return clampSelection(document);
    },
  };
}

export function setDefaultTextStyle(
  style: Partial<TextStyle>,
): TextDocumentCommand {
  return {
    label: "Set default text style",
    execute(document) {
      document.defaultStyle = {
        ...document.defaultStyle,
        ...style,
      };
      return document;
    },
  };
}

export function addTextRun(
  run: TextRun,
): TextDocumentCommand {
  return {
    label: "Add text run",
    execute(document) {
      document.runs.push(run);
      document.runs.sort((a, b) => a.start - b.start);
      return document;
    },
  };
}

export function updateTextRun(
  runId: string,
  update: Partial<TextRun>,
): TextDocumentCommand {
  return {
    label: "Update text run",
    execute(document) {
      const index = document.runs.findIndex(
        (run) => run.id === runId,
      );
      if (index < 0) {
        throw new Error(`Text run not found: ${runId}`);
      }

      document.runs[index] = {
        ...document.runs[index],
        ...update,
      };

      return document;
    },
  };
}

export function setParagraphStyle(
  paragraphId: string,
  update: Partial<ParagraphStyle>,
): TextDocumentCommand {
  return {
    label: "Set paragraph style",
    execute(document) {
      const paragraph = document.paragraphs.find(
        (entry) => entry.id === paragraphId,
      );
      if (!paragraph) {
        throw new Error(
          `Paragraph not found: ${paragraphId}`,
        );
      }

      Object.assign(paragraph, update);
      return document;
    },
  };
}

export function setTextBox(
  update: Partial<TextBox>,
): TextDocumentCommand {
  return {
    label: "Set text box",
    execute(document) {
      document.box = {
        ...document.box,
        ...update,
      };
      return document;
    },
  };
}

export function setTextTransform(
  update: Partial<TextTransform>,
): TextDocumentCommand {
  return {
    label: "Set text transform",
    execute(document) {
      document.transform = {
        ...document.transform,
        ...update,
      };
      return document;
    },
  };
}
