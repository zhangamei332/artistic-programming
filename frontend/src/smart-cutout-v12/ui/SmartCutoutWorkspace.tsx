import React, {
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  SmartCutoutDocument,
} from "../model/types.js";
import {
  CropperWorkspaceAdapter,
} from "../adapters/CropperWorkspaceAdapter.js";

export interface SmartCutoutWorkspaceProps {
  sourceUrl: string;
  document: SmartCutoutDocument;
  onChange(
    document: SmartCutoutDocument,
  ): void;
}

export function SmartCutoutWorkspace({
  sourceUrl,
  document,
  onChange,
}: SmartCutoutWorkspaceProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const adapter =
    useMemo(
      () =>
        new CropperWorkspaceAdapter(),
      [],
    );

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) return;

    adapter.mount(
      container,
      sourceUrl,
      ({ crop }) => {
        const next =
          structuredClone(document);

        next.crop.enabled = true;
        next.crop.rect = crop;

        onChange(next);
      },
    );

    adapter.applyTransform(
      document.transform,
    );

    adapter.setAspectRatio(
      document.crop.aspectRatio,
    );

    return () =>
      adapter.destroy();
  }, [adapter, sourceUrl]);

  useEffect(() => {
    adapter.applyTransform(
      document.transform,
    );

    adapter.setAspectRatio(
      document.crop.aspectRatio,
    );
  }, [
    adapter,
    document.transform,
    document.crop.aspectRatio,
  ]);

  return (
    <div className="smart-cutout-workspace">
      <div
        ref={containerRef}
        className="smart-cutout-cropper"
      />

      <div className="smart-cutout-workspace-toolbar">
        <button
          type="button"
          onClick={() =>
            adapter.rotate(-90)
          }
        >
          左转
        </button>

        <button
          type="button"
          onClick={() =>
            adapter.rotate(90)
          }
        >
          右转
        </button>

        <button
          type="button"
          onClick={() =>
            adapter.zoom(0.1)
          }
        >
          放大
        </button>

        <button
          type="button"
          onClick={() =>
            adapter.zoom(-0.1)
          }
        >
          缩小
        </button>

        <button
          type="button"
          onClick={() =>
            adapter.reset()
          }
        >
          重置
        </button>
      </div>
    </div>
  );
}
