"use client";

import type { TrainingSessionDTO, VideoDTO } from "@cornerman/shared-types";
import { Module, Tag } from "@cornerman/ui";
import { TRAINING_TYPE_LABEL } from "../../lib/labels";

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatBox({
  value,
  label,
  accent
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-sm border border-line bg-surface-2 px-[13px] py-[11px]">
      <div className={`text-[20px] font-bold ${accent ? "text-brand" : ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

export function SessionHeader({
  session,
  videos
}: {
  session: TrainingSessionDTO;
  videos: VideoDTO[];
}) {
  const ready = videos.filter((v) => v.status === "ready");
  const totalMs = ready.reduce((sum, v) => sum + (v.durationMs ?? 0), 0);
  const segmentCount = videos.reduce((sum, v) => sum + (v.segmentCount ?? 0), 0);
  const punchCount = ready.reduce(
    (sum, v) => sum + (v.poseMetrics?.punchCount ?? 0),
    0
  );
  const hasPunch = ready.some((v) => typeof v.poseMetrics?.punchCount === "number");

  // 只展示有真实数据的指标，避免长期空占位
  const stats: { value: string; label: string; accent?: boolean }[] = [
    { value: fmtDuration(totalMs), label: "训练时长", accent: true },
    { value: String(segmentCount), label: "关键片段" }
  ];
  if (hasPunch) {
    stats.push({ value: String(punchCount), label: "出拳次数" });
  }
  if (session.durationMin != null) {
    stats.push({ value: `${session.durationMin} 分钟`, label: "记录时长" });
  }

  return (
    <Module className="!mb-4" bodyClassName="px-5 py-[18px]">
      <div className="mb-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-3">
        <Tag variant="type">{TRAINING_TYPE_LABEL[session.trainingType]}</Tag>
        <span>
          {new Date(session.trainedAt).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: "short"
          })}
        </span>
        {session.location && <span>· {session.location}</span>}
      </div>
      <h1 className="text-[22px] font-bold tracking-tight">{session.title}</h1>
      {session.focus && (
        <div className="mt-1 text-[13.5px] text-ink-2">
          本次重点：{session.focus}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((s) => (
          <StatBox
            key={s.label}
            value={s.value}
            label={s.label}
            accent={s.accent}
          />
        ))}
      </div>
    </Module>
  );
}
