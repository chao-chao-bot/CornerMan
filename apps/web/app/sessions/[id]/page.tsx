"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TrainingSessionDTO, VideoDTO } from "@cornerman/shared-types";
import { Button, Module } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../../components/app-frame";
import { api } from "../../lib/api";
import { VideosPanel } from "./videos-panel";
import { ReportPanel } from "./report-panel";
import { SessionHeader } from "./session-header";

function SaveState() {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-improved">
      <span className="h-[7px] w-[7px] rounded-full bg-improved" />
      已自动保存
    </span>
  );
}

export type SeekRequest = { videoId: string; ms: number; nonce: number };

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSessionDTO | null>(null);
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    api
      .getSession(params.id)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, [params?.id]);

  function requestSeek(videoId: string, ms: number) {
    setSeek({ videoId, ms, nonce: Date.now() });
  }

  const videosReady = videos.some((v) => v.status === "ready");

  const headerExtras = session ? <SaveState /> : undefined;

  const rightPanel = session ? (
    <ReportPanel
      sessionId={session.id}
      videosReady={videosReady}
      onSeek={requestSeek}
      onEvidence={setEvidenceIds}
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
            seek={seek}
            evidenceIds={evidenceIds}
          />

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
