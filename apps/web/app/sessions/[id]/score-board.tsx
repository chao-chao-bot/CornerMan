"use client";

import { useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import type { ScoreDTO, ScoreDimension } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import {
  SCORE_DIMENSION_LABEL,
  SCORE_DIMENSION_ORDER
} from "../../lib/labels";

function confLabel(c?: number): { text: string; low: boolean } {
  if (typeof c !== "number") return { text: "置信度 —", low: false };
  if (c >= 0.7) return { text: "置信度 高", low: false };
  if (c >= 0.4) return { text: "置信度 中", low: false };
  return { text: "置信度 低", low: true };
}

// ---------- 雷达图 ----------
function Radar({ scores }: { scores: Map<ScoreDimension, ScoreDTO> }) {
  const cx = 100;
  const cy = 84;
  const R = 62;
  const dims = SCORE_DIMENSION_ORDER;
  const N = dims.length;

  const pt = (i: number, value: number, radius = R) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const r = radius * (value / 10);
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const ringPts = (frac: number) =>
    dims.map((_, i) => pt(i, 10 * frac).join(",")).join(" ");
  const polyPts = (pick: (s?: ScoreDTO) => number) =>
    dims.map((d, i) => pt(i, pick(scores.get(d))).join(",")).join(" ");

  const aiPoly = polyPts((s) => s?.aiScore ?? 0);
  const userPoly = polyPts((s) => s?.userScore ?? s?.aiScore ?? 0);

  return (
    <div className="flex justify-center pb-2 pt-0.5">
      <svg width="200" height="168" viewBox="0 0 200 168">
        <g fill="none" stroke="#cdd4dd" strokeWidth="1">
          {[1, 0.75, 0.5, 0.25].map((f) => (
            <polygon key={f} points={ringPts(f)} />
          ))}
        </g>
        <g stroke="#e2e6eb" strokeWidth="1">
          {dims.map((_, i) => {
            const [x, y] = pt(i, 10);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} />;
          })}
        </g>
        <polygon
          points={aiPoly}
          fill="rgba(138,147,160,0.12)"
          stroke="#8a93a0"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <polygon
          points={userPoly}
          fill="rgba(30,90,168,0.14)"
          stroke="#1e5aa8"
          strokeWidth="2"
        />
        <g fill="#5b6470" fontSize="8.5" fontFamily="Inter, sans-serif">
          {dims.map((d, i) => {
            const [x, y] = pt(i, 10, R + 14);
            const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / N);
            const anchor =
              cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
            return (
              <text key={d} x={x} y={y + 3} textAnchor={anchor}>
                {SCORE_DIMENSION_LABEL[d]}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ---------- 可拖动双层条 ----------
function DraggableBar({
  ai,
  value,
  onDrag,
  onCommit
}: {
  ai?: number;
  value: number;
  onDrag: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function valueAt(clientX: number): number {
    const el = ref.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(10, Math.round(ratio * 10 * 2) / 2));
  }

  return (
    <div
      ref={ref}
      className="relative h-[8px] cursor-pointer touch-none rounded-full border border-line bg-surface-2"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onDrag(valueAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragging.current) onDrag(valueAt(e.clientX));
      }}
      onPointerUp={(e) => {
        if (dragging.current) {
          dragging.current = false;
          onCommit(valueAt(e.clientX));
        }
      }}
    >
      {/* 我的分：蓝色填充 */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand"
        style={{ width: `${(value / 10) * 100}%` }}
      />
      {/* AI 基准分：竖向刻度标记 */}
      {typeof ai === "number" && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-[2px] -translate-x-1/2 rounded-full bg-ink-3"
          style={{ left: `${(ai / 10) * 100}%` }}
          title={`AI 评分 ${ai.toFixed(1)}`}
        />
      )}
    </div>
  );
}

export function ScoreBoard({
  sessionId,
  scores,
  onUpdated
}: {
  sessionId: string;
  scores: ScoreDTO[];
  onUpdated: (s: ScoreDTO) => void;
}) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savingDim, setSavingDim] = useState<ScoreDimension | null>(null);
  const [savedDim, setSavedDim] = useState<ScoreDimension | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const byDim = new Map<ScoreDimension, ScoreDTO>(
    scores.map((s) => [s.dimension, s])
  );

  async function commit(dimension: ScoreDimension, value: number) {
    setSavingDim(dimension);
    try {
      const updated = await api.updateScore(sessionId, dimension, value);
      onUpdated(updated);
      setErr(null);
      setSavedDim(dimension);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedDim(null), 1500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "改分失败");
    } finally {
      setSavingDim(null);
    }
  }

  const currentOf = (d: ScoreDimension) => {
    const s = byDim.get(d);
    return draft[d] ?? s?.userScore ?? s?.aiScore ?? 5;
  };
  const userVals = SCORE_DIMENSION_ORDER.map(currentOf);
  const total =
    Math.round((userVals.reduce((a, b) => a + b, 0) / userVals.length) * 10) /
    10;
  const aiVals = SCORE_DIMENSION_ORDER.map(
    (d) => byDim.get(d)?.aiScore
  ).filter((v): v is number => typeof v === "number");
  const aiTotal = aiVals.length
    ? Math.round((aiVals.reduce((a, b) => a + b, 0) / aiVals.length) * 10) / 10
    : null;

  return (
    <div className="rounded border border-line bg-surface p-3">
      <Radar scores={byDim} />

      <div className="mb-2.5 flex items-center justify-center gap-3 text-[10.5px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[8px] w-2.5 rounded-full bg-brand" />
          我的分
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[10px] w-[2px] rounded-full bg-ink-3" />
          AI 分
        </span>
        <span className="text-ink-3">· 拖动评分条，松手即自动保存</span>
      </div>

      {err && (
        <div className="mb-2 rounded-sm border border-risk-line bg-risk-soft px-2.5 py-1.5 text-[11.5px] text-risk">
          {err}
        </div>
      )}

      <div className="grid gap-2">
        {SCORE_DIMENSION_ORDER.map((d) => {
          const s = byDim.get(d);
          const cur = currentOf(d);
          const conf = confLabel(s?.confidence);
          return (
            <div key={d}>
              <div className="mb-1 flex items-baseline justify-between">
                <div className="flex items-center gap-1.5 text-[12px]">
                  {SCORE_DIMENSION_LABEL[d]}
                  <span className={`text-[10px] ${conf.low ? "text-revise" : "text-ink-3"}`}>
                    {conf.text}
                  </span>
                  {savingDim === d && <Spin size="small" />}
                  {savedDim === d && savingDim !== d && (
                    <span className="text-[10px] text-improved">✓ 已保存</span>
                  )}
                </div>
                <div className="text-[13px] font-bold tabular-nums">
                  {cur.toFixed(1)}
                  {typeof s?.aiScore === "number" && (
                    <span className="ml-1.5 text-[10.5px] font-normal text-ink-3">
                      AI {s.aiScore.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <DraggableBar
                ai={s?.aiScore ?? undefined}
                value={cur}
                onDrag={(v) => setDraft((p) => ({ ...p, [d]: v }))}
                onCommit={(v) => commit(d, v)}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-bold leading-none text-brand tabular-nums">
            {total.toFixed(1)}
          </span>
          <span className="text-[11px] text-ink-3">综合（我的）</span>
        </div>
        <div className="text-right text-[10.5px] text-ink-3">
          {aiTotal !== null ? `AI 原始综合 ${aiTotal.toFixed(1)}` : ""}
        </div>
      </div>
    </div>
  );
}
