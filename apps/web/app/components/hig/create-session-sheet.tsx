"use client";

import { useEffect, useMemo, useState } from "react";
import type { TemplateDTO, TrainingType } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { BottomSheet } from "./bottom-sheet";
import {
  BoltIcon,
  ChevronRightIcon,
  DumbbellIcon,
  NoteIcon,
  SCENE_ICON_FILL
} from "./icons";

interface CreateSessionSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

const SCENE_TRAINING_TYPE: Record<string, TrainingType> = {
  private_lesson: "private_lesson",
  sparring: "sparring",
  self_training: "self_training",
  custom: "self_training"
};

function SceneIcon({ scene }: { scene: string }) {
  if (scene === "sparring") return <BoltIcon />;
  if (scene === "self_training") return <DumbbellIcon />;
  return <NoteIcon />;
}

function isoFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dateInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function CreateSessionSheet({
  open,
  onClose,
  onCreated
}: CreateSessionSheetProps) {
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  // 日期快选：0=今天 1=昨天 -1=自定义
  const [dateMode, setDateMode] = useState<0 | 1 | -1>(0);
  const [customDate, setCustomDate] = useState(dateInputValue(isoFromOffset(0)));

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .listTemplates()
      .then(setTemplates)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "模板加载失败")
      )
      .finally(() => setLoading(false));
  }, [open]);

  const trainedAt = useMemo(() => {
    if (dateMode === 0) return isoFromOffset(0);
    if (dateMode === 1) return isoFromOffset(1);
    const d = new Date(`${customDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? isoFromOffset(0) : d.toISOString();
  }, [dateMode, customDate]);

  const grouped = useMemo(() => {
    const system = templates.filter((t) => t.isSystem);
    const personal = templates.filter((t) => !t.isSystem);
    return { system, personal };
  }, [templates]);

  async function pick(tpl: TemplateDTO) {
    setCreatingId(tpl.id);
    setError(null);
    try {
      const dateLabel = dateInputValue(trainedAt).slice(5).replace("-", "/");
      const session = await api.createSession({
        title: `${tpl.name} · ${dateLabel}`,
        trainingType: SCENE_TRAINING_TYPE[tpl.scene] ?? "self_training",
        trainedAt,
        templateId: tpl.id
      });
      onCreated(session.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败");
      setCreatingId(null);
    }
  }

  function TemplateRow({ tpl }: { tpl: TemplateDTO }) {
    return (
      <button
        type="button"
        className="hig-row"
        disabled={creatingId != null}
        onClick={() => pick(tpl)}
      >
        <span className={`leading-icon ${SCENE_ICON_FILL[tpl.scene] ?? "bg-gray"}`}>
          <SceneIcon scene={tpl.scene} />
        </span>
        <span className="row-main">
          <span className="row-title">{tpl.name}</span>
          {(tpl.description || tpl.schema?.blocks?.length) && (
            <span className="row-sub">
              {tpl.description ?? `${tpl.schema.blocks.length} 个记录区块`}
            </span>
          )}
        </span>
        {creatingId === tpl.id ? (
          <span className="row-value">创建中…</span>
        ) : (
          <span className="chevron">
            <ChevronRightIcon />
          </span>
        )}
      </button>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="新建复盘">
      {/* 日期快选 */}
      <div className="hig-section-header">训练日期</div>
      <div style={{ padding: "0 16px 4px" }}>
        <div className="hig-seg" style={{ display: "flex", width: "100%" }}>
          <button
            type="button"
            className={dateMode === 0 ? "on" : ""}
            style={{ flex: 1 }}
            onClick={() => setDateMode(0)}
          >
            今天
          </button>
          <button
            type="button"
            className={dateMode === 1 ? "on" : ""}
            style={{ flex: 1 }}
            onClick={() => setDateMode(1)}
          >
            昨天
          </button>
          <button
            type="button"
            className={dateMode === -1 ? "on" : ""}
            style={{ flex: 1 }}
            onClick={() => setDateMode(-1)}
          >
            选择日期
          </button>
        </div>
        {dateMode === -1 && (
          <div className="hig-form" style={{ margin: "10px 0 0" }}>
            <label className="hig-field">
              <span className="fl">日期</span>
              <input
                type="date"
                value={customDate}
                max={dateInputValue(isoFromOffset(0))}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      {loading && <div className="hig-loading">加载模板…</div>}
      {error && (
        <p
          style={{
            color: "var(--red)",
            fontSize: 13,
            padding: "8px 32px 0"
          }}
        >
          {error}
        </p>
      )}

      {!loading && (
        <>
          {grouped.system.length > 0 && (
            <>
              <div className="hig-section-header">场景化模板</div>
              <div className="hig-list">
                {grouped.system.map((t) => (
                  <TemplateRow key={t.id} tpl={t} />
                ))}
              </div>
            </>
          )}
          {grouped.personal.length > 0 && (
            <>
              <div className="hig-section-header">我的模板</div>
              <div className="hig-list">
                {grouped.personal.map((t) => (
                  <TemplateRow key={t.id} tpl={t} />
                ))}
              </div>
            </>
          )}
          <p className="hig-section-footer" style={{ paddingBottom: 12 }}>
            选择模板后立即创建复盘，进入后即可逐区块填写，内容自动保存。
          </p>
        </>
      )}
    </BottomSheet>
  );
}
