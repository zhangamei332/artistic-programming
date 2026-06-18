import React from "react";
import type {
  VideoExportDocument,
  VideoExportProgress,
} from "../model/types.js";
import {
  estimateOutputBytes,
  formatBytes,
} from "../core/bitrate.js";
import {
  resolveVideoExportConfig,
} from "../core/resolveConfig.js";
import {
  videoSizePresets,
} from "../core/resolution.js";

export interface VideoExportDialogProps {
  open: boolean;
  document: VideoExportDocument;
  previewWidth: number;
  previewHeight: number;
  timelineDuration: number;
  progress?: VideoExportProgress;
  onChange(
    document: VideoExportDocument,
  ): void;
  onStart(): void;
  onCancel(): void;
  onClose(): void;
}

export function VideoExportDialog({
  open,
  document,
  previewWidth,
  previewHeight,
  timelineDuration,
  progress,
  onChange,
  onStart,
  onCancel,
  onClose,
}: VideoExportDialogProps) {
  if (!open) return null;

  const update = (
    mutate: (
      next: VideoExportDocument,
    ) => void,
  ) => {
    const next =
      structuredClone(document);

    mutate(next);
    onChange(next);
  };

  const config =
    resolveVideoExportConfig(
      document,
      {
        previewWidth,
        previewHeight,
        timelineDuration,
      },
    );

  const estimatedSize =
    estimateOutputBytes(
      config.bitrate,
      config.durationSeconds,
    );

  const running =
    progress &&
    ![
      "idle",
      "complete",
      "cancelled",
      "error",
    ].includes(
      progress.stage,
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="video-export-dialog"
    >
      <header>
        <h2>导出 H.264 视频</h2>
        <button
          type="button"
          disabled={running}
          onClick={onClose}
        >
          关闭
        </button>
      </header>

      <section>
        <h3>尺寸</h3>

        <select
          value={document.size.preset}
          disabled={running}
          onChange={(event) =>
            update((next) => {
              next.size.preset =
                event.target
                  .value as
                  VideoExportDocument[
                    "size"
                  ]["preset"];
            })
          }
        >
          {videoSizePresets.map(
            (preset) => (
              <option
                key={preset.id}
                value={preset.id}
              >
                {preset.label}
              </option>
            ),
          )}
        </select>

        <label>
          宽度
          <input
            type="number"
            min={2}
            step={2}
            value={document.size.width}
            disabled={
              running ||
              document.size.preset !==
                "custom"
            }
            onChange={(event) =>
              update((next) => {
                next.size.width =
                  Number(
                    event.target.value,
                  );
              })
            }
          />
        </label>

        <label>
          高度
          <input
            type="number"
            min={2}
            step={2}
            value={document.size.height}
            disabled={
              running ||
              document.size.preset !==
                "custom"
            }
            onChange={(event) =>
              update((next) => {
                next.size.height =
                  Number(
                    event.target.value,
                  );
              })
            }
          />
        </label>

        <div>
          实际输出：
          {config.width}
          {" × "}
          {config.height}
        </div>
      </section>

      <section>
        <h3>时间</h3>

        <label>
          帧率
          <select
            value={document.frameRate}
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.frameRate =
                  Number(
                    event.target.value,
                  ) as
                    VideoExportDocument[
                      "frameRate"
                    ];
              })
            }
          >
            {[24, 25, 30, 50, 60].map(
              (fps) => (
                <option
                  key={fps}
                  value={fps}
                >
                  {fps} fps
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          起点
          <input
            type="number"
            min={0}
            step={0.01}
            value={
              document.range.startSeconds
            }
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.range.startSeconds =
                  Number(
                    event.target.value,
                  );
              })
            }
          />
        </label>

        <label>
          终点
          <input
            type="number"
            min={0}
            step={0.01}
            value={
              document.range.endSeconds
            }
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.range.mode =
                  "custom";

                next.range.endSeconds =
                  Number(
                    event.target.value,
                  );
              })
            }
          />
        </label>

        <div>
          {config.frameCount}
          {" 帧 / "}
          {config.durationSeconds.toFixed(2)}
          {" 秒"}
        </div>
      </section>

      <section>
        <h3>压缩</h3>

        <label>
          质量
          <select
            value={
              document.qualityPreset
            }
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.qualityPreset =
                  event.target
                    .value as
                    VideoExportDocument[
                      "qualityPreset"
                    ];
              })
            }
          >
            <option value="draft">草稿</option>
            <option value="standard">标准</option>
            <option value="high">高质量</option>
            <option value="veryHigh">极高质量</option>
            <option value="custom">自定义</option>
          </select>
        </label>

        <label>
          码率
          <input
            type="number"
            min={100000}
            step={100000}
            value={config.bitrate}
            disabled={
              running ||
              document.qualityPreset !==
                "custom"
            }
            onChange={(event) =>
              update((next) => {
                next.h264.bitrate =
                  Number(
                    event.target.value,
                  );
              })
            }
          />
        </label>

        <div>
          预计文件：
          {formatBytes(
            estimatedSize,
          )}
        </div>
      </section>

      <section>
        <h3>背景与文件</h3>

        <label>
          背景颜色
          <input
            type="color"
            value={
              document.background.color
            }
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.background.mode =
                  "color";

                next.background.color =
                  event.target.value;
              })
            }
          />
        </label>

        <label>
          文件名
          <input
            value={document.fileName}
            disabled={running}
            onChange={(event) =>
              update((next) => {
                next.fileName =
                  event.target.value;
              })
            }
          />
        </label>
      </section>

      {progress && (
        <section>
          <h3>进度</h3>
          <progress
            value={progress.progress}
            max={1}
          />
          <div>{progress.message}</div>
          <div>
            {progress.frameIndex}
            {" / "}
            {progress.frameCount}
          </div>
        </section>
      )}

      <footer>
        {running ? (
          <button
            type="button"
            onClick={onCancel}
          >
            取消导出
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
          >
            开始压缩并下载
          </button>
        )}
      </footer>
    </div>
  );
}
