"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  PoseMetrics,
  TrainingSessionDTO,
  VideoDTO
} from "@cornerman/shared-types";
import { Button, Module, StatBox, StatStrip } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../../components/app-frame";
import { api } from "../../lib/api";
import { VideosPanel } from "./videos-panel";
import { ReportPanel } from "./report-panel";
import { SessionHeader } from "./session-header";
import type { EvidenceRef, LocateRequest, SeekRequest } from "./types";

function SaveState() {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-improved">
      <span className="h-[7px] w-[7px] rounded-full bg-improved" />
      已自动保存
    </span>
  );
}

export type { SeekRequest } from "./types";

const PUNCH_KIND_LABEL: Record<string, string> = {
  straight: "直拳",
  hook_swing: "勾/摆拳",
  uppercut: "上勾拳"
};

/** 多视频时聚合姿态指标：次数求和，比率取平均 */
function aggregatePoseMetrics(videos: VideoDTO[]): PoseMetrics | null {
  const list = videos
    .filter((v) => v.status === "ready" && v.poseMetrics)
    .map((v) => v.poseMetrics!);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  const avg = (key: keyof PoseMetrics): number | undefined => {
    const vals = list
      .map((m) => m[key])
      .filter((v): v is number => typeof v === "number");
    return vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000
      : undefined;
  };
  const punchTypes: Record<string, number> = {};
  for (const m of list) {
    for (const [k, n] of Object.entries(m.punchTypes ?? {})) {
      punchTypes[k] = (punchTypes[k] ?? 0) + n;
    }
  }
  return {
    punchCount: list.reduce((a, m) => a + (m.punchCount ?? 0), 0),
    punchesPerMin: avg("punchesPerMin"),
    guardUpRatio: avg("guardUpRatio"),
    highActivityRatio: avg("highActivityRatio"),
    detectRate: avg("detectRate"),
    punchTypes: Object.keys(punchTypes).length ? punchTypes : undefined
  };
}

function PoseMetricsModule({ videos }: { videos: VideoDTO[] }) {
  const m = aggregatePoseMetrics(videos);
  if (!m) return null;
  const pct = (v?: number) =>
    typeof v === "number" ? `${(v * 100).toFixed(0)}%` : "—";
  const punchTypesText = Object.entries(m.punchTypes ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${PUNCH_KIND_LABEL[k] ?? k} ${n} 次`)
    .join("、");
  return (
    <Module head="动作指标" meta="姿态分析实测">
      <StatStrip>
        <StatBox value={m.punchCount ?? "—"} label="出拳次数" tone="blue" />
        <StatBox
          value={m.punchesPerMin ?? "—"}
          label="出拳频率（次/分钟）"
        />
        <StatBox
          value={pct(m.guardUpRatio)}
          label="护手到位率"
          tone={typeof m.guardUpRatio === "number" && m.guardUpRatio >= 0.5 ? "green" : "default"}
        />
        <StatBox value={pct(m.highActivityRatio)} label="高强度活动占比" />
      </StatStrip>
      <p className="mt-2.5 text-[11.5px] text-ink-3">
        {punchTypesText ? `拳型分布：${punchTypesText} · ` : ""}
        姿态检出率 {pct(m.detectRate)}（指标由视频姿态估计测量，仅供参考）
      </p>
    </Module>
  );
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSessionDTO | null>(null);
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRef[]>([]);
  const [locate, setLocate] = useState<LocateRequest | null>(null);
  // 重新分析后用 nonce 强制报告面板重载，避免展示旧报告
  const [reportNonce, setReportNonce] = useState(0);

  const reloadSession = useCallback(() => {
    if (!params?.id) return;
    api
      .getSession(params.id)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    reloadSession();
  }, [reloadSession]);

  function requestSeek(videoId: string, ms: number) {
    setSeek({ videoId, ms, nonce: Date.now() });
  }

  function requestLocate(refKey: string) {
    setLocate({ refKey, nonce: Date.now() });
  }

  function handleReanalyzed() {
    setReportNonce((n) => n + 1);
    reloadSession();
  }

  const videosReady = videos.some((v) => v.status === "ready");

  const headerExtras = session ? <SaveState /> : undefined;

  const rightPanel = session ? (
    <ReportPanel
      sessionId={session.id}
      videosReady={videosReady}
      reviewedAt={session.reviewedAt}
      reloadNonce={reportNonce}
      onSeek={requestSeek}
      onEvidence={setEvidence}
      onCompleted={reloadSession}
      locate={locate}
    />
  ) : undefined;

  return (
    <AppFrame headerExtras={headerExtras} rightPanel={rightPanel}>
      <Link href="/sessions" className="text-[13px] text-brand">
        ← 返回训练记录
      </Link>

      {loading && <p className="mt-4 text-ink-3">加载中…</p>}
      {error && (
        <div className="mt-4 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[13px] text-risk">
          {error}
        </div>
      )}

      {session && (
        <div className="mt-3">
          <SessionHeader session={session} videos={videos} />

          <VideosPanel
            sessionId={session.id}
            onVideosChange={setVideos}
            onReanalyzed={handleReanalyzed}
            seek={seek}
            evidence={evidence}
            onLocate={requestLocate}
          />

          <PoseMetricsModule videos={videos} />

          <Module head="我的补充" meta="文字记录">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-revise">
              <span className="h-[13px] w-[3px] rounded-sm bg-revise" />
              我的训练补充
            </div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
              {session.userNote || "（创建训练时未填写感受）"}
            </p>
            <p className="mt-2.5 text-[11.5px] text-ink-3">
              想补充复盘要点？在右侧「+ 新增我的条目」逐条添加，会与 AI 起草并列保留。
            </p>
          </Module>
        </div>
      )}
    </AppFrame>
  );
}
