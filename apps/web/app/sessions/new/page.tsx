"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TemplateDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import { HigLoading, HigLoadingPage } from "../../components/hig/loading";
import { DraftSessionEditor } from "./draft-session-editor";

function NewSessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const dark = useHigTheme();
  const templateId = params.get("templateId");

  const [template, setTemplate] = useState<TemplateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!templateId) {
      router.replace("/sessions");
      return;
    }
    api
      .getTemplate(templateId)
      .then(setTemplate)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "模板加载失败")
      )
      .finally(() => setLoading(false));
  }, [templateId, router]);

  if (template) {
    return <DraftSessionEditor template={template} />;
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

export default function NewSessionPage() {
  return (
    <Suspense fallback={<HigLoadingPage />}>
      <NewSessionInner />
    </Suspense>
  );
}
