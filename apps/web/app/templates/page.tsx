"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { HigScaffold } from "../components/hig/scaffold";
import { HigLoading } from "../components/hig/loading";
import {
  BoltIcon,
  ChevronRightIcon,
  DumbbellIcon,
  NoteIcon,
  PlusIcon,
  SCENE_ICON_FILL
} from "../components/hig/icons";
import { api } from "../lib/api";

function SceneIcon({ scene }: { scene: string }) {
  if (scene === "sparring") return <BoltIcon />;
  if (scene === "self_training") return <DumbbellIcon />;
  return <NoteIcon />;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTemplates()
      .then(setTemplates)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "加载失败")
      )
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const system = templates.filter((t) => t.isSystem);
    const personal = templates.filter((t) => !t.isSystem);
    return { system, personal };
  }, [templates]);

  function Row({ tpl }: { tpl: TemplateDTO }) {
    return (
      <button
        type="button"
        className="hig-row"
        onClick={() => router.push(`/templates/${tpl.id}`)}
      >
        <span className={`leading-icon ${SCENE_ICON_FILL[tpl.scene] ?? "bg-gray"}`}>
          <SceneIcon scene={tpl.scene} />
        </span>
        <span className="row-main">
          <span className="row-title">{tpl.name}</span>
          <span className="row-sub">
            {tpl.description ?? `${tpl.schema?.blocks?.length ?? 0} 个字段`}
          </span>
        </span>
        <span className="chevron">
          <ChevronRightIcon />
        </span>
      </button>
    );
  }

  const trailing = (
    <button
      type="button"
      className="hig-navbtn strong"
      onClick={() => router.push("/templates/new")}
    >
      新建
    </button>
  );

  return (
    <HigScaffold title="模板" trailing={trailing}>
      <div className="hig-large-title">
        模板
        <span className="sub">场景预设可改字段，也能新建自己的模板</span>
      </div>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, padding: "10px 32px 0" }}>
          {error}
        </p>
      )}

      {loading ? (
        <HigLoading />
      ) : (
        <>
          {grouped.system.length > 0 && (
            <>
              <div className="hig-section-header">场景预设</div>
              <div className="hig-list">
                {grouped.system.map((t) => (
                  <Row key={t.id} tpl={t} />
                ))}
              </div>
              <p className="hig-section-footer">
                编辑预设会另存为「我的模板」，不影响原始预设。
              </p>
            </>
          )}

          <div className="hig-section-header">我的模板</div>
          {grouped.personal.length === 0 ? (
            <div className="hig-empty" style={{ padding: "18px 0" }}>
              还没有自定义模板，点右上角「新建」或从预设编辑另存。
            </div>
          ) : (
            <div className="hig-list">
              {grouped.personal.map((t) => (
                <Row key={t.id} tpl={t} />
              ))}
            </div>
          )}

          <button
            type="button"
            className="hig-btn-filled"
            onClick={() => router.push("/templates/new")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PlusIcon style={{ width: 18, height: 18 }} />
              新建模板
            </span>
          </button>
        </>
      )}
    </HigScaffold>
  );
}
