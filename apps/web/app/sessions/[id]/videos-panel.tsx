"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoDTO } from "@cornerman/shared-types";
import { Card, Uploader } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { useVideoUpload } from "../../lib/use-video-upload";
import { VIDEO_STATUS_LABEL } from "../../lib/labels";

const STATUS_STYLE: Record<string, string> = {
  uploading: "bg-brand-soft text-brand border-brand-line",
  uploaded: "bg-surface-2 text-ink-2 border-line-strong",
  processing: "bg-revise-soft text-revise border-revise-line",
  ready: "bg-improved-soft text-improved border-improved-line",
  failed: "bg-risk-soft text-risk border-risk-line"
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] ${STATUS_STYLE[status] ?? STATUS_STYLE.uploaded}`}
    >
      {VIDEO_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function VideosPanel({ sessionId }: { sessionId: string }) {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setVideos(await api.listSessionVideos(sessionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    }
  }, [sessionId]);

  const { items, uploadFiles } = useVideoUpload(sessionId, load);

  useEffect(() => {
    void load();
  }, [load]);

  // 有视频处于上传后处理中的状态时，轮询刷新直至全部稳定
  useEffect(() => {
    const pending = videos.some(
      (v) => v.status === "uploaded" || v.status === "processing"
    );
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!pending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [videos, load]);

  const activeUploads = items.filter(
    (it) => it.phase !== "done" && it.phase !== "error"
  );
  const failedUploads = items.filter((it) => it.phase === "error");

  return (
    <Card title="视频">
      <Uploader onFiles={uploadFiles} />

      {error && (
        <div className="mt-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[13px] text-risk">
          {error}
        </div>
      )}

      {activeUploads.map((it) => (
        <div key={it.id} className="mt-3">
          <div className="mb-1 flex justify-between text-[12px] text-ink-2">
            <span className="truncate">{it.fileName}</span>
            <span>
              {it.phase === "uploading"
                ? `${it.progress}%`
                : it.phase === "finalizing"
                  ? "处理入队中…"
                  : "准备中…"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${it.progress}%` }}
            />
          </div>
        </div>
      ))}

      {failedUploads.map((it) => (
        <div
          key={it.id}
          className="mt-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk"
        >
          {it.fileName}：{it.error}
        </div>
      ))}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {videos.map((v) => (
          <div
            key={v.id}
            className="overflow-hidden rounded border border-line bg-surface"
          >
            <div className="relative aspect-video bg-ink/5">
              {v.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.posterUrl}
                  alt={v.originalFileName ?? "封面"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-ink-3">
                  {v.status === "processing" ? "处理中…" : "暂无封面"}
                </div>
              )}
              <div className="absolute left-2 top-2">
                <StatusBadge status={v.status} />
              </div>
            </div>
            <div className="p-3">
              <div className="truncate text-[13px] font-medium">
                {v.originalFileName ?? v.id}
              </div>
              <div className="mt-1 text-[12px] text-ink-3">
                {v.durationMs
                  ? `${Math.round(v.durationMs / 1000)} 秒 · `
                  : ""}
                {v.status === "ready"
                  ? `${v.segmentCount} 个候选片段`
                  : v.status === "failed"
                    ? v.errorMessage || "处理失败"
                    : VIDEO_STATUS_LABEL[v.status]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {videos.length === 0 && activeUploads.length === 0 && (
        <p className="mt-4 text-center text-[13px] text-ink-3">
          还没有视频，上传训练录像后将自动转码并切分候选片段。
        </p>
      )}
    </Card>
  );
}
