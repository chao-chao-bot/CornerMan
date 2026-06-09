"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@cornerman/api-client";
import { api } from "./api";

export type UploadPhase =
  | "preparing"
  | "uploading"
  | "finalizing"
  | "done"
  | "error";

export interface UploadItem {
  id: string;
  fileName: string;
  progress: number;
  phase: UploadPhase;
  error?: string;
}

/** XHR PUT 到预签名地址，回调进度（0~100） */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.send(file);
  });
}

export function useVideoUpload(sessionId: string, onComplete?: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === key ? { ...it, ...patch } : it))
    );
  }, []);

  const uploadOne = useCallback(
    async (file: File) => {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [
        ...prev,
        { id: key, fileName: file.name, progress: 0, phase: "preparing" }
      ]);
      try {
        const init = await api.initVideoUpload(sessionId, {
          fileName: file.name,
          contentType: file.type || "video/mp4",
          sizeBytes: file.size
        });
        update(key, { phase: "uploading" });
        await putWithProgress(init.uploadUrl, file, init.uploadHeaders, (p) =>
          update(key, { progress: p })
        );
        update(key, { phase: "finalizing", progress: 100 });
        await api.completeVideoUpload({ videoId: init.videoId });
        update(key, { phase: "done" });
        onComplete?.();
      } catch (err) {
        update(key, {
          phase: "error",
          error: err instanceof ApiError ? err.message : (err as Error).message
        });
      }
    },
    [sessionId, update, onComplete]
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      void files.reduce(
        (chain, file) => chain.then(() => uploadOne(file)),
        Promise.resolve()
      );
    },
    [uploadOne]
  );

  const clearDone = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.phase !== "done"));
  }, []);

  return { items, uploadFiles, clearDone };
}
