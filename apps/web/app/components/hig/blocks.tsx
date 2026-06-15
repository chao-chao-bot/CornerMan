"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import type { SessionContentBlock, TemplateBlock } from "@cornerman/shared-types";
import { CheckIcon, StarIcon } from "./icons";

export interface BlockProps {
  block: TemplateBlock;
  value: SessionContentBlock | undefined;
  onChange: (next: SessionContentBlock) => void;
  /** 只读查看模式：不可编辑，仅展示已填内容 */
  readOnly?: boolean;
}

/* ---------------- 富文本（TipTap） ---------------- */

function RichTextBlock({ block, value, onChange, readOnly }: BlockProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [2] } }),
      Highlight
    ],
    content: (value?.doc as object | undefined) ?? "",
    onUpdate: ({ editor: ed }) => {
      if (readOnly) return;
      onChange({
        type: "rich_text",
        doc: ed.getJSON(),
        plainText: ed.getText()
      });
    },
    editorProps: {
      attributes: { class: "rt" }
    }
  });

  const isEmpty = editor?.isEmpty ?? true;

  if (readOnly) {
    if (isEmpty) return <p className="blk-view-empty">未填写</p>;
    return <EditorContent editor={editor} />;
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        {isEmpty && (
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 0,
              color: "var(--label-3)",
              pointerEvents: "none",
              fontSize: 17
            }}
          >
            {block.placeholder ?? "在此记录…"}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      {editor && (
        <div className="hig-toolbar">
          <button
            type="button"
            className={editor.isActive("heading", { level: 2 }) ? "on" : ""}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            标题
          </button>
          <button
            type="button"
            className={editor.isActive("bold") ? "on" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={editor.isActive("bulletList") ? "on" : ""}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • 列表
          </button>
          <button
            type="button"
            className={editor.isActive("highlight") ? "on" : ""}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            高亮
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- 短文本 ---------------- */

function ShortTextBlock({ block, value, onChange, readOnly }: BlockProps) {
  const text = (value?.value as string) ?? "";
  if (readOnly) {
    return text.trim() ? (
      <p className="blk-view-text">{text}</p>
    ) : (
      <p className="blk-view-empty">未填写</p>
    );
  }
  return (
    <input
      className="short"
      value={text}
      placeholder={block.placeholder ?? "输入…"}
      onChange={(e) =>
        onChange({ type: "short_text", value: e.target.value })
      }
    />
  );
}

/* ---------------- 评分（5 星） ---------------- */

function RatingBlock({ value, onChange, readOnly }: BlockProps) {
  const score = Number(value?.value ?? 0);
  if (readOnly) {
    return (
      <div className="hig-stars" aria-label={`评分 ${score} / 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon key={n} className={`s${n <= score ? " on" : ""}`} />
        ))}
      </div>
    );
  }
  return (
    <div className="hig-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() =>
            onChange({ type: "rating", value: n === score ? 0 : n })
          }
        >
          <StarIcon className={`s${n <= score ? " on" : ""}`} />
        </button>
      ))}
    </div>
  );
}

/* ---------------- 清单 ---------------- */

interface ChecklistItem {
  text: string;
  done: boolean;
}

function ChecklistBlock({ value, onChange, readOnly }: BlockProps) {
  const items = (value?.value as ChecklistItem[] | undefined) ?? [];

  if (readOnly) {
    const filled = items.filter((it) => it.text.trim());
    if (filled.length === 0) return <p className="blk-view-empty">未填写</p>;
    return (
      <div>
        {filled.map((it, idx) => (
          <div className="hig-check view" key={idx}>
            <span className={`box${it.done ? " on" : ""}`}>
              {it.done && <CheckIcon />}
            </span>
            <span className="ck-text">{it.text}</span>
          </div>
        ))}
      </div>
    );
  }

  function update(next: ChecklistItem[]) {
    onChange({ type: "checklist", value: next });
  }

  function setItem(idx: number, patch: Partial<ChecklistItem>) {
    update(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    update([...items, { text: "", done: false }]);
  }

  function removeItem(idx: number) {
    update(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {items.map((it, idx) => (
        <div className="hig-check" key={idx}>
          <span
            className={`box${it.done ? " on" : ""}`}
            onClick={() => setItem(idx, { done: !it.done })}
          >
            {it.done && <CheckIcon />}
          </span>
          <input
            value={it.text}
            placeholder="清单项…"
            onChange={(e) => setItem(idx, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
              if (e.key === "Backspace" && it.text === "" && items.length > 1) {
                e.preventDefault();
                removeItem(idx);
              }
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="hig-btn-plain"
        style={{ textAlign: "left", height: 36, margin: 0 }}
        onClick={addItem}
      >
        + 添加一项
      </button>
    </div>
  );
}

/* ---------------- 媒体引用（占位，R7 接素材库） ---------------- */

function MediaReferenceBlock({ block }: BlockProps) {
  return (
    <div className="hig-empty" style={{ padding: "18px 0", fontSize: 14 }}>
      {block.placeholder ?? "素材挂载将在素材库上线后开放"}
    </div>
  );
}

/* ---------------- 调度 ---------------- */

export function Block(props: BlockProps) {
  // SSR 安全：TipTap 在客户端挂载后再渲染富文本
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { block, readOnly } = props;
  return (
    <div className="hig-block">
      <div className="blk-head">
        <span className="blk-label">{block.title}</span>
        {block.required && !readOnly && <span className="blk-req">必填</span>}
      </div>
      {block.type === "rich_text" &&
        (mounted ? (
          <RichTextBlock {...props} />
        ) : (
          <div className="ce" style={{ color: "var(--label-3)" }}>
            {readOnly ? "" : block.placeholder ?? "在此记录…"}
          </div>
        ))}
      {block.type === "short_text" && <ShortTextBlock {...props} />}
      {block.type === "rating" && <RatingBlock {...props} />}
      {block.type === "checklist" && <ChecklistBlock {...props} />}
      {block.type === "media_reference" && <MediaReferenceBlock {...props} />}
      {block.description && (
        <p
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--label-3)",
            lineHeight: 1.4
          }}
        >
          {block.description}
        </p>
      )}
    </div>
  );
}
