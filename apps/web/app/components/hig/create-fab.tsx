"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateSessionSheet } from "./create-session-sheet";
import { PlusIcon } from "./icons";

/** 全局新建入口：HIG 悬浮按钮 + 模板选择 Sheet */
export function CreateFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="hig-fab"
        aria-label="新建复盘"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
      </button>
      <CreateSessionSheet
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(id) => {
          setOpen(false);
          router.push(`/sessions/${id}`);
        }}
      />
    </>
  );
}
