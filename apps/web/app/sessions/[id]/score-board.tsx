"use client";

import { useRef, useState } from "react";
import type { ScoreDTO, ScoreDimension } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import {
  SCORE_DIMENSION_LABEL,
  SCORE_DIMENSION_ORDER
} from "../../lib/labels";

const AI_FILL_BG =
  "repeating-linear-gradient(90deg, #cdd4dd 0 4px, transparent 4px 7px)";

function confLabel(c?: number): { text: string; low: boolean } {
  if (typeof c !== "number") return { text: "置信度 —", low: false };
  if (c >= 0.7) return { text: "置信度 高", low: false };
  if (c >= 0.4) return { text: "置信度 中", low: false };
  return { text: "置信度 低", low: true };
}

// ---------- 雷达图 ----------
function Radar({ scores }: { scores: Map<ScoreDimension, ScoreDTO> }) {
  const cx = 130;
  const cy = 110;
  const R = 82;
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
    <div className="flex justify-center pb-3 pt-1">
      <svg width="260" height="220" viewBox="0 0 260 220">
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
        <g fill="#5b6470" fontSize="9.5" fontFamily="Inter, sans-serif">
          {dims.map((d, i) => {
            const [x, y] = pt(i, 10, R + 16);
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
      className="relative h-[7px] cursor-pointer touch-none rounded-full border border-line bg-surface-2"
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
      {typeof ai === "number" && (
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${(ai / 10) * 100}%`, background: AI_FILL_BG }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand"
        style={{ width: `${(value / 10) * 100}%` }}
      />
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

  const byDim = new Map<ScoreDimension, ScoreDTO>(
    scores.map((s) => [s.dimension, s])
  );

  async function commit(dimension: ScoreDimension, value: number) {
    try {
      const updated = await api.updateScore(sessionId, dimension, value);
      onUpdated(updated);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "改分失败");
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
    <div className="rounded border border-line bg-surface p-4">
      <Radar scores={byDim} />

      <div className="mb-3.5 flex justify-center gap-4 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3.5 border-t-2 border-dashed border-ink-3" />
          AI 原始分
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3.5 border-t-2 border-brand" />
          我的修订分
        </span>
      </div>

      {err && (
        <div className="mb-2 rounded-sm border border-risk-line bg-risk-soft px-2.5 py-1.5 text-[11.5px] text-risk">
          {err}
        </div>
      )}

      <div className="grid gap-3">
        {SCORE_DIMENSION_ORDER.map((d) => {
          const s = byDim.get(d);
          const cur = currentOf(d);
          const conf = confLabel(s?.confidence);
          return (
            <div key={d}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <div className="text-[12.5px]">{SCORE_DIMENSION_LABEL[d]}</div>
                <div className="text-[14px] font-bold">
                  {cur.toFixed(1)}
                  {typeof s?.aiScore === "number" && (
                    <span className="ml-1.5 text-[11px] font-normal text-ink-3">
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
              <div
                className={`mt-1 text-[10px] ${conf.low ? "text-revise" : "text-ink-3"}`}
              >
                {conf.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5">
        <div className="text-[30px] font-bold leading-none text-brand">
          {total.toFixed(1)}
        </div>
        <div className="text-right text-[11px] leading-relaxed text-ink-3">
          综合评分（我的修订）
          <br />
          {aiTotal !== null ? `AI 原始 ${aiTotal.toFixed(1)} · ` : ""}拖动条形微调
        </div>
      </div>
    </div>
  );
}
