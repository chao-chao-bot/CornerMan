"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TrainingSessionDTO } from "@cornerman/shared-types";
import { Button, Card } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../components/app-frame";
import { api } from "../lib/api";
import { TRAINING_TYPE_LABEL } from "../lib/labels";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<TrainingSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppFrame>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">训练记录</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            每次训练后上传、复盘、沉淀为可追踪的档案
          </p>
        </div>
        <Link href="/sessions/new">
          <Button variant="primary">+ 新建训练</Button>
        </Link>
      </div>

      {loading && <p className="text-ink-3">加载中…</p>}
      {error && (
        <div className="rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[13px] text-risk">
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card>
          <div className="py-8 text-center text-ink-2">
            还没有训练记录。
            <Link href="/sessions/new" className="text-brand">
              创建第一条
            </Link>
            。
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sessions.map((s) => (
          <Link key={s.id} href={`/sessions/${s.id}`}>
            <Card className="mb-0 transition-colors hover:border-line-strong">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded border border-brand-line bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                  {TRAINING_TYPE_LABEL[s.trainingType]}
                </span>
                <span className="text-[11.5px] text-ink-3">
                  {new Date(s.trainedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
              {s.userNote && (
                <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">
                  {s.userNote}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </AppFrame>
  );
}
