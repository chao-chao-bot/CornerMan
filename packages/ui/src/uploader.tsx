"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "./cn";

export interface UploaderProps {
  /** 选中文件回调（支持多选，按序处理由调用方决定） */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** accept 属性，默认仅视频 */
  accept?: string;
  className?: string;
  hint?: string;
}

/**
 * 上传选择区：PC 拖拽 + 点击；H5 通过 capture 唤起相册/拍摄。
 * 仅负责选取文件，真正的直传与进度由调用方处理（见 useVideoUpload）。
 */
export function Uploader({
  onFiles,
  disabled = false,
  accept = "video/*",
  className,
  hint = "支持 mp4 / mov，单个最大 2GB"
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    pick(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded border border-dashed px-6 py-8 text-center transition-colors",
        dragOver ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="text-[14px] font-semibold text-ink">
        点击或拖拽视频到此处上传
      </div>
      <div className="mt-1 text-[12px] text-ink-3">{hint}</div>
    </div>
  );
}
