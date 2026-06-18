import React from "react";
import type {
  CutoutProgress,
  ImageMetadata,
} from "../model/types.js";

export interface SmartCutoutNodeProps {
  sourceName?: string;
  metadata?: ImageMetadata;
  progress?: CutoutProgress;
  selected?: boolean;
  onOpen(): void;
  onRun(): void;
}

export function SmartCutoutNode({
  sourceName,
  metadata,
  progress,
  selected = false,
  onOpen,
  onRun,
}: SmartCutoutNodeProps) {
  return (
    <article
      className="smart-cutout-node"
      data-selected={selected}
    >
      <header>
        <strong>一键抠图</strong>
        <span>
          {metadata?.model ?? "u2netp"}
        </span>
      </header>

      <div>
        <div>
          {sourceName ?? "未连接图片"}
        </div>

        <div>
          {metadata
            ? `${metadata.width} × ${metadata.height}`
            : "等待处理"}
        </div>

        <div>
          {progress?.message ?? "空闲"}
        </div>

        {progress &&
          progress.progress > 0 &&
          progress.progress < 1 && (
            <progress
              value={progress.progress}
              max={1}
            />
          )}
      </div>

      <footer>
        <button
          type="button"
          onClick={onRun}
        >
          一键抠图
        </button>

        <button
          type="button"
          onClick={onOpen}
        >
          打开编辑器
        </button>
      </footer>
    </article>
  );
}
