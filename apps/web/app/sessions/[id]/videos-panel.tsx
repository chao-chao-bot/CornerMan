"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Popconfirm, Spin } from "antd";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const segments = video.segments ?? [];
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState((video.durationMs ?? 0) / 1000);
  const [track, setTrack] = useState<TrackMode>("action");
  // 时间线缩放（监控式）：1 = 适配宽度，最大 12 倍
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  // 图例点击隐藏的标签/拳型（echarts 式），切换轨道时清空
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  // 拖动平移后抑制随后的点击 seek
  const panRef = useRef<{
    x: number;
    left: number;
    moved: boolean;
    pointerId: number;
    captured: boolean;
  } | null>(null);
  const draggedRef = useRef(false);

  function toggleKey(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const el = trackRef.current;
    if (!el || dur <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, ratio)) * dur, false);
  }

  // 切换轨道时清空图例隐藏项
  useEffect(() => {
    setHiddenKeys(new Set());
  }, [track]);

  // 以容器内某个 x（相对容器左缘）为锚点缩放，保持该处时间不动
  const zoomAt = useCallback((nextZoom: number, anchorX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cur = zoomRef.current;
    const clamped = Math.min(Math.max(nextZoom, 1), 12);
    if (clamped === cur) return;
    const w = el.clientWidth;
    const ratio = (el.scrollLeft + anchorX) / (w * cur);
    setZoom(clamped);
    requestAnimationFrame(() => {
      const max = w * clamped - w;
      el.scrollLeft = Math.min(Math.max(ratio * w * clamped - anchorX, 0), max);
    });
  }, []);

  // 滚轮缩放（React onWheel 是 passive，无法 preventDefault，手动绑定）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      zoomAt(zoomRef.current * factor, e.clientX - rect.left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // 播放头超出可视区时自动滚动（仅放大时）
  useEffect(() => {
    if (zoom <= 1 || dur <= 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const contentW = w * zoom;
    const headX = (current / dur) * contentW;
    if (headX < el.scrollLeft + 20 || headX > el.scrollLeft + w - 20) {
      el.scrollLeft = Math.min(Math.max(headX - w / 2, 0), contentW - w);
    }
  }, [current, zoom, dur]);

  function onPanStart(e: React.PointerEvent<HTMLDivElement>) {
    if (zoomRef.current <= 1) return;
    const el = scrollRef.current;
    if (!el) return;
    // 此处不捕获指针：否则合成的 click 会被重定向到容器，色块按钮的 onClick 不触发。
    // 仅在真正发生拖动（onPanMove 超阈值）时才捕获。
    panRef.current = {
      x: e.clientX,
      left: el.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
      captured: false
    };
  }
  function onPanMove(e: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const el = scrollRef.current;
    if (!pan || !el) return;
    const dx = e.clientX - pan.x;
    if (Math.abs(dx) > 5) {
      pan.moved = true;
      if (!pan.captured) {
        el.setPointerCapture(pan.pointerId);
        pan.captured = true;
      }
    }
    if (pan.moved) el.scrollLeft = pan.left - dx;
  }
  function onPanEnd() {
    const pan = panRef.current;
    const el = scrollRef.current;
    if (pan?.captured && el) el.releasePointerCapture(pan.pointerId);
    if (pan?.moved) draggedRef.current = true;
    panRef.current = null;
  }

  // 时间刻度：目标 ~8 个刻度，步长取近似的“整”值
  const tickStep = (() => {
    if (dur <= 0) return 0;
    const raw = dur / (8 * zoom);
    const nice = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600];
    return nice.find((s) => s >= raw) ?? 600;
  })();
  const ticks: number[] = [];
  if (tickStep > 0) {
    for (let t = 0; t <= dur + 0.001; t += tickStep) ticks.push(t);
  }

  const playheadPct = dur > 0 ? Math.min((current / dur) * 100, 100) : 0;
  const currentMs = current * 1000;

  const trackEmpty =
    dur === 0 ||
    (track === "action" && segments.length === 0) ||
    (track === "punch" && punchEvents.length === 0) ||
    (track === "evidence" && evidenceCount === 0);

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
                (tag) => {
                  const off = hiddenKeys.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleKey(tag)}
                      title="点击隐藏/显示"
                      className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 ${off ? "opacity-40" : ""}`}
                    >
                      <i
                        className={`h-[9px] w-[9px] rounded-[2px] ${off ? "border border-ink-3 bg-transparent" : (TAG_COLOR[tag] ?? "bg-brand")}`}
                      />
                      {SEGMENT_TAG_LABEL[tag] ?? tag}
                    </button>
                  );
                }
              )}
            {track === "punch" &&
              (["straight", "hook_swing", "uppercut"] as const)
                .filter((k) => punchKindCount[k])
                .map((k) => {
                  const off = hiddenKeys.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleKey(k)}
                      title="点击隐藏/显示"
                      className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 ${off ? "opacity-40" : ""}`}
                    >
                      <i
                        className={`h-[9px] w-[9px] rounded-[2px] ${off ? "border border-ink-3 bg-transparent" : PUNCH_KIND_COLOR[k]}`}
                      />
                      {PUNCH_KIND_LABEL[k]} {punchKindCount[k]}
                    </button>
                  );
                })}
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
          ref={scrollRef}
          onPointerDown={onPanStart}
          onPointerMove={onPanMove}
          onPointerUp={onPanEnd}
          onPointerCancel={onPanEnd}
          className={`relative overflow-x-auto overflow-y-hidden rounded-[7px] border border-line bg-surface-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          {!trackEmpty && (
          <div
            ref={trackRef}
            onClick={playable ? onTrackClick : undefined}
            style={{ width: `${zoom * 100}%` }}
            className={`relative h-[38px] ${playable ? "cursor-pointer" : ""}`}
          >
            {dur > 0 &&
              track === "action" &&
              segments
                .filter((s) => !hiddenKeys.has(s.tags[0] ?? "candidate"))
                .map((s: VideoSegmentDTO) => {
                  const left = (s.startMs / (dur * 1000)) * 100;
                  const width = ((s.endMs - s.startMs) / (dur * 1000)) * 100;
                  const active = currentMs >= s.startMs && currentMs < s.endMs;
                  const color =
                    TAG_COLOR[s.tags[0] ?? "candidate"] ?? "bg-brand";
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
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
                      title={segTooltip(s)}
                      aria-label={`跳转到 ${fmtSec(s.startMs / 1000)}`}
                    />
                  );
                })}
            {dur > 0 &&
              track === "punch" &&
              punchEvents
                .filter((p) => !hiddenKeys.has(p.kind))
                .map((p, i) => {
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
                        active
                          ? "opacity-100 ring-1 ring-ink/50"
                          : "opacity-75 hover:opacity-100"
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
                  const width = ((s.endMs - s.startMs) / (dur * 1000)) * 100;
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
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
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
            {/* 时间刻度 */}
            {dur > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10px]">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute bottom-0 w-px bg-line-strong"
                    style={{ left: `${(t / dur) * 100}%`, height: 4 }}
                  />
                ))}
              </div>
            )}
          </div>
          )}
          {track === "action" && (dur === 0 || segments.length === 0) && (
            <div className="flex h-[38px] items-center justify-center text-[11px] text-ink-3">
              {video.status === "processing"
                ? "分析中…"
                : video.status === "ready"
                  ? "无动作片段"
                  : "处理后生成动作片段"}
            </div>
          )}
          {track === "punch" && punchEvents.length === 0 && (
            <div className="flex h-[38px] items-center justify-center text-[11px] text-ink-3">
              {video.status === "processing"
                ? "分析中…"
                : video.status === "ready"
                  ? "无逐拳数据（重新分析后生成）"
                  : "处理后生成拳型数据"}
            </div>
          )}
          {track === "evidence" && evidenceCount === 0 && (
            <div className="flex h-[38px] items-center justify-center text-[11px] text-ink-3">
              报告暂未引用本视频的片段
            </div>
          )}
        </div>
        {dur > 0 && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-3">
            <span className="tabular-nums">{fmtSec(current)}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const el = scrollRef.current;
                  zoomAt(zoom / 1.5, el ? el.clientWidth / 2 : 0);
                }}
                disabled={zoom <= 1}
                className="rounded border border-line px-1.5 leading-[14px] hover:border-brand hover:text-brand disabled:opacity-40"
                aria-label="缩小"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  requestAnimationFrame(() => {
                    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
                  });
                }}
                className="rounded border border-line px-1.5 leading-[14px] tabular-nums hover:border-brand hover:text-brand"
                title="复位"
              >
                {zoom.toFixed(1)}x
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = scrollRef.current;
                  zoomAt(zoom * 1.5, el ? el.clientWidth / 2 : 0);
                }}
                disabled={zoom >= 12}
                className="rounded border border-line px-1.5 leading-[14px] hover:border-brand hover:text-brand disabled:opacity-40"
                aria-label="放大"
              >
                +
              </button>
              <span className="ml-0.5 text-ink-3">滚轮缩放</span>
            </span>
            <span className="tabular-nums">{fmtSec(dur)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideosPanel({
  sessionId,
  onVideosChange,
  onReanalyzed,
  seek,
  evidence,
  onLocate
}: {
  sessionId: string;
  onVideosChange?: (videos: VideoDTO[]) => void;
  /** 重新分析触发后通知父级刷新报告/状态 */
  onReanalyzed?: () => void;
  seek?: SeekRequest | null;
  evidence?: EvidenceRef[];
  onLocate?: (refKey: string) => void;
}) {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
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
    } finally {
      setLoaded(true);
    }
  }, [sessionId, onVideosChange]);

  useEffect(() => {
    void load();
  }, [load]);

  // processing 也允许重试：避免任务异常时按钮被隐藏导致无法自救
  const canReanalyze = videos.some(
    (v) =>
      v.status === "ready" ||
      v.status === "failed" ||
      v.status === "processing"
  );

  async function handleReanalyze(): Promise<void> {
    setReanalyzing(true);
    try {
      await api.reanalyzeSession(sessionId);
      await load();
      onReanalyzed?.();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重新分析失败");
    } finally {
      setReanalyzing(false);
    }
  }

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
    <Module
      head="训练视频"
      meta={
        <span className="flex items-center gap-3">
          {videos.length ? <span>{videos.length} 个</span> : null}
          {canReanalyze && (
            <Popconfirm
              title="重新分析这些视频？"
              description="将重建动作片段与拳型数据，并用新分析覆盖原有 AI 草稿与复盘。"
              okText="重新分析"
              cancelText="取消"
              okButtonProps={{ loading: reanalyzing }}
              onConfirm={handleReanalyze}
            >
              <button
                type="button"
                disabled={reanalyzing}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {reanalyzing ? <Spin size="small" /> : "重新分析"}
              </button>
            </Popconfirm>
          )}
        </span>
      }
    >
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

      {!loaded && (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      )}

      {loaded && videos.length === 0 && (
        <p className="py-4 text-center text-[13px] text-ink-3">
          该训练没有视频。视频在「新建训练」时一并上传。
        </p>
      )}
    </Module>
  );
}
