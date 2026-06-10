"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoDTO, VideoSegmentDTO } from "@cornerman/shared-types";
import { Module, Uploader } from "@cornerman/ui";
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

function fmtSec(sec: number): string {
  const t = Math.max(0, Math.round(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

type SeekRequest = { videoId: string; ms: number; nonce: number };

/** 单个视频的内嵌播放台 + 与播放联动的候选片段时间线 */
function VideoStage({
  video,
  seek,
  evidenceIds
}: {
  video: VideoDTO;
  seek?: SeekRequest | null;
  evidenceIds?: string[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const segments = video.segments ?? [];
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState((video.durationMs ?? 0) / 1000);

  const playable = video.status === "ready" && Boolean(video.playbackUrl);
  const evidenceSet = new Set(evidenceIds ?? []);
  const hasEvidence = evidenceSet.size > 0;

  function seekTo(sec: number, play = true) {
    const v = videoRef.current;
    if (!v || !Number.isFinite(sec)) return;
    v.currentTime = Math.max(0, Math.min(sec, dur || sec));
    if (play) void v.play();
  }

  // 报告侧点击证据片段 → 滚动到本视频并跳转播放
  useEffect(() => {
    if (!seek || seek.videoId !== video.id || !playable) return;
    wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    seekTo(seek.ms / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seek?.nonce]);

  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el || dur <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, ratio)) * dur, false);
  }

  const playheadPct = dur > 0 ? Math.min((current / dur) * 100, 100) : 0;
  const currentMs = current * 1000;

  return (
    <div
      ref={wrapRef}
      className="mb-3 overflow-hidden rounded border border-line bg-surface"
    >
      <div className="relative flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2c3440,#161b22)]">
        {playable ? (
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={video.posterUrl}
            src={video.playbackUrl}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDur(d);
            }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : video.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.posterUrl}
            alt={video.originalFileName ?? "封面"}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : null}

        {playable && !playing && (
          <span className="pointer-events-none relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white/95">
            <span className="ml-1 border-y-[10px] border-l-[16px] border-y-transparent border-l-brand" />
          </span>
        )}

        {!playable && (
          <div className="absolute bottom-3 text-[12px] text-white/70">
            {video.status === "failed"
              ? video.errorMessage || "处理失败"
              : `${VIDEO_STATUS_LABEL[video.status]}…`}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink-2">
            关键片段时间线
          </span>
          <span className="flex items-center gap-3 text-[11px] text-ink-3">
            {hasEvidence ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-[9px] w-[9px] rounded-[2px] bg-brand" />
                  AI 引用片段
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-[9px] w-[9px] rounded-[2px] bg-brand/25" />
                  其他候选
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <i className="h-[9px] w-[9px] rounded-[2px] bg-brand" />
                候选片段（点击跳转）
              </span>
            )}
          </span>
        </div>
        <div
          ref={trackRef}
          onClick={playable ? onTrackClick : undefined}
          className={`relative h-[38px] overflow-hidden rounded-[7px] border border-line bg-surface-2 ${playable ? "cursor-pointer" : ""}`}
        >
          {dur > 0 &&
            segments.map((s: VideoSegmentDTO) => {
              const left = (s.startMs / (dur * 1000)) * 100;
              const width = Math.max(
                ((s.endMs - s.startMs) / (dur * 1000)) * 100,
                1.5
              );
              const active = currentMs >= s.startMs && currentMs < s.endMs;
              const isEvidence = evidenceSet.has(s.id);
              const dimmed = hasEvidence && !isEvidence;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!playable}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(s.startMs / 1000);
                  }}
                  className={`absolute top-1.5 h-[26px] rounded-[4px] transition-opacity ${
                    dimmed ? "bg-brand/25 hover:bg-brand/40" : "bg-brand"
                  } ${
                    active
                      ? "opacity-100 ring-2 ring-brand/40"
                      : dimmed
                        ? "opacity-100"
                        : "opacity-70 hover:opacity-95"
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${fmtSec(s.startMs / 1000)}–${fmtSec(s.endMs / 1000)}${isEvidence ? " · AI 引用" : ""}`}
                  aria-label={`跳转到 ${fmtSec(s.startMs / 1000)}`}
                />
              );
            })}
          {playable && dur > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-ink"
              style={{ left: `${playheadPct}%` }}
            />
          )}
          {(dur === 0 || segments.length === 0) && (
            <div className="flex h-full items-center justify-center text-[11px] text-ink-3">
              {video.status === "ready" ? "无候选片段" : "处理后生成候选片段"}
            </div>
          )}
        </div>
        {dur > 0 && (
          <div className="mt-1.5 flex justify-between text-[10px] text-ink-3">
            <span>{fmtSec(current)}</span>
            <span>{fmtSec(dur)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideosPanel({
  sessionId,
  onVideosChange,
  seek,
  evidenceIds
}: {
  sessionId: string;
  onVideosChange?: (videos: VideoDTO[]) => void;
  seek?: SeekRequest | null;
  evidenceIds?: string[];
}) {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      // 详情含 segments，逐个取以渲染时间线
      const list = await api.listSessionVideos(sessionId);
      const detailed = await Promise.all(
        list.map((v) =>
          v.status === "ready" ? api.getVideo(v.id).catch(() => v) : v
        )
      );
      setVideos(detailed);
      onVideosChange?.(detailed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    }
  }, [sessionId, onVideosChange]);

  const { items, uploadFiles } = useVideoUpload(sessionId, load);

  useEffect(() => {
    void load();
  }, [load]);

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
    <Module head="训练视频" meta={videos.length ? `${videos.length} 个` : undefined}>
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

      <div className="mt-4">
        {videos.map((v) => (
          <div key={v.id}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="truncate text-[13px] font-medium">
                {v.originalFileName ?? v.id}
              </span>
              <StatusBadge status={v.status} />
            </div>
            <VideoStage video={v} seek={seek} evidenceIds={evidenceIds} />
          </div>
        ))}
      </div>

      {videos.length === 0 && activeUploads.length === 0 && (
        <p className="mt-4 text-center text-[13px] text-ink-3">
          还没有视频，上传训练录像后将自动转码并切分候选片段。
        </p>
      )}
    </Module>
  );
}
