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
      </div>
      <h1 className="text-[22px] font-bold tracking-tight">{session.title}</h1>
      {session.userNote && (
        <div className="mt-1 text-[13.5px] text-ink-2">{session.userNote}</div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatBox value={fmtDuration(totalMs)} label="训练时长" accent />
        <StatBox value="—" label="回合数" />
        <StatBox value="—" label="出拳数" />
        <StatBox value={String(segmentCount)} label="关键片段" />
      </div>
    </Module>
  );
}
