import type {
  VideoExportDocument,
} from "../model/types.js";

export function resolveVideoRange(
  document: VideoExportDocument,
  timelineDuration: number,
): {
  startSeconds: number;
  durationSeconds: number;
  frameCount: number;
} {
  const startSeconds =
    Math.max(
      0,
      document.range.startSeconds,
    );

  let durationSeconds: number;

  switch (document.range.mode) {
    case "timeline":
      durationSeconds =
        Math.max(
          0,
          timelineDuration -
          startSeconds,
        );
      break;

    case "custom":
      durationSeconds =
        Math.max(
          0,
          document.range
            .endSeconds -
          startSeconds,
        );
      break;

    case "duration":
      durationSeconds =
        Math.max(
          0,
          document.range
            .durationSeconds,
        );
      break;
  }

  durationSeconds *=
    Math.max(
      1,
      Math.floor(
        document.range.loops,
      ),
    );

  const frameCount =
    Math.max(
      1,
      Math.ceil(
        durationSeconds *
        document.frameRate,
      ),
    );

  return {
    startSeconds,
    durationSeconds,
    frameCount,
  };
}
