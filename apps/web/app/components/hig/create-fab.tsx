"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingBubble } from "antd-mobile";
import { CreateSessionSheet } from "./create-session-sheet";
import { PlusIcon } from "./icons";
import { useAdmDarkSync } from "./use-hig-theme";

/** 全局新建入口：可拖动悬浮按钮（FloatingBubble）+ 模板选择 Sheet */
export function CreateFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useAdmDarkSync();

  return (
    <>
      <FloatingBubble
        axis="x"
        magnetic="x"
        aria-label="新建复盘"
        className="hig-fab-bubble"
        style={{
          "--initial-position-bottom": "79px",
          "--initial-position-right": "max(20px, calc(50vw - 320px + 20px))",
        } as React.CSSProperties}
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
      </FloatingBubble>
      <CreateSessionSheet
        open={open}
        onClose={() => setOpen(false)}
        onStartDraft={({ templateId, trainedAt }) => {
          setOpen(false);
          const q = new URLSearchParams({ templateId, trainedAt });
          router.push(`/sessions/new?${q.toString()}`);
        }}
      />
    </>
  );
}
