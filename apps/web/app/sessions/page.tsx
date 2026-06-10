"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  SessionListItemDTO,
  SessionReportStatus,
  TrainingType
} from "@cornerman/shared-types";
import {
  Badge,
  Button,
  Module,
  SegControl,
  StatBox,
  StatStrip,
  Table,
  Tag,
  type BadgeTone
} from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../components/app-frame";
import { api } from "../lib/api";
import { TRAINING_TYPE_LABEL, TRAINING_TYPE_OPTIONS } from "../lib/labels";

type Filter = "all" | TrainingType;

const STATUS_META: Record<
  SessionReportStatus,
  { label: string; tone: BadgeTone }
> = {
  final: { label: "已定稿", tone: "improved" },
  draft: { label: "待复盘", tone: "new" },
  pending: { label: "分析中", tone: "blue" }
};

function weekStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // 周一为 0
  x.setDate(x.getDate() - dow);
  return x.getTime();
}

function consecutiveWeeks(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const weeks = new Set(dates.map((d) => weekStart(d)));
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let cursor = weekStart(new Date());
  if (!weeks.has(cursor)) cursor -= WEEK;
  let count = 0;
  while (weeks.has(cursor)) {
    count += 1;
    cursor -= WEEK;
  }
  return count;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItemDTO[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    const totalMin = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
    const latestScore = sessions.find((s) => s.overallScore != null)
      ?.overallScore;
    const reportCount = sessions.filter(
      (s) => s.reportStatus !== "pending"
    ).length;
    const streak = consecutiveWeeks(sessions.map((s) => new Date(s.trainedAt)));
    return { total, totalMin, latestScore, reportCount, streak };
  }, [sessions]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? sessions
        : sessions.filter((s) => s.trainingType === filter),
    [sessions, filter]
  );

  async function onDelete(e: React.MouseEvent, s: SessionListItemDTO) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确认删除训练「${s.title}」？此操作不可撤销。`)) return;
    setDeletingId(s.id);
    try {
      await api.deleteSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppFrame>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">训练列表</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            共 {stats.total} 次训练 · 已生成 {stats.reportCount} 份复盘报告
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SegControl<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "全部" },
              ...TRAINING_TYPE_OPTIONS.map((o) => ({
                value: o.value as Filter,
                label: o.label
              }))
            ]}
          />
          <Link href="/sessions/new">
            <Button variant="primary">+ 新建训练</Button>
          </Link>
        </div>
      </div>

      <StatStrip className="mb-[18px]">
        <StatBox value={stats.total} label="累计训练" tone="blue" />
        <StatBox
          value={`${(stats.totalMin / 60).toFixed(1)} h`}
          label="累计时长"
        />
        <StatBox
          value={stats.latestScore != null ? stats.latestScore.toFixed(1) : "—"}
          label="最近综合分"
          tone="green"
        />
        <StatBox value={stats.streak} label="连续周数" />
      </StatStrip>

      {loading && <p className="text-ink-3">加载中…</p>}
      {error && (
        <div className="mb-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[13px] text-risk">
          {error}
        </div>
      )}

      {!loading && (
        <Module head="全部训练" meta="点击行进入报告" noBodyPadding>
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13.5px] text-ink-2">
              {sessions.length === 0 ? (
                <>
                  还没有训练记录。
                  <Link href="/sessions/new" className="text-brand">
                    创建第一条
                  </Link>
                  。
                </>
              ) : (
                "该类型下暂无训练。"
              )}
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>训练</th>
                  <th>类型</th>
                  <th>时长</th>
                  <th>综合分</th>
                  <th>状态</th>
                  <th>日期</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const status = STATUS_META[s.reportStatus];
                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="cursor-pointer hover:bg-surface-2"
                    >
                      <td>
                        <strong className="font-semibold">{s.title}</strong>
                        {s.focus && s.focus !== s.title && (
                          <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
                            {s.focus}
                          </div>
                        )}
                      </td>
                      <td>
                        <Tag
                          variant={
                            s.trainingType === "private_lesson"
                              ? "type"
                              : "default"
                          }
                        >
                          {TRAINING_TYPE_LABEL[s.trainingType]}
                        </Tag>
                      </td>
                      <td className="text-ink-2">
                        {s.durationMin != null ? `${s.durationMin} 分钟` : "—"}
                      </td>
                      <td>
                        {s.overallScore != null ? (
                          <>
                            <strong className="font-semibold">
                              {s.overallScore.toFixed(1)}
                            </strong>
                            {s.aiScore != null && (
                              <span className="ml-1.5 text-[11px] text-ink-3">
                                AI {s.aiScore.toFixed(1)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className="text-ink-3">{fmtDate(s.trainedAt)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={(e) => onDelete(e, s)}
                          disabled={deletingId === s.id}
                          className="text-[12px] text-ink-3 hover:text-risk disabled:opacity-50"
                        >
                          {deletingId === s.id ? "删除中…" : "删除"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Module>
      )}
    </AppFrame>
  );
}
