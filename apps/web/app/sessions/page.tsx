"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SessionListItemDTO,
  SessionOutcomeResult,
  TrainingType
} from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { Dialog, SwipeAction } from "antd-mobile";
import { HigScaffold } from "../components/hig/scaffold";
import { HigLoading } from "../components/hig/loading";
import { CreateFab } from "../components/hig/create-fab";
import { HigDateField } from "../components/hig/hig-pickers";
import {
  BoltIcon,
  DumbbellIcon,
  ChevronRightIcon,
  NoteIcon,
  SCENE_ICON_FILL
} from "../components/hig/icons";
import { clearAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useAdmDarkSync } from "../components/hig/use-hig-theme";
import { TRAINING_TYPE_LABEL } from "../lib/labels";

type Filter = "all" | TrainingType;

function fmtDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const TYPE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "private_lesson", label: "私教" },
  { value: "self_training", label: "自训" },
  { value: "sparring", label: "实战" }
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
  useAdmDarkSync();
  const [sessions, setSessions] = useState<SessionListItemDTO[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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

  const hasActiveFilter = filter !== "all" || Boolean(from || to);

  function clearFilters() {
    setFilter("all");
    setFrom("");
    setTo("");
  }

  const filtered = useMemo(() => {
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : undefined;
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : undefined;
    return sessions.filter((s) => {
      if (filter !== "all" && s.trainingType !== filter) return false;
      const t = new Date(s.trainedAt).getTime();
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
      return true;
    });
  }, [sessions, filter, from, to]);

  async function confirmDelete(s: SessionListItemDTO) {
    const ok = await Dialog.confirm({
      title: "删除训练",
      content: `确认删除「${s.title}」？此操作不可撤销。`,
      confirmText: "删除",
      cancelText: "取消"
    });
    if (!ok) return;
    try {
      await api.deleteSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
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

  return (
    <HigScaffold title="训练" leading={leading} bodyScroll>
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
          <div className="dates">
            <HigDateField
              value={from ? new Date(`${from}T00:00:00`) : null}
              max={to ? new Date(`${to}T00:00:00`) : new Date()}
              placeholder="起始日期"
              onChange={(d) => setFrom(fmtDateInput(d))}
            />
          </div>
          {hasActiveFilter && (
            <button type="button" className="hig-clear" onClick={clearFilters}>
              清除筛选
            </button>
          )}
        </div>
      )}

      <div className="hig-scroll">
      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, padding: "10px 32px 0" }}>
          {error}
        </p>
      )}

      {loading ? (
        <HigLoading />
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
                <SwipeAction
                  key={s.id}
                  rightActions={[
                    {
                      key: "del",
                      text: "删除",
                      color: "danger",
                      onClick: () => void confirmDelete(s)
                    }
                  ]}
                >
                  <div
                    className="hig-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/sessions/${s.id}`)}
                  >
                    <span
                      className={`leading-icon ${SCENE_ICON_FILL[s.trainingType] ?? "bg-gray"}`}
                    >
                      <TypeIcon type={s.trainingType} />
                    </span>
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
                      <span className="chevron">
                        <ChevronRightIcon />
                      </span>
                    </span>
                  </div>
                </SwipeAction>
              );
            })}
          </div>
        </>
      )}
      </div>

      <CreateFab />
    </HigScaffold>
  );
}
