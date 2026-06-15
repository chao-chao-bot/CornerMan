"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SessionContent,
  SessionContentBlock,
  SessionOutcome,
  SessionOutcomeResult,
  TrainingSessionDTO
} from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { Block } from "../../components/hig/blocks";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import { SessionMedia } from "./session-media";

type SaveState = "saved" | "saving" | "error";

const OUTCOME_OPTIONS: { value: SessionOutcomeResult; label: string }[] = [
  { value: "win", label: "胜" },
  { value: "draw", label: "平" },
  { value: "loss", label: "负" },
  { value: "unscored", label: "未记" }
];

function dateInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function SavePill({ state }: { state: SaveState }) {
  const label =
    state === "saving" ? "保存中…" : state === "error" ? "保存失败" : "已保存";
  return (
    <span className={`hig-save ${state}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

export function SessionEditor({
  session: initial
}: {
  session: TrainingSessionDTO;
}) {
  const router = useRouter();
  const dark = useHigTheme();
  const blocks = initial.templateSnapshot?.blocks ?? [];

  const [content, setContent] = useState<SessionContent>(initial.content ?? {});
  const [save, setSave] = useState<SaveState>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<SessionContent>(content);

  const flush = useCallback(async (next: SessionContent) => {
    try {
      await api.updateSessionContent(initial.id, { content: next });
      setSave("saved");
    } catch {
      setSave("error");
    }
  }, [initial.id]);

  const scheduleSave = useCallback(
    (next: SessionContent) => {
      latest.current = next;
      setSave("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(next), 800);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onBlockChange(blockId: string, val: SessionContentBlock) {
    setContent((prev) => {
      const next = { ...prev, [blockId]: val };
      scheduleSave(next);
      return next;
    });
  }

  async function goBack() {
    if (timer.current) {
      clearTimeout(timer.current);
      await flush(latest.current);
    }
    router.push("/sessions");
  }

  /* ---- meta：日期 / 成败 ---- */
  const [trainedAt, setTrainedAt] = useState(initial.trainedAt);
  const [outcome, setOutcome] = useState<SessionOutcome>(
    initial.outcome ?? { result: "unscored" }
  );
  const [metaErr, setMetaErr] = useState<string | null>(null);

  async function saveMeta(patch: Parameters<typeof api.updateSessionMeta>[1]) {
    setMetaErr(null);
    try {
      await api.updateSessionMeta(initial.id, patch);
    } catch (err) {
      setMetaErr(err instanceof ApiError ? err.message : "保存失败");
    }
  }

  function onDateChange(value: string) {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const iso = d.toISOString();
    setTrainedAt(iso);
    void saveMeta({ trainedAt: iso });
  }

  function onOutcomeChange(next: SessionOutcome) {
    setOutcome(next);
    void saveMeta({ outcome: next });
  }

  const isSparring = initial.trainingType === "sparring";

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        <div className="hig-nav">
          <span className="nav-leading">
            <button type="button" className="hig-navbtn" onClick={goBack}>
              ← 训练
            </button>
          </span>
          <span className="nav-title">复盘</span>
          <span className="nav-trailing">
            <SavePill state={save} />
          </span>
        </div>

        <div className="hig-large-title">
          {initial.title}
          <span className="sub">
            {initial.templateSnapshot ? "模板复盘" : "训练复盘"} ·{" "}
            {dateInputValue(trainedAt)}
          </span>
        </div>

        {/* 训练日期 */}
        <div className="hig-section-header">训练日期</div>
        <div className="hig-form">
          <label className="hig-field">
            <span className="fl">日期</span>
            <input
              type="date"
              value={dateInputValue(trainedAt)}
              max={dateInputValue(new Date().toISOString())}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>
        </div>

        {/* 实战成败（仅实战） */}
        {isSparring && (
          <>
            <div className="hig-section-header">实战成败</div>
            <div style={{ padding: "0 16px" }}>
              <div
                className="hig-seg"
                style={{ display: "flex", width: "100%" }}
              >
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    style={{ flex: 1 }}
                    className={outcome.result === o.value ? "on" : ""}
                    onClick={() =>
                      onOutcomeChange({ ...outcome, result: o.value })
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="hig-form" style={{ marginTop: 10 }}>
              <label className="hig-field">
                <span className="fl">对手</span>
                <input
                  value={outcome.opponent ?? ""}
                  placeholder="对手 / 风格"
                  onChange={(e) =>
                    setOutcome((p) => ({ ...p, opponent: e.target.value }))
                  }
                  onBlur={() => onOutcomeChange(outcome)}
                />
              </label>
              <label className="hig-field">
                <span className="fl">回合数</span>
                <input
                  inputMode="numeric"
                  value={outcome.rounds ?? ""}
                  placeholder="例如 3"
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, ""));
                    setOutcome((p) => ({
                      ...p,
                      rounds: Number.isFinite(n) && n > 0 ? n : undefined
                    }));
                  }}
                  onBlur={() => onOutcomeChange(outcome)}
                />
              </label>
            </div>
          </>
        )}

        {/* 视频素材 */}
        <div className="hig-section-header">视频素材</div>
        <SessionMedia sessionId={initial.id} />

        {/* 模板区块 */}
        <div className="hig-section-header">复盘内容</div>
        {blocks.length === 0 ? (
          <div className="hig-empty">该训练未基于模板创建，暂无复盘区块。</div>
        ) : (
          blocks.map((block) => (
            <Block
              key={block.id}
              block={block}
              value={content[block.id]}
              onChange={(val) => onBlockChange(block.id, val)}
            />
          ))
        )}

        {metaErr && (
          <p
            style={{
              color: "var(--red)",
              fontSize: 13,
              padding: "0 32px 8px"
            }}
          >
            {metaErr}
          </p>
        )}

        <button
          type="button"
          className="hig-btn-plain"
          onClick={goBack}
          style={{ marginTop: 8 }}
        >
          完成并返回
        </button>
      </div>
    </div>
  );
}
