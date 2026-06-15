"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoDTO } from "@cornerman/shared-types";
import { ApiError } from "@cornerman/api-client";
import { api } from "../../lib/api";
import { uploadVideoFile } from "../../lib/upload-video";
import { CloseIcon, PlayIcon, PlusIcon } from "../../components/hig/icons";
import { HigLoading } from "../../components/hig/loading";
import { FramePlayer } from "./frame-player";

interface PendingUpload {
  id: string;
  file: File;
  progress: number;
  phase: "uploading" | "failed";
  error?: string;
}

const STATUS_TAG: Record<string, string> = {
  uploading: "上传中",
  uploaded: "等待处理",
  processing: "处理中",
  ready: "",
  failed: "处理失败"
};

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

function Ring({ progress }: { progress: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, progress)) / 100);
  return (
    <svg className="hig-ring" viewBox="0 0 44 44">
      <circle className="tk" cx="22" cy="22" r={r} />
      <circle
        className="br"
        cx="22"
        cy="22"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

interface SessionMediaProps {
  /** 正式页：已有 session id */
  sessionId?: string;
  /** 草稿页：首个视频上传时懒解析/创建 session id */
  resolveSessionId?: () => Promise<string>;
  /** 懒解析出 id 后通知父组件（草稿页用于保存/取消时识别草稿） */
  onSessionResolved?: (id: string) => void;
  /** 只读查看模式：仅展示与播放，不可上传/删除 */
  readOnly?: boolean;
}

export function SessionMedia({
  sessionId,
  resolveSessionId,
  onSessionResolved,
  readOnly
}: SessionMediaProps) {
  const [activeId, setActiveId] = useState<string | undefined>(sessionId);
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(Boolean(sessionId));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    if (!activeId) return;
    try {
      const list = await api.listSessionVideos(activeId);
      setVideos(list);
    } catch {
      /* 忽略列表刷新错误，避免打断编辑 */
    } finally {
      setLoadingVideos(false);
    }
  }, [activeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function ensureId(): Promise<string> {
    if (activeId) return activeId;
    if (!resolveSessionId) throw new Error("缺少 sessionId");
    const id = await resolveSessionId();
    setActiveId(id);
    onSessionResolved?.(id);
    return id;
  }

  // 存在处理中视频或上传中任务时轮询
  const needPoll =
    pending.length > 0 ||
    videos.some((v) => ["uploading", "uploaded", "processing"].includes(v.status));

  useEffect(() => {
    if (!needPoll) return;
    const t = setInterval(() => void reload(), 3000);
    return () => clearInterval(t);
  }, [needPoll, reload]);

  function patch(id: string, p: Partial<PendingUpload>) {
    setPending((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  const startUpload = useCallback(
    async (localId: string, file: File) => {
      try {
        const id = await ensureId();
        await uploadVideoFile(id, file, (pct) =>
          patch(localId, { progress: pct })
        );
        setPending((prev) => prev.filter((x) => x.id !== localId));
        await reload();
      } catch (err) {
        patch(localId, {
          phase: "failed",
          error: err instanceof ApiError ? err.message : "上传失败"
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload]
  );

  function addFiles(files: File[]) {
    setError(null);
    for (const file of files) {
      const localId = rid();
      setPending((prev) => [
        ...prev,
        { id: localId, file, progress: 0, phase: "uploading" }
      ]);
      void startUpload(localId, file);
    }
  }

  function retry(item: PendingUpload) {
    patch(item.id, { phase: "uploading", progress: 0, error: undefined });
    void startUpload(item.id, item.file);
  }

  async function removeVideo(v: VideoDTO) {
    if (!window.confirm("删除该视频？此操作不可撤销。")) return;
    try {
      await api.deleteVideo(v.id);
      setVideos((prev) => prev.filter((x) => x.id !== v.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  return (
    <div className="hig-media">
      <div className="hig-media-grid">
        {/* 已上传 / 处理中 / 就绪的服务端视频 */}
        {videos.map((v) => {
          const ready = v.status === "ready";
          const failed = v.status === "failed";
          const tag = STATUS_TAG[v.status];
          return (
            <div className="hig-mcell" key={v.id}>
              {!readOnly && (
                <button
                  type="button"
                  className="corner-del"
                  aria-label="删除"
                  onClick={() => removeVideo(v)}
                >
                  <CloseIcon />
                </button>
              )}
              {ready ? (
                <button
                  type="button"
                  style={{ all: "unset", cursor: "pointer", width: "100%", height: "100%" }}
                  onClick={() => v.playbackUrl && setActiveVideo(v)}
                >
                  {v.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.posterUrl} alt={v.originalFileName ?? "视频"} />
                  ) : v.playbackUrl ? (
                    <video
                      className="thumb"
                      src={`${v.playbackUrl}#t=0.1`}
                      preload="metadata"
                      muted
                      playsInline
                      tabIndex={-1}
                    />
                  ) : (
                    <span className="ph">视频</span>
                  )}
                  <span className="play-badge">
                    <PlayIcon />
                  </span>
                </button>
              ) : failed ? (
                <div className="ov fail">
                  <span>处理失败</span>
                </div>
              ) : (
                <div className="ov">
                  <Ring progress={35} />
                  <span>{tag || "处理中"}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* 本地上传中 / 失败任务 */}
        {pending.map((p) => (
          <div className="hig-mcell" key={p.id}>
            {p.phase === "failed" ? (
              <>
                <button
                  type="button"
                  className="corner-del"
                  aria-label="移除"
                  onClick={() =>
                    setPending((prev) => prev.filter((x) => x.id !== p.id))
                  }
                >
                  <CloseIcon />
                </button>
                <div className="ov fail">
                  <span>上传失败</span>
                  <button type="button" className="retry" onClick={() => retry(p)}>
                    重试
                  </button>
                </div>
              </>
            ) : (
              <div className="ov">
                <Ring progress={p.progress} />
                <span>{p.progress}%</span>
              </div>
            )}
          </div>
        ))}

        {/* 添加 */}
        {!readOnly && (
          <button
            type="button"
            className="hig-mcell add"
            onClick={() => inputRef.current?.click()}
          >
            <PlusIcon />
            添加视频
          </button>
        )}
      </div>

      {readOnly && loadingVideos && <HigLoading text="加载视频…" />}

      {readOnly && !loadingVideos && videos.length === 0 && (
        <div className="hig-empty" style={{ padding: "18px 0", fontSize: 14 }}>
          本次训练没有视频素材。
        </div>
      )}

      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) addFiles(files);
          }}
        />
      )}

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
      {!readOnly && (
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--label-3)", lineHeight: 1.4 }}>
          视频在后台异步上传与转码，期间可继续填写复盘；就绪后点封面进入逐帧复盘。
        </p>
      )}

      {activeVideo?.playbackUrl && (
        <FramePlayer
          src={activeVideo.playbackUrl}
          poster={activeVideo.posterUrl}
          title={activeVideo.originalFileName ?? "逐帧复盘"}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
