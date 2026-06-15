"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TemplateBlock,
  TemplateBlockType,
  TemplateDTO,
  TemplateScene
} from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../lib/api";
import { HigSelectField } from "../components/hig/hig-pickers";
import { useHigTheme } from "../components/hig/use-hig-theme";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
  PlusIcon
} from "../components/hig/icons";

const BLOCK_TYPE_LABEL: Record<TemplateBlockType, string> = {
  rich_text: "富文本",
  short_text: "单行文本",
  rating: "评分 1–5",
  checklist: "清单",
  media_reference: "媒体引用"
};

const FIELD_LIBRARY: { type: TemplateBlockType; name: string }[] = [
  { type: "rich_text", name: "富文本字段" },
  { type: "short_text", name: "单行文本" },
  { type: "rating", name: "评分" },
  { type: "checklist", name: "清单" },
  { type: "media_reference", name: "媒体引用" }
];

function rid() {
  return `blk_${Math.random().toString(36).slice(2, 9)}`;
}

interface TemplateBuilderProps {
  /** 已有模板（编辑/从预设另存）；不传则为新建空白模板 */
  source?: TemplateDTO;
}

export function TemplateBuilder({ source }: TemplateBuilderProps) {
  const router = useRouter();
  const dark = useHigTheme();

  const isSystemSource = source?.isSystem ?? false;
  const [name, setName] = useState(
    source ? (isSystemSource ? `${source.name} 副本` : source.name) : ""
  );
  const [scene] = useState<TemplateScene>(source?.scene ?? "custom");
  const [blocks, setBlocks] = useState<TemplateBlock[]>(
    source?.schema?.blocks?.length
      ? source.schema.blocks.map((b) => ({ ...b }))
      : [{ id: rid(), type: "rich_text", title: "记录内容", required: false }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchBlock(id: string, patch: Partial<TemplateBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) =>
      prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)
    );
  }

  function move(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  function addBlock(type: TemplateBlockType, name: string) {
    setBlocks((prev) => [
      ...prev,
      { id: rid(), type, title: name, required: false }
    ]);
  }

  async function save() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请填写模板名称");
      return;
    }
    if (blocks.length === 0) {
      setError("至少保留一个字段");
      return;
    }
    const emptyTitle = blocks.find((b) => !b.title.trim());
    if (emptyTitle) {
      setError("每个字段都需要填写标题");
      return;
    }

    const schema = {
      version: (source?.version ?? 0) + 1 || 1,
      blocks: blocks.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title.trim(),
        placeholder: b.placeholder?.trim() || undefined,
        description: b.description?.trim() || undefined,
        required: b.required ?? false
      }))
    };

    setSaving(true);
    try {
      // 编辑预设或新建 → 创建个人模板；编辑个人模板 → 更新。
      if (source && !source.isSystem) {
        await api.updateTemplate(source.id, {
          name: trimmedName,
          scene,
          description: source.description,
          schema
        });
      } else {
        await api.createTemplate({
          name: trimmedName,
          scene,
          description: source?.description,
          schema
        });
      }
      router.push("/templates");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
      setSaving(false);
    }
  }

  const onlyOne = blocks.length <= 1;

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        <div className="hig-nav">
          <span className="nav-leading">
            <button
              type="button"
              className="hig-navbtn"
              onClick={() => router.push("/templates")}
            >
              ← 模板
            </button>
          </span>
          <span className="nav-title">
            {source ? (isSystemSource ? "另存模板" : "编辑模板") : "新建模板"}
          </span>
          <span className="nav-trailing">
            <button
              type="button"
              className="hig-navbtn strong"
              disabled={saving}
              onClick={save}
            >
              {saving ? "保存中…" : "存储"}
            </button>
          </span>
        </div>

        <div className="hig-large-title">
          {source ? (isSystemSource ? "另存为我的模板" : "编辑模板") : "新建模板"}
          <span className="sub">
            {isSystemSource ? "预设字段可增删，保存后成为我的模板" : "增删字段，至少保留一个"}
          </span>
        </div>

        <div className="hig-section-header">模板名称</div>
        <div className="hig-form">
          <label className="hig-field">
            <input
              value={name}
              placeholder="例如 力量体能训练"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>

        <div className="hig-section-header">
          字段（{blocks.length}）{onlyOne ? " · 至少保留一个" : ""}
        </div>
        <div className="hig-builder">
          {blocks.map((b, i) => (
            <div className="hig-edit-row" key={b.id}>
              <button
                type="button"
                className="del"
                aria-label="删除字段"
                disabled={onlyOne}
                title={onlyOne ? "至少保留一个字段" : "删除字段"}
                onClick={() => removeBlock(b.id)}
              >
                <MinusIcon />
              </button>
              <div className="er-main">
                <input
                  className="er-title"
                  value={b.title}
                  placeholder="字段标题"
                  onChange={(e) => patchBlock(b.id, { title: e.target.value })}
                />
                <div className="er-meta">
                  <HigSelectField
                    value={b.type}
                    onChange={(val) =>
                      patchBlock(b.id, { type: val as TemplateBlockType })
                    }
                    options={Object.entries(BLOCK_TYPE_LABEL).map(
                      ([v, label]) => ({ value: v, label })
                    )}
                  />
                  <label className="er-req">
                    <input
                      type="checkbox"
                      checked={b.required ?? false}
                      onChange={(e) =>
                        patchBlock(b.id, { required: e.target.checked })
                      }
                    />
                    必填
                  </label>
                </div>
                <input
                  className="er-ph"
                  value={b.placeholder ?? ""}
                  placeholder="占位提示（可选）"
                  onChange={(e) =>
                    patchBlock(b.id, { placeholder: e.target.value })
                  }
                />
              </div>
              <div className="er-move">
                <button
                  type="button"
                  aria-label="上移"
                  disabled={i === 0}
                  onClick={() => move(b.id, -1)}
                >
                  <ArrowUpIcon />
                </button>
                <button
                  type="button"
                  aria-label="下移"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(b.id, 1)}
                >
                  <ArrowDownIcon />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hig-section-header">从字段库添加</div>
        <div className="hig-list">
          {FIELD_LIBRARY.map((f) => (
            <button
              key={f.type + f.name}
              type="button"
              className="hig-row"
              onClick={() => addBlock(f.type, f.name)}
            >
              <span className="leading-icon bg-blue">
                <PlusIcon />
              </span>
              <span className="row-main">
                <span className="row-title">{f.name}</span>
                <span className="row-sub">{BLOCK_TYPE_LABEL[f.type]}</span>
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: "var(--red)", fontSize: 13, padding: "10px 32px 0" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="hig-btn-filled"
          disabled={saving}
          onClick={save}
        >
          {saving ? "保存中…" : "存储模板"}
        </button>
        <button
          type="button"
          className="hig-btn-plain"
          onClick={() => router.push("/templates")}
        >
          取消
        </button>
      </div>
    </div>
  );
}
