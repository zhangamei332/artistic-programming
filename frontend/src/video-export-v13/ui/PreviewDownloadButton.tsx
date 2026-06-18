import React, {
  useState,
} from "react";

export interface PreviewDownloadButtonProps {
  onDownloadImage(): void;
  onOpenVideoExport(): void;
}

export function PreviewDownloadButton({
  onDownloadImage,
  onOpenVideoExport,
}: PreviewDownloadButtonProps) {
  const [open, setOpen] =
    useState(false);

  return (
    <div className="preview-download-button">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) => !value,
          )
        }
      >
        下载
      </button>

      {open && (
        <div
          role="menu"
          className="preview-download-menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDownloadImage();
            }}
          >
            下载图片
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenVideoExport();
            }}
          >
            下载 H.264 视频
          </button>
        </div>
      )}
    </div>
  );
}
