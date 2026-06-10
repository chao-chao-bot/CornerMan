/**
 * ai-service 客户端：把签名的 360p 视频 URL 交给姿态分析，拿回
 * 动作片段（出拳串/高低活动）与量化指标。失败/降级一律返回 null，
 * 由调用方回退机械切片，链路永不阻塞。
 */
import type {
  ActionSegmentLabel,
  PoseMetrics,
  PunchEventDTO,
  PunchKind,
  SegmentMetrics
} from "@cornerman/shared-types";

const PUNCH_KINDS: PunchKind[] = ["straight", "hook_swing", "uppercut"];

export interface ActionSegment {
  startMs: number;
  endMs: number;
  label: ActionSegmentLabel;
  confidence: number;
  /** 技术维度标签：label + 主要拳型（straight / hook_swing / uppercut） */
  tags: string[];
  /** 片段级量化指标 */
  metrics?: SegmentMetrics;
}

export interface PoseAnalysis {
  segments: ActionSegment[];
  metrics: PoseMetrics;
}

interface AnalyzeResponseBody {
  stub?: boolean;
  reason?: string;
  action_segments?: {
    start_ms: number;
    end_ms: number;
    label: string;
    confidence: number;
    tags?: string[];
    metrics?: SegmentMetrics;
  }[];
  summary?: {
    duration_ms: number;
    sample_fps: number;
    analyzed_frames: number;
    detect_rate: number;
    punch_count: number;
    punches_per_min: number;
    guard_up_ratio: number;
    stance_width_ratio?: number | null;
    high_activity_ratio: number;
    evade_count?: number;
    punch_types?: Record<string, number>;
  } | null;
  punch_events?: {
    t_ms: number;
    kind: string;
    speed: number;
  }[];
}

const LABELS: ActionSegmentLabel[] = [
  "punch_burst",
  "evade",
  "footwork",
  "guard_hold",
  "high_activity",
  "rest",
  "low_activity"
];

export async function analyzeVideoPose(
  sessionId: string,
  videoUrl: string,
  durationMs: number
): Promise<PoseAnalysis | null> {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return null;

  // 超时随视频时长伸缩：下载 + 8fps 逐帧姿态估计（CPU），上限 10 分钟
  const timeoutMs = Math.round(Math.min(60_000 + durationMs * 0.5, 600_000));

  let body: AnalyzeResponseBody;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, video_url: videoUrl }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
      console.warn(`[video-worker] ai-service HTTP ${res.status}，回退机械切片`);
      return null;
    }
    body = (await res.json()) as AnalyzeResponseBody;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[video-worker] ai-service 调用失败（${msg}），回退机械切片`);
    return null;
  }

  if (body.stub) {
    console.log(
      `[video-worker] ai-service 降级 stub（${body.reason ?? "未知原因"}），回退机械切片`
    );
    return null;
  }

  const segments: ActionSegment[] = (body.action_segments ?? [])
    .filter(
      (s) =>
        Number.isFinite(s.start_ms) &&
        Number.isFinite(s.end_ms) &&
        s.end_ms > s.start_ms &&
        LABELS.includes(s.label as ActionSegmentLabel)
    )
    .map((s) => ({
      startMs: Math.round(s.start_ms),
      endMs: Math.round(s.end_ms),
      label: s.label as ActionSegmentLabel,
      confidence: Math.min(Math.max(s.confidence ?? 0.5, 0), 1),
      tags: s.tags?.length ? s.tags : [s.label],
      metrics: s.metrics
    }));
  if (segments.length === 0) return null;

  const sum = body.summary;
  const metrics: PoseMetrics = sum
    ? {
        punchCount: sum.punch_count,
        punchesPerMin: sum.punches_per_min,
        guardUpRatio: sum.guard_up_ratio,
        stanceWidthRatio: sum.stance_width_ratio ?? undefined,
        highActivityRatio: sum.high_activity_ratio,
        detectRate: sum.detect_rate,
        analyzedFrames: sum.analyzed_frames,
        sampleFps: sum.sample_fps,
        punchTypes: sum.punch_types,
        evadeCount: sum.evade_count
      }
    : {};

  const punchEvents: PunchEventDTO[] = (body.punch_events ?? [])
    .filter(
      (p) => Number.isFinite(p.t_ms) && PUNCH_KINDS.includes(p.kind as PunchKind)
    )
    .map((p) => ({
      tMs: Math.round(p.t_ms),
      kind: p.kind as PunchKind,
      speed: typeof p.speed === "number" ? p.speed : undefined
    }));
  if (punchEvents.length) metrics.punchEvents = punchEvents;

  return { segments, metrics };
}
