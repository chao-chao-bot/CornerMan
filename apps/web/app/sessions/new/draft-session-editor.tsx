"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SessionContent,
  SessionContentBlock,
  SessionOutcome,
  SessionOutcomeResult,
  TemplateDTO,
  TrainingType
} from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { Block } from "../../components/hig/blocks";
import { HigDateField } from "../../components/hig/hig-pickers";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import { SessionMedia } from "../[id]/session-media";

const SCENE_TRAINING_TYPE: Record<string, TrainingType> = {
  private_lesson: "private_lesson",
  sparring: "sparring",
  self_training: "self_training",
  custom: "self_training"
};

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

interface ChecklistItem {
  text?: string;
  done?: boolean;
}

/** 判断单个 block 是否填写了内容 */
function blockHasContent(b: SessionContentBlock | undefined): boolean {
  if (!b) return false;
  switch (b.type) {
    case "rich_text":
      return Boolean((b.plainText ?? "").trim());
    case "short_text":
      return Boolean(String(b.value ?? "").trim());
    case "rating":
      return Number(b.value ?? 0) > 0;
    case "checklist": {
      const items = (b.value as ChecklistItem[] | undefined) ?? [];
      return items.some((it) => Boolean((it.text ?? "").trim()) || it.done);
    }
    default:
      return false;
  }
}

/** 至少有一个字段填写了内容 */
function hasAnyContent(content: SessionContent): boolean {
  return Object.values(content).some(blockHasContent);
}

export function DraftSessionEditor({ template }: { template: TemplateDTO }) {
  const router = useRouter();
  const dark = useHigTheme();
  const blocks = template.schema?.blocks ?? [];
  const trainingType =
    SCENE_TRAINING_TYPE[template.scene] ?? "self_training";
  const isSparring = trainingType === "sparring";

  const [content, setContent] = useState<SessionContent>({});
  const [trainedAt, setTrainedAt] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const [durationMin, setDurationMin] = useState("");
  const [outcome, setOutcome] = useState<SessionOutcome>({ result: "unscored" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 草稿 session：仅在上传视频时懒建，用于承载视频；确认时转正、取消时删除
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const draftPromiseRef = useRef<Promise<string> | null>(null);

  const canSave = useMemo(() => hasAnyContent(content), [content]);

  const draftTitle = () => {
    const dateLabel = dateInputValue(trainedAt).slice(5).replace("-", "/");
    return `${template.name} · ${dateLabel}`;
  };

  /** 懒建草稿 session（不带 content → savedAt 空，列表不展示）；并发上传只建一条 */
  function ensureDraftSession(): Promise<string> {
    if (draftSessionId) return Promise.resolve(draftSessionId);
    if (draftPromiseRef.current) return draftPromiseRef.current;
    const p = api
      .createSession({
        title: draftTitle(),
        trainingType,
        trainedAt,
        templateId: template.id
      })
      .then((s) => {
        setDraftSessionId(s.id);
        return s.id;
      })
      .catch((err) => {
        draftPromiseRef.current = null;
        throw err;
      });
    draftPromiseRef.current = p;
    return p;
  }

  function onBlockChange(blockId: string, val: SessionContentBlock) {
    setContent((prev) => ({ ...prev, [blockId]: val }));
  }

  async function save() {
    if (!canSave || saving) return;
    setError(null);
    const n = Number(durationMin);
    if (durationMin.trim() !== "" && (!Number.isFinite(n) || n <= 0 || n > 1440)) {
      setError("训练时长请填 1–1440 的分钟数");
      return;
    }
    setSaving(true);
    try {
      const durationVal =
        durationMin.trim() !== "" ? Math.round(n) : undefined;
      if (draftSessionId) {
        // 已懒建草稿（传过视频）：写入内容 + 元信息，转正（updateContent 置 savedAt）
        await api.updateSessionMeta(draftSessionId, {
          title: draftTitle(),
          trainedAt,
          durationMin: durationVal,
          outcome: isSparring ? outcome : undefined
        });
        await api.updateSessionContent(draftSessionId, { content });
        router.replace("/sessions");
      } else {
        // 无视频：原子创建
        await api.createSession({
          title: draftTitle(),
          trainingType,
          trainedAt,
          templateId: template.id,
          durationMin: durationVal,
          content,
          outcome: isSparring ? outcome : undefined
        });
        router.replace("/sessions");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
      setSaving(false);
    }
  }

  async function cancel() {
    if (saving) return;
    if (draftSessionId) {
      try {
        // 删除草稿记录（后端连带软删已上传视频）
        await api.deleteSession(draftSessionId);
      } catch {
        /* 忽略：草稿清理失败不阻塞返回 */
      }
    }
    router.push("/sessions");
  }

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        <div className="hig-nav">
          <span className="nav-leading">
            <button type="button" className="hig-navbtn" onClick={cancel}>
              ← 训练
            </button>
          </span>
          <span className="nav-title">新建复盘</span>
          <span className="nav-trailing">
            <span className="hig-save" style={{ opacity: 0.6 }}>
              未保存
            </span>
          </span>
        </div>

        <div className="hig-large-title">
          {template.name}
          <span className="sub">
            草稿 · {dateInputValue(trainedAt)}
            {durationMin ? ` · ${durationMin} 分钟` : ""}
          </span>
        </div>

        {/* 训练信息 */}
        <div className="hig-section-header">训练信息</div>
        <div className="hig-form">
          <label className="hig-field">
            <span className="fl">日期</span>
            <HigDateField
              value={new Date(trainedAt)}
              max={new Date()}
              onChange={(d) => {
                d.setHours(0, 0, 0, 0);
                setTrainedAt(d.toISOString());
              }}
            />
          </label>
          <label className="hig-field">
            <span className="fl">训练时长</span>
            <input
              inputMode="numeric"
              value={durationMin}
              placeholder="分钟，例如 60"
              onChange={(e) =>
                setDurationMin(e.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </label>
        </div>

        {/* 实战成败（仅实战） */}
        {isSparring && (
          <>
            <div className="hig-section-header">实战成败</div>
            <div style={{ padding: "0 16px" }}>
              <div className="hig-seg" style={{ display: "flex", width: "100%" }}>
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    style={{ flex: 1 }}
                    className={outcome.result === o.value ? "on" : ""}
                    onClick={() =>
                      setOutcome((p) => ({ ...p, result: o.value }))
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
                />
              </label>
              <label className="hig-field">
                <span className="fl">回合数</span>
                <input
                  inputMode="numeric"
                  value={outcome.rounds ?? ""}
                  placeholder="例如 3"
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/[^0-9]/g, ""));
                    setOutcome((p) => ({
                      ...p,
                      rounds: Number.isFinite(v) && v > 0 ? v : undefined
                    }));
                  }}
                />
              </label>
            </div>
          </>
        )}

        {/* 视频素材：草稿内即可上传（首个视频会懒建草稿记录承载） */}
        <div className="hig-section-header">视频素材</div>
        <SessionMedia
          resolveSessionId={ensureDraftSession}
          onSessionResolved={(id) => setDraftSessionId(id)}
        />

        {/* 模板区块 */}
        <div className="hig-section-header">复盘内容</div>
        {blocks.length === 0 ? (
          <div className="hig-empty">该模板暂无记录区块。</div>
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

        {error && (
          <p style={{ color: "var(--red)", fontSize: 13, padding: "0 32px 8px" }}>
            {error}
          </p>
        )}
        {!canSave && (
          <p
            className="hig-section-footer"
            style={{ paddingTop: 4, paddingBottom: 0 }}
          >
            请至少填写一个字段后再保存。
          </p>
        )}

        <button
          type="button"
          className="hig-btn-filled"
          disabled={!canSave || saving}
          onClick={save}
        >
          {saving ? "保存中…" : "保存复盘"}
        </button>
        <button
          type="button"
          className="hig-btn-plain"
          onClick={cancel}
          disabled={saving}
        >
          放弃
        </button>
      </div>
    </div>
  );
}
