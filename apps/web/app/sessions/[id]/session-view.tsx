"use client";

import { useRouter } from "next/navigation";
import type {
  SessionContent,
  SessionOutcomeResult,
  TrainingSessionDTO,
  TrainingType
} from "@cornerman/shared-types";
import { Block } from "../../components/hig/blocks";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import {
  BoltIcon,
  DumbbellIcon,
  NoteIcon,
  SCENE_ICON_FILL
} from "../../components/hig/icons";
import { TRAINING_TYPE_LABEL } from "../../lib/labels";
import { SessionMedia } from "./session-media";

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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function SessionView({
  session,
  onEdit
}: {
  session: TrainingSessionDTO;
  onEdit: () => void;
}) {
  const router = useRouter();
  const dark = useHigTheme();
  const blocks = session.templateSnapshot?.blocks ?? [];
  const content: SessionContent = session.content ?? {};
  const isSparring = session.trainingType === "sparring";
  const outcome = session.outcome;
  const outcomeMeta = outcome ? OUTCOME_META[outcome.result] : null;

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        <div className="hig-nav">
          <span className="nav-leading">
            <button
              type="button"
              className="hig-navbtn"
              onClick={() => router.push("/sessions")}
            >
              ← 训练
            </button>
          </span>
          <span className="nav-title">复盘详情</span>
          <span className="nav-trailing">
            <button type="button" className="hig-navbtn strong" onClick={onEdit}>
              编辑
            </button>
          </span>
        </div>

        {/* 概览卡 */}
        <div className="hig-overview">
          <span
            className={`ov-icon ${SCENE_ICON_FILL[session.trainingType] ?? "bg-gray"}`}
          >
            <TypeIcon type={session.trainingType} />
          </span>
          <div className="ov-main">
            <div className="ov-title">{session.title}</div>
            <div className="ov-meta">
              <span className="ov-tag">
                {TRAINING_TYPE_LABEL[session.trainingType]}
              </span>
              <span className="ov-dot">·</span>
              <span>{fmtDate(session.trainedAt)}</span>
              {session.durationMin != null && (
                <>
                  <span className="ov-dot">·</span>
                  <span>{session.durationMin} 分钟</span>
                </>
              )}
            </div>
          </div>
          {outcomeMeta && (
            <span className={`hig-pill ${outcomeMeta.tone}`}>
              {outcomeMeta.label}
            </span>
          )}
        </div>

        {/* 实战成败明细 */}
        {isSparring && outcome && (outcome.opponent || outcome.rounds) && (
          <>
            <div className="hig-section-header">实战成败</div>
            <div className="hig-list">
              {outcome.opponent && (
                <div className="hig-row no-inset-sep">
                  <span className="row-main">
                    <span className="row-title">对手</span>
                  </span>
                  <span className="row-trailing">{outcome.opponent}</span>
                </div>
              )}
              {outcome.rounds != null && (
                <div className="hig-row no-inset-sep">
                  <span className="row-main">
                    <span className="row-title">回合数</span>
                  </span>
                  <span className="row-trailing">{outcome.rounds}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* 视频素材 */}
        <div className="hig-section-header">视频素材</div>
        <SessionMedia sessionId={session.id} readOnly />

        {/* 复盘内容 */}
        <div className="hig-section-header">复盘内容</div>
        {blocks.length === 0 ? (
          <div className="hig-empty">该训练未基于模板创建，暂无复盘区块。</div>
        ) : (
          blocks.map((block) => (
            <Block
              key={block.id}
              block={block}
              value={content[block.id]}
              onChange={() => {}}
              readOnly
            />
          ))
        )}
      </div>
    </div>
  );
}
