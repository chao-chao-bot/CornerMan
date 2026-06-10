"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoDTO, VideoSegmentDTO } from "@cornerman/shared-types";
import { Module, SegControl } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import {
  PUNCH_KIND_LABEL,
  SEGMENT_TAG_LABEL,
  VIDEO_STATUS_LABEL
} from "../../lib/labels";
import type { EvidenceRef, SeekRequest } from "./types";

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

/** 动作片段主标签 → 时间线色块 */
const TAG_COLOR: Record<string, string> = {
  punch_burst: "bg-brand",
  evade: "bg-risk",
  footwork: "bg-revise",
  guard_hold: "bg-improved",
  high_activity: "bg-brand/55",
  rest: "bg-ink-3/35",
  low_activity: "bg-ink-3/35",
  candidate: "bg-brand/70"
};

/** 片段 tooltip：时间 + 标签 + 关键指标 */
function segTooltip(s: VideoSegmentDTO): string {
  const time = `${fmtSec(s.startMs / 1000)}–${fmtSec(s.endMs / 1000)}`;
  const tags = s.tags.map((t) => SEGMENT_TAG_LABEL[t] ?? t).join(" · ");
  const parts: string[] = [];
  const m = s.metrics;
  if (m) {
    if (typeof m.punchCount === "number" && m.punchCount > 0) {
      parts.push(`出拳 ${m.punchCount} 次`);
    }
    if (m.punchTypes && Object.keys(m.punchTypes).length) {
      parts.push(
        Object.entries(m.punchTypes)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${PUNCH_KIND_LABEL[k] ?? k}×${n}`)
          .join(" ")
      );
    }
    if (typeof m.evadeCount === "number" && m.evadeCount > 0) {
      parts.push(`躲闪 ${m.evadeCount} 次`);
    }
    if (typeof m.guardUpRatio === "number") {
      parts.push(`护手 ${(m.guardUpRatio * 100).toFixed(0)}%`);
    }
    if (typeof m.footworkIntensity === "number") {
      parts.push(`步伐 ${m.footworkIntensity}`);
    }
  }
  return [time, tags, parts.join("，")].filter(Boolean).join(" · ");
}

/** 拳型 → 时间轴色点 */
const PUNCH_KIND_COLOR: Record<string, string> = {
  straight: "bg-brand",
  hook_swing: "bg-revise",
  uppercut: "bg-risk"
};

type TrackMode = "action" | "punch" | "evidence";

/** 单个视频的内嵌播放台 + 双轨时间线（动作片段 / 证据片段） */
function VideoStage({
  video,
  seek,
  evidence,
  onLocate
}: {
  video: VideoDTO;
  seek?: SeekRequest | null;
  evidence?: EvidenceRef[];
  onLocate?: (refKey: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const segments = video.segments ?? [];
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState((video.durationMs ?? 0) / 1000);
  const [track, setTrack] = useState<TrackMode>("action");

  const playable = video.status === "ready" && Boolean(video.playbackUrl);

  // 本视频片段被报告引用的证据：segmentId → 引用列表
  const segIds = new Set(segments.map((s) => s.id));
  const evidenceBySeg = new Map<string, EvidenceRef[]>();
  for (const ref of evidence ?? []) {
    if (!segIds.has(ref.segmentId)) continue;
    const list = evidenceBySeg.get(ref.segmentId) ?? [];
    list.push(ref);
    evidenceBySeg.set(ref.segmentId, list);
  }
  const evidenceCount = evidenceBySeg.size;

  // 逐拳事件（拳型轨）；按拳型统计计数用于图例
  const punchEvents = video.poseMetrics?.punchEvents ?? [];
  const punchKindCount = punchEvents.reduce<Record<string, number>>((acc, p) => {
    acc[p.kind] = (acc[p.kind] ?? 0) + 1;
    return acc;
  }, {});

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
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold text-ink-2">
              关键片段时间线
            </span>
            <SegControl<TrackMode>
              value={track}
              onChange={setTrack}
              className="[&>button]:px-2.5 [&>button]:py-1 [&>button]:text-[11px]"
              options={[
                { value: "action", label: `动作片段 ${segments.length}` },
                { value: "punch", label: `拳型 ${punchEvents.length}` },
                { value: "evidence", label: `证据片段 ${evidenceCount}` }
              ]}
            />
          </span>
          <span className="flex items-center gap-3 text-[11px] text-ink-3">
            {track === "action" &&
              [...new Set(segments.map((s) => s.tags[0] ?? "candidate"))].map(
                (tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5">
                    <i
                      className={`h-[9px] w-[9px] rounded-[2px] ${TAG_COLOR[tag] ?? "bg-brand"}`}
                    />
                    {SEGMENT_TAG_LABEL[tag] ?? tag}
                  </span>
                )
              )}
            {track === "punch" &&
              (["straight", "hook_swing", "uppercut"] as const)
                .filter((k) => punchKindCount[k])
                .map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <i
                      className={`h-[9px] w-[9px] rounded-[2px] ${PUNCH_KIND_COLOR[k]}`}
                    />
                    {PUNCH_KIND_LABEL[k]} {punchKindCount[k]}
                  </span>
                ))}
            {track === "evidence" && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-[9px] w-[9px] rounded-[2px] bg-brand" />
                  复盘条目引用
                </span>
                <span>点击可定位右侧条目</span>
              </>
            )}
          </span>
        </div>
        <div
          ref={trackRef}
          onClick={playable ? onTrackClick : undefined}
          className={`relative h-[38px] overflow-hidden rounded-[7px] border border-line bg-surface-2 ${playable ? "cursor-pointer" : ""}`}
        >
          {dur > 0 &&
            track === "action" &&
            segments.map((s: VideoSegmentDTO) => {
              const left = (s.startMs / (dur * 1000)) * 100;
              const width = Math.max(
                ((s.endMs - s.startMs) / (dur * 1000)) * 100,
                1.5
              );
              const active = currentMs >= s.startMs && currentMs < s.endMs;
              const color = TAG_COLOR[s.tags[0] ?? "candidate"] ?? "bg-brand";
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!playable}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(s.startMs / 1000);
                  }}
                  className={`absolute top-1.5 h-[26px] rounded-[4px] transition-opacity ${color} ${
                    active
                      ? "opacity-100 ring-2 ring-brand/40"
                      : "opacity-70 hover:opacity-95"
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={segTooltip(s)}
                  aria-label={`跳转到 ${fmtSec(s.startMs / 1000)}`}
                />
              );
            })}
          {dur > 0 &&
            track === "punch" &&
            punchEvents.map((p, i) => {
              const left = (p.tMs / (dur * 1000)) * 100;
              const active =
                currentMs >= p.tMs - 200 && currentMs < p.tMs + 200;
              const color = PUNCH_KIND_COLOR[p.kind] ?? "bg-brand";
              return (
                <button
                  key={`${p.tMs}-${i}`}
                  type="button"
                  disabled={!playable}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(Math.max(0, p.tMs / 1000 - 0.5));
                  }}
                  className={`absolute top-1.5 h-[26px] w-[3px] -translate-x-1/2 rounded-[1px] transition-opacity ${color} ${
                    active ? "opacity-100 ring-1 ring-ink/50" : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ left: `${left}%` }}
                  title={`${fmtSec(p.tMs / 1000)} · ${PUNCH_KIND_LABEL[p.kind] ?? p.kind}${
                    typeof p.speed === "number" ? ` · 腕速 ${p.speed}` : ""
                  }`}
                  aria-label={`跳转到 ${fmtSec(p.tMs / 1000)} 的${PUNCH_KIND_LABEL[p.kind] ?? "出拳"}`}
                />
              );
            })}
          {dur > 0 &&
            track === "evidence" &&
            segments
              .filter((s) => evidenceBySeg.has(s.id))
              .map((s) => {
                const refs = evidenceBySeg.get(s.id)!;
                const left = (s.startMs / (dur * 1000)) * 100;
                const width = Math.max(
                  ((s.endMs - s.startMs) / (dur * 1000)) * 100,
                  1.5
                );
                const active = currentMs >= s.startMs && currentMs < s.endMs;
                const color = "bg-brand";
                const primary = refs[0];
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!playable}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(s.startMs / 1000);
                      onLocate?.(primary.refKey);
                    }}
                    className={`absolute top-1.5 h-[26px] rounded-[4px] transition-opacity ${color} ${
                      active
                        ? "opacity-100 ring-2 ring-brand/40"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmtSec(s.startMs / 1000)}–${fmtSec(s.endMs / 1000)} · ${refs
                      .map((r) => r.label)
                      .join("；")}`}
                    aria-label={`定位 ${primary.label}`}
                  />
                );
              })}
          {playable && dur > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-ink"
              style={{ left: `${playheadPct}%` }}
            />
          )}
          {track === "action" && (dur === 0 || segments.length === 0) && (
            <div className="flex h-full items-center justify-center text-[11px] text-ink-3">
              {video.status === "ready" ? "无动作片段" : "处理后生成动作片段"}
            </div>
          )}
          {track === "punch" && punchEvents.length === 0 && (
            <div className="flex h-full items-center justify-center text-[11px] text-ink-3">
              {video.status === "ready"
                ? "无逐拳数据（重新分析后生成）"
                : "处理后生成拳型数据"}
            </div>
          )}
          {track === "evidence" && evidenceCount === 0 && (
            <div className="flex h-full items-center justify-center text-[11px] text-ink-3">
              报告暂未引用本视频的片段
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
  evidence,
  onLocate
}: {
  sessionId: string;
  onVideosChange?: (videos: VideoDTO[]) => void;
  seek?: SeekRequest | null;
  evidence?: EvidenceRef[];
  onLocate?: (refKey: string) => void;
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

  return (
    <Module head="训练视频" meta={videos.length ? `${videos.length} 个` : undefined}>
      {error && (
        <div className="mb-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[13px] text-risk">
          {error}
        </div>
      )}

      <div>
        {videos.map((v) => (
          <div key={v.id}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="truncate text-[13px] font-medium">
                {v.originalFileName ?? v.id}
              </span>
              <StatusBadge status={v.status} />
            </div>
            <VideoStage
              video={v}
              seek={seek}
              evidence={evidence}
              onLocate={onLocate}
            />
          </div>
        ))}
      </div>

      {videos.length === 0 && (
        <p className="py-4 text-center text-[13px] text-ink-3">
          该训练没有视频。视频在「新建训练」时一并上传。
        </p>
      )}
    </Module>
  );
}
