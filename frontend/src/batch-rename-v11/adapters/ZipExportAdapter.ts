import {
  downloadZip,
} from "client-zip";
import type {
  RenamePlan,
} from "../model/types.js";

export interface ZipExportResult {
  blob: Blob;
  fileName: string;
}

export async function createRenamedZip(
  plan: RenamePlan,
): Promise<ZipExportResult> {
  if (!plan.canExecute) {
    throw new Error(
      "Rename plan contains conflicts or invalid selected entries.",
    );
  }

  const selected = plan.entries.filter(
    (entry) =>
      entry.selected &&
      entry.valid &&
      entry.asset.sourceFile,
  );

  if (!selected.length) {
    throw new Error(
      "No selected File objects are available for ZIP export.",
    );
  }

  const blob =
    await downloadZip(
      selected.map(
        (entry) => ({
          name:
            entry.outputRelativePath,
          input:
            entry.asset.sourceFile!,
          lastModified:
            entry.asset.lastModified
              ? new Date(
                  entry.asset.lastModified,
                )
              : undefined,
        }),
      ),
    ).blob();

  const stamp =
    new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replace(/\.\d{3}Z$/u, "");

  return {
    blob,
    fileName:
      `renamed-files-${stamp}.zip`,
  };
}
