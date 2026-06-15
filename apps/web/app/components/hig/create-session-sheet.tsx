"use client";

import { useEffect, useMemo, useState } from "react";
import type { TemplateDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { BottomSheet } from "./bottom-sheet";
import { HigLoading } from "./loading";
import { HigDateField } from "./hig-pickers";
import {
  BoltIcon,
  CheckIcon,
  DumbbellIcon,
  NoteIcon,
  SCENE_ICON_FILL
} from "./icons";

interface CreateSessionSheetProps {
  open: boolean;
  onClose: () => void;
  /** 选中模板 + 日期后发起草稿（此时不落库，由草稿页确认保存后才创建） */
  onStartDraft: (params: { templateId: string; trainedAt: string }) => void;
}

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
  onStartDraft
}: CreateSessionSheetProps) {
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 日期快选：0=今天 1=昨天 -1=自定义
  const [dateMode, setDateMode] = useState<0 | 1 | -1>(0);
  const [customDate, setCustomDate] = useState(dateInputValue(isoFromOffset(0)));

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelectedId(null);
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

  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  function startDraft() {
    if (!selectedTpl) return;
    onStartDraft({ templateId: selectedTpl.id, trainedAt });
  }

  function TemplateRow({ tpl }: { tpl: TemplateDTO }) {
    const on = selectedId === tpl.id;
    return (
      <button
        type="button"
        className="hig-row"
        onClick={() => setSelectedId(tpl.id)}
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
        {on && (
          <span className="hig-check-trailing" aria-label="已选择">
            <CheckIcon />
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
              <HigDateField
                value={new Date(`${customDate}T00:00:00`)}
                max={new Date(isoFromOffset(0))}
                onChange={(d) => setCustomDate(dateInputValue(d.toISOString()))}
              />
            </label>
          </div>
        )}
      </div>

      {loading && <HigLoading text="加载模板…" />}
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
          <p className="hig-section-footer" style={{ paddingBottom: 4 }}>
            选择一个模板，点「新建复盘」进入填写；至少填写一个字段并保存后才会创建记录。
          </p>
          <button
            type="button"
            className="hig-btn-filled"
            disabled={!selectedId}
            onClick={startDraft}
          >
            新建复盘
          </button>
        </>
      )}
    </BottomSheet>
  );
}
