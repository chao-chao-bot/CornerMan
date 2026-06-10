"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Popconfirm, Select, Spin } from "antd";
import type {
  AnalysisReportItem,
  ReportDTO,
  ScoreDimension,
  SessionReportDTO
} from "@cornerman/shared-types";
import { Input, Textarea } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import {
  SCORE_DIMENSION_LABEL,
  SCORE_DIMENSION_ORDER
} from "../../lib/labels";
import { ScoreBoard } from "./score-board";
import type { EvidenceRef, LocateRequest } from "./types";

type SegmentInfo = { videoId: string; startMs: number; endMs: number };

function fmtSeg(seg?: SegmentInfo): string | null {
  if (!seg) return null;
  return `${(seg.startMs / 1000).toFixed(1)}–${(seg.endMs / 1000).toFixed(1)}s`;
}

function fmtReviewedAt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function PanelTitle({
  children,
  count
}: {
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <div className="mb-2.5 mt-[22px] flex items-center justify-between text-[12px] font-bold uppercase tracking-wide text-ink-2 first:mt-0">
      <span>{children}</span>
      {count && <span className="text-[11px] font-medium text-ink-3">{count}</span>}
    </div>
  );
}

function SourceChip({ mine }: { mine?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] ${
        mine
          ? "border-revise-line bg-revise-soft text-revise"
          : "border-line bg-surface text-ink-3"
      }`}
    >
      {mine ? "我的修订" : "AI 起草"}
    </span>
  );
}

export function ReportPanel({
  sessionId,
  videosReady,
  reviewedAt,
  reloadNonce,
  onSeek,
  onEvidence,
  onCompleted,
  locate
}: {
  sessionId: string;
  videosReady: boolean;
  /** session.reviewedAt：有值表示已完成复盘 */
  reviewedAt?: string;
  /** 外部 bump 时强制重载报告（重新分析后清掉旧报告） */
  reloadNonce?: number;
  onSeek?: (videoId: string, ms: number) => void;
  onEvidence?: (refs: EvidenceRef[]) => void;
  /** 完成复盘后通知父级刷新 session（更新 reviewedAt） */
  onCompleted?: () => void;
  /** 视频侧时间线点击证据片段 → 定位到对应条目/评分 */
  locate?: LocateRequest | null;
}) {
  const { message } = App.useApp();
  const [report, setReport] = useState<SessionReportDTO | null>(null);
  const [segMap, setSegMap] = useState<Record<string, SegmentInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 已采纳的条目 key（revision action=accept），用于「已采纳」禁用态
  const acceptedKeys = new Set(
    (report?.revisions ?? [])
      .filter((r) => r.action === "accept")
      .map((r) => r.itemKey)
  );

  const load = useCallback(async () => {
    try {
      const r = await api.getSessionReport(sessionId);
      setReport(r);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载报告失败");
    } finally {
      setLoaded(true);
    }
  }, [sessionId]);

  const loadSegments = useCallback(async () => {
    try {
      const videos = await api.listSessionVideos(sessionId);
      const ready = videos.filter((v) => v.status === "ready");
      const map: Record<string, SegmentInfo> = {};
      for (const v of ready) {
        const detail = await api.getVideo(v.id);
        for (const s of detail.segments ?? []) {
          map[s.id] = { videoId: v.id, startMs: s.startMs, endMs: s.endMs };
        }
      }
      setSegMap(map);
    } catch {
      // 证据时间为增强信息，失败可忽略
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    void loadSegments();
  }, [load, loadSegments]);

  // 重新分析后清空旧报告并重载，避免展示作废的草稿/定稿
  useEffect(() => {
    if (!reloadNonce) return;
    setReport(null);
    setSegMap({});
    void load();
    void loadSegments();
  }, [reloadNonce, load, loadSegments]);

  // 视频就绪或报告草稿出现时重拉片段映射，避免证据片段 chip 需手动刷新才出现
  useEffect(() => {
    if (videosReady || report?.draft || report?.final) {
      void loadSegments();
    }
  }, [videosReady, report?.draft?.id, report?.final?.id, loadSegments]);

  useEffect(() => {
    const hasDraft = Boolean(report?.draft);
    const needPoll = videosReady && !hasDraft;
    if (needPoll && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!needPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [report?.draft, videosReady, load]);

  const active: ReportDTO | null = report
    ? report.final ?? report.draft
    : null;
  const isFinal = Boolean(report?.final);

  const draftItemMap = new Map<string, AnalysisReportItem>(
    (report?.draft?.items ?? []).map((it) => [it.key, it])
  );

  // 汇总复盘条目引用的证据片段（带反向定位键），上抛给主区时间线。
  // 评分证据（Score.evidenceSegmentIds）噪音大，不进证据轨。
  useEffect(() => {
    if (!onEvidence) return;
    const refs: EvidenceRef[] = [];
    const seen = new Set<string>();
    const activeReport = report?.final ?? report?.draft;
    for (const it of activeReport?.items ?? []) {
      if (!it.segmentId) continue;
      const dedup = `${it.segmentId}|${it.key}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      refs.push({
        segmentId: it.segmentId,
        kind: "item",
        refKey: it.key,
        label: `${SCORE_DIMENSION_LABEL[it.dimension]}·${it.title}`
      });
    }
    onEvidence(refs);
  }, [report, onEvidence]);

  // 时间线点击证据片段 → 滚动定位并闪烁高亮对应条目/评分区
  useEffect(() => {
    if (!locate) return;
    const elId = locate.refKey.startsWith("score-")
      ? "report-scores"
      : `report-item-${locate.refKey}`;
    document
      .getElementById(elId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashKey(locate.refKey);
    const timer = setTimeout(() => setFlashKey(null), 2200);
    return () => clearTimeout(timer);
  }, [locate]);

  async function runRevision(
    fn: () => Promise<SessionReportDTO>,
    key: string,
    successText?: string
  ): Promise<void> {
    setBusy(true);
    setBusyKey(key);
    try {
      setReport(await fn());
      setError(null);
      if (successText) message.success(successText);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "操作失败";
      setError(msg);
      message.error(msg);
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  }

  async function handleComplete(): Promise<void> {
    setCompleting(true);
    try {
      await api.completeReport(sessionId);
      await load();
      onCompleted?.();
      setError(null);
      message.success("复盘已归档，状态更新为「已复盘」");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "完成复盘失败";
      setError(msg);
      message.error(msg);
    } finally {
      setCompleting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  if (!active) {
    return (
      <div>
        <PanelTitle>AI 复盘</PanelTitle>
        <div className="flex items-center gap-2.5 rounded border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink-3">
          {videosReady && <Spin size="small" />}
          {videosReady
            ? "AI 正在生成复盘草稿，请稍候（自动刷新）…"
            : "上传并处理完视频后，AI 将自动生成复盘草稿。"}
        </div>
        {error && (
          <div className="mt-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk">
          {error}
        </div>
      )}

      {/* 复盘状态 + 完成复盘 */}
      <div
        className={`mb-3 flex items-center justify-between gap-3 rounded border px-3 py-2.5 ${
          reviewedAt
            ? "border-improved-line bg-improved-soft"
            : "border-line bg-surface-2"
        }`}
      >
        {reviewedAt ? (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-improved">
            <span className="h-[7px] w-[7px] rounded-full bg-improved" />
            已复盘 · {fmtReviewedAt(reviewedAt)}
          </span>
        ) : (
          <>
            <span className="text-[12.5px] text-ink-2">
              逐条采纳或修改后，点「完成复盘」归档本次训练
            </span>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {completing && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {completing ? "归档中…" : "完成复盘"}
            </button>
          </>
        )}
      </div>

      {/* 训练摘要 */}
      <PanelTitle>训练摘要</PanelTitle>
      <div className="mb-3 overflow-hidden rounded border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">
            摘要
          </span>
          <SourceChip mine={isFinal} />
        </div>
        <div className="px-3 py-3 text-[13.5px] leading-relaxed">
          {active.summary}
        </div>
        {active.modelVersion && (
          <div className="px-3 pb-2.5 text-[11px] text-ink-3">
            生成模型：{active.modelVersion}
            {!isFinal && " · 采纳/修改会保存为我的修订，AI 原文始终保留"}
          </div>
        )}
      </div>

      {/* 复盘条目 */}
      <PanelTitle count={`${active.items.length} 条`}>复盘条目</PanelTitle>
      <div>
        {active.items.map((item) => (
          <ReportItemCard
            key={item.key}
            item={item}
            seg={item.segmentId ? segMap[item.segmentId] : undefined}
            aiOriginal={draftItemMap.get(item.key)}
            busy={busy}
            itemBusy={busyKey === item.key}
            accepted={acceptedKeys.has(item.key)}
            flash={flashKey === item.key}
            onSeek={onSeek}
            onAccept={() =>
              runRevision(
                () =>
                  api.createRevision(active.id, {
                    itemKey: item.key,
                    action: "accept"
                  }),
                item.key,
                "已采纳"
              )
            }
            onEdit={(title, detail) =>
              runRevision(
                () =>
                  api.createRevision(active.id, {
                    itemKey: item.key,
                    action: "edit",
                    title,
                    detail
                  }),
                item.key,
                "修改已保存"
              )
            }
            onDelete={() =>
              runRevision(
                () =>
                  api.createRevision(active.id, {
                    itemKey: item.key,
                    action: "delete"
                  }),
                item.key,
                "已删除该条目"
              )
            }
          />
        ))}
        {active.items.length === 0 && (
          <p className="text-[13px] text-ink-3">暂无条目。</p>
        )}
      </div>

      <AddItemForm
        busy={busy}
        onAdd={(dimension, title, detail) =>
          runRevision(
            () =>
              api.createRevision(active.id, {
                itemKey: "new",
                action: "add",
                dimension,
                title,
                detail
              }),
            "new",
            "已添加条目"
          )
        }
      />

      {/* 技术评分 */}
      <PanelTitle>技术评分</PanelTitle>
      <div
        id="report-scores"
        className={
          flashKey?.startsWith("score-")
            ? "rounded ring-2 ring-brand/50 transition-shadow"
            : "transition-shadow"
        }
      >
      <ScoreBoard
        sessionId={sessionId}
        scores={report?.scores ?? []}
        onUpdated={(updated) =>
          setReport((prev) =>
            prev
              ? {
                  ...prev,
                  scores: prev.scores.map((s) =>
                    s.dimension === updated.dimension ? updated : s
                  )
                }
              : prev
          )
        }
      />
      </div>

      {/* 问题追踪（占位） */}
      <PanelTitle>问题追踪</PanelTitle>
      <div className="rounded border border-dashed border-line-strong bg-surface px-4 py-5 text-center text-[12.5px] text-ink-3">
        跨训练的问题串联与改进追踪将在 P4 开放。
      </div>
    </div>
  );
}

function ReportItemCard({
  item,
  seg,
  aiOriginal,
  busy,
  itemBusy,
  accepted,
  flash,
  onAccept,
  onEdit,
  onDelete,
  onSeek
}: {
  item: AnalysisReportItem;
  seg?: SegmentInfo;
  aiOriginal?: AnalysisReportItem;
  busy: boolean;
  /** 本条目正在提交修订 */
  itemBusy?: boolean;
  /** 本条目已被采纳（revision action=accept） */
  accepted?: boolean;
  /** 时间线证据定位时短暂高亮 */
  flash?: boolean;
  onAccept: () => void;
  onEdit: (title: string, detail: string) => void;
  onDelete: () => void;
  onSeek?: (videoId: string, ms: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [detail, setDetail] = useState(item.detail);

  const isMine = item.key.startsWith("user-");
  const changed =
    aiOriginal &&
    (aiOriginal.title !== item.title || aiOriginal.detail !== item.detail);
  const segLabel = fmtSeg(seg);

  return (
    <div
      id={`report-item-${item.key}`}
      className={`mb-2.5 overflow-hidden rounded border bg-surface transition-shadow ${
        flash ? "border-brand ring-2 ring-brand/50" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">
          {SCORE_DIMENSION_LABEL[item.dimension]}
        </span>
        <SourceChip mine={isMine || changed} />
      </div>

      <div className="px-3 pt-3">
        {editing ? (
          <div className="grid gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="text-[14px] font-medium">{item.title}</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              {item.detail}
            </p>
            {changed && aiOriginal && (
              <span className="mt-1 block text-[12.5px] text-ink-3 line-through">
                AI 原文：{aiOriginal.title}
                {aiOriginal.detail ? `——${aiOriginal.detail}` : ""}
              </span>
            )}
          </>
        )}
      </div>

      {segLabel && !editing && (
        <div className="px-3 pt-2.5">
          {seg && onSeek ? (
            <button
              type="button"
              onClick={() => onSeek(seg.videoId, seg.startMs)}
              className="inline-flex items-center gap-1.5 rounded-[5px] border border-brand-line bg-brand-soft px-2.5 py-1 text-[11.5px] text-brand transition-colors hover:bg-brand hover:text-white"
              title="跳转到视频对应时刻"
            >
              <i className="border-y-[4px] border-l-[6px] border-y-transparent border-l-current" />
              证据片段 · {segLabel}
              {typeof item.aiConfidence === "number" &&
                ` · 置信度 ${(item.aiConfidence * 100).toFixed(0)}%`}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-brand-line bg-brand-soft px-2.5 py-1 text-[11.5px] text-brand">
              <i className="h-[7px] w-[7px] rounded-[2px] bg-brand" />
              证据片段 · {segLabel}
              {typeof item.aiConfidence === "number" &&
                ` · 置信度 ${(item.aiConfidence * 100).toFixed(0)}%`}
            </span>
          )}
        </div>
      )}

      <div className="m-3 flex gap-1.5">
        {editing ? (
          <>
            <button
              className="rounded-md border border-brand bg-brand px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                onEdit(title, detail);
                setEditing(false);
              }}
            >
              保存
            </button>
            <button
              className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] text-ink-2"
              onClick={() => {
                setTitle(item.title);
                setDetail(item.detail);
                setEditing(false);
              }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            {accepted ? (
              <span className="inline-flex cursor-default items-center gap-1.5 rounded-md border border-improved-line bg-improved-soft px-2.5 py-1.5 text-[12px] font-medium text-improved">
                ✓ 已采纳
              </span>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-line bg-surface px-2.5 py-1.5 text-[12px] text-brand hover:bg-brand hover:text-white disabled:opacity-50"
                disabled={busy}
                onClick={onAccept}
              >
                {itemBusy && <Spin size="small" />}
                采纳
              </button>
            )}
            <button
              className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-50"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              修改
            </button>
            <Popconfirm
              title="确认删除该条目？"
              description="AI 原文会保留在修订记录中。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: itemBusy }}
              onConfirm={onDelete}
            >
              <button
                className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] text-ink-2 hover:border-risk hover:text-risk disabled:opacity-50"
                disabled={busy}
              >
                删除
              </button>
            </Popconfirm>
          </>
        )}
      </div>
    </div>
  );
}

function AddItemForm({
  busy,
  onAdd
}: {
  busy: boolean;
  onAdd: (dimension: ScoreDimension, title: string, detail: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dimension, setDimension] = useState<ScoreDimension>("overall");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  if (!open) {
    return (
      <button
        className="mt-1 w-full rounded-sm border border-dashed border-line-strong bg-transparent py-2.5 text-[12.5px] text-ink-2 hover:border-revise hover:text-revise"
        onClick={() => setOpen(true)}
      >
        + 新增我的条目
      </button>
    );
  }

  return (
    <div className="mt-1 grid gap-2 rounded-sm border border-dashed border-line-strong bg-surface-2 p-3">
      <Select<ScoreDimension>
        value={dimension}
        onChange={(v) => setDimension(v)}
        options={SCORE_DIMENSION_ORDER.map((d) => ({
          value: d,
          label: SCORE_DIMENSION_LABEL[d]
        }))}
      />
      <Input
        placeholder="要点标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        rows={3}
        placeholder="具体描述与改进建议"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="rounded-md border border-brand bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
          disabled={busy || (!title && !detail)}
          onClick={() => {
            onAdd(dimension, title, detail);
            setTitle("");
            setDetail("");
            setOpen(false);
          }}
        >
          添加
        </button>
        <button
          className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] text-ink-2"
          onClick={() => setOpen(false)}
        >
          取消
        </button>
      </div>
    </div>
  );
}
