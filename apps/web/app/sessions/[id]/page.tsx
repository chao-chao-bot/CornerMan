"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { TrainingSessionDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { SessionEditor } from "./session-editor";
import { useHigTheme } from "../../components/hig/use-hig-theme";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const dark = useHigTheme();
  const [session, setSession] = useState<TrainingSessionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadSession = useCallback(() => {
    if (!params?.id) return;
    api
      .getSession(params.id)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    reloadSession();
  }, [reloadSession]);

  if (session) {
    return <SessionEditor session={session} />;
  }

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        {loading && <div className="hig-loading">加载中…</div>}
        {error && <div className="hig-empty">{error}</div>}
      </div>
    </div>
  );
}
