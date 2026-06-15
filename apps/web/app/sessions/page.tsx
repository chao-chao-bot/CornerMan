"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SessionListItemDTO,
  SessionOutcomeResult,
  TrainingType
} from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { HigScaffold } from "../components/hig/scaffold";
import { CreateFab } from "../components/hig/create-fab";
import {
  BoltIcon,
  DumbbellIcon,
  ChevronRightIcon,
  MinusIcon,
  NoteIcon,
  SCENE_ICON_FILL
} from "../components/hig/icons";
import { clearAuth } from "../lib/auth";
import { api } from "../lib/api";
import { TRAINING_TYPE_LABEL } from "../lib/labels";

type Filter = "all" | TrainingType;
type OutcomeFilter = "all" | SessionOutcomeResult;

const TYPE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "private_lesson", label: "私教" },
  { value: "self_training", label: "自训" },
  { value: "sparring", label: "实战" }
];

const OUTCOME_FILTERS: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "win", label: "胜" },
  { value: "draw", label: "平" },
  { value: "loss", label: "负" }
];

const OUTCOME_META: Record<
  SessionOutcomeResult,
  { label: string; tone: string } | null
> = {
  win: { label: "胜", tone: "green" },
  draw: { label: "平", tone: "orange" },
  loss: { label: "负", tone: "red" },
  unscored: null
};

function TypeIcon({ type }: { type: TrainingType }) {
  if (type === "sparring") return <BoltIcon />;
  if (type === "self_training") return <DumbbellIcon />;
  return <NoteIcon />;
}

function weekStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
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
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
    const totalMin = sessions.reduce((s, x) => s + (x.durationMin ?? 0), 0);
    const thisWeekStart = weekStart(new Date());
    const thisWeek = sessions.filter(
      (s) => new Date(s.trainedAt).getTime() >= thisWeekStart
    ).length;
    const streak = consecutiveWeeks(sessions.map((s) => new Date(s.trainedAt)));
    return { total, totalMin, thisWeek, streak };
  }, [sessions]);

  const hasActiveFilter =
    filter !== "all" || outcomeFilter !== "all" || Boolean(from || to);

  function clearFilters() {
    setFilter("all");
    setOutcomeFilter("all");
    setFrom("");
    setTo("");
  }

  const filtered = useMemo(() => {
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : undefined;
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : undefined;
    return sessions.filter((s) => {
      if (filter !== "all" && s.trainingType !== filter) return false;
      if (outcomeFilter !== "all" && s.outcome?.result !== outcomeFilter)
        return false;
      const t = new Date(s.trainedAt).getTime();
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
      return true;
    });
  }, [sessions, filter, outcomeFilter, from, to]);

  async function onDelete(s: SessionListItemDTO) {
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

  function logout() {
    clearAuth();
    router.replace("/login");
  }

  const leading = (
    <button type="button" className="hig-navbtn" onClick={logout}>
      退出
    </button>
  );

  const trailing =
    sessions.length > 0 ? (
      <button
        type="button"
        className={`hig-navbtn${editing ? " strong" : ""}`}
        onClick={() => setEditing((v) => !v)}
      >
        {editing ? "完成" : "编辑"}
      </button>
    ) : undefined;

  return (
    <HigScaffold title="训练" leading={leading} trailing={trailing}>
      <div className="hig-large-title">
        训练
        <span className="sub">
          共 {stats.total} 次 · 本周 {stats.thisWeek}
        </span>
      </div>

      {/* 统计 */}
      <div className="hig-stat-row">
        <div className="hig-stat">
          <div className="v blue">{stats.total}</div>
          <div className="l">累计训练</div>
        </div>
        <div className="hig-stat">
          <div className="v">{(stats.totalMin / 60).toFixed(1)}h</div>
          <div className="l">累计时长</div>
        </div>
        <div className="hig-stat">
          <div className="v green">{stats.thisWeek}</div>
          <div className="l">本周训练</div>
        </div>
        <div className="hig-stat">
          <div className="v">{stats.streak}</div>
          <div className="l">连续周</div>
        </div>
      </div>

      {/* 类型筛选 + 展开 */}
      <div style={{ padding: "10px 16px 0", display: "flex", gap: 8 }}>
        <div className="hig-seg" style={{ display: "flex", flex: 1 }}>
          {TYPE_FILTERS.map((o) => (
            <button
              key={o.value}
              type="button"
              style={{ flex: 1 }}
              className={filter === o.value ? "on" : ""}
              onClick={() => setFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`hig-navbtn${showFilters || hasActiveFilter ? " strong" : ""}`}
          style={{ minHeight: 36 }}
          onClick={() => setShowFilters((v) => !v)}
        >
          筛选
        </button>
      </div>

      {(showFilters || hasActiveFilter) && (
        <div className="hig-filter">
          <div className="hig-seg" style={{ display: "flex" }}>
            {OUTCOME_FILTERS.map((o) => (
              <button
                key={o.value}
                type="button"
                style={{ flex: 1 }}
                className={outcomeFilter === o.value ? "on" : ""}
                onClick={() => setOutcomeFilter(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="dates">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {hasActiveFilter && (
            <button type="button" className="hig-clear" onClick={clearFilters}>
              清除筛选
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, padding: "10px 32px 0" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="hig-loading">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="hig-empty">
          {sessions.length === 0
            ? "还没有训练记录，点右下角 + 选择模板开始复盘。"
            : "没有符合筛选条件的训练。"}
        </div>
      ) : (
        <>
          <div className="hig-section-header">
            全部训练（{filtered.length} / {sessions.length}）
          </div>
          <div className="hig-list">
            {filtered.map((s) => {
              const outcome = s.outcome
                ? OUTCOME_META[s.outcome.result]
                : null;
              return (
                <div
                  key={s.id}
                  className="hig-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => !editing && router.push(`/sessions/${s.id}`)}
                >
                  {editing ? (
                    <button
                      type="button"
                      className="del"
                      disabled={deletingId === s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDelete(s);
                      }}
                      aria-label="删除"
                    >
                      <MinusIcon />
                    </button>
                  ) : (
                    <span
                      className={`leading-icon ${SCENE_ICON_FILL[s.trainingType] ?? "bg-gray"}`}
                    >
                      <TypeIcon type={s.trainingType} />
                    </span>
                  )}
                  <span className="row-main">
                    <span className="row-title">{s.title}</span>
                    <span className="row-sub">
                      {TRAINING_TYPE_LABEL[s.trainingType]}
                      {s.focus && s.focus !== s.title ? ` · ${s.focus}` : ""}
                    </span>
                  </span>
                  <span className="row-trailing">
                    {outcome && (
                      <span className={`hig-pill ${outcome.tone}`}>
                        {outcome.label}
                      </span>
                    )}
                    <span className="row-date">{fmtDate(s.trainedAt)}</span>
                    {!editing && (
                      <span className="chevron">
                        <ChevronRightIcon />
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <CreateFab />
    </HigScaffold>
  );
}
