"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { TemplateDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { useHigTheme } from "../../components/hig/use-hig-theme";
import { HigLoading } from "../../components/hig/loading";
import { TemplateBuilder } from "../template-builder";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const dark = useHigTheme();
  const [template, setTemplate] = useState<TemplateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    api
      .getTemplate(params.id)
      .then(setTemplate)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (template) {
    return <TemplateBuilder source={template} />;
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
