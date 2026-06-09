"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TrainingSessionDTO } from "@cornerman/shared-types";
import { Card } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../../components/app-frame";
import { api } from "../../lib/api";
import { TRAINING_TYPE_LABEL } from "../../lib/labels";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSessionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <AppFrame>
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
        <div className="mt-3 max-w-[720px]">
          <div className="mb-[18px] flex items-center gap-3">
            <h1 className="text-[22px] font-bold tracking-tight">
              {session.title}
            </h1>
            <span className="rounded border border-brand-line bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
              {TRAINING_TYPE_LABEL[session.trainingType]}
            </span>
          </div>

          <Card title="训练信息">
            <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-[13.5px]">
              <dt className="text-ink-3">训练日期</dt>
              <dd>{new Date(session.trainedAt).toLocaleString("zh-CN")}</dd>
              <dt className="text-ink-3">本次感受</dt>
              <dd>{session.userNote || "（未填写）"}</dd>
            </dl>
          </Card>

          <Card title="视频与 AI 复盘">
            <p className="py-6 text-center text-[13px] text-ink-3">
              视频上传与 AI 复盘将在 P2 / P3 阶段开放。
            </p>
          </Card>
        </div>
      )}
    </AppFrame>
  );
}
