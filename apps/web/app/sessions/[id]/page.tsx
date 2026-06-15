"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { TrainingSessionDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { SessionEditor } from "./session-editor";
import { SessionView } from "./session-view";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import { HigLoading } from "../../components/hig/loading";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const dark = useHigTheme();
  const [session, setSession] = useState<TrainingSessionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const reloadSession = useCallback(async () => {
    if (!params?.id) return;
    try {
      const fresh = await api.getSession(params.id);
      setSession(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    void reloadSession();
  }, [reloadSession]);

  if (session) {
    return editing ? (
      <SessionEditor
        session={session}
        onExit={async () => {
          // 先拉取最新数据再切回预览：确保只读富文本（TipTap 仅初始化时取一次内容）
          // 在挂载时即拿到最新 doc，避免显示编辑前的旧内容。
          await reloadSession();
          setEditing(false);
        }}
      />
    ) : (
      <SessionView
        key={session.updatedAt ?? session.id}
        session={session}
        onEdit={() => setEditing(true)}
      />
    );
  }

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        {loading && <HigLoading />}
        {error && <div className="hig-empty">{error}</div>}
      </div>
    </div>
  );
}
