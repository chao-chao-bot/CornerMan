"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@cornerman/api-client";
import { uploadVideoFile } from "./upload-video";

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
        update(key, { phase: "uploading" });
        await uploadVideoFile(sessionId, file, (p) =>
          update(key, { progress: p })
        );
        update(key, { phase: "done", progress: 100 });
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
