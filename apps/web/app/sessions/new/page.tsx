"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { TrainingType } from "@cornerman/shared-types";
import {
  Button,
  Field,
  Input,
  Module,
  SegControl,
  Textarea,
  Uploader
} from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../../components/app-frame";
import { api } from "../../lib/api";
import { TRAINING_TYPE_LABEL, TRAINING_TYPE_OPTIONS } from "../../lib/labels";
import { uploadVideoFile } from "../../lib/upload-video";

type PendingFile = {
  id: string;
  file: File;
  progress: number;
  phase: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [trainingType, setTrainingType] =
    useState<TrainingType>("private_lesson");
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [focus, setFocus] = useState("");
  const [userNote, setUserNote] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addFiles(picked: File[]) {
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        progress: 0,
        phase: "pending" as const
      }))
    ]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function patchFile(id: string, patch: Partial<PendingFile>) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }

  async function onSave() {
    setError(null);
    if (!date) {
      setError("请选择训练日期");
      return;
    }
    const durationNum = durationMin.trim() ? Number(durationMin) : undefined;
    if (durationNum !== undefined && (!Number.isFinite(durationNum) || durationNum <= 0)) {
      setError("时长请填写正整数（分钟）");
      return;
    }

    const finalTitle =
      title.trim() ||
      focus.trim() ||
      `${TRAINING_TYPE_LABEL[trainingType]} · ${date.format("YYYY-MM-DD")}`;

    setSaving(true);
    try {
      const session = await api.createSession({
        title: finalTitle,
        trainingType,
        trainedAt: date.startOf("day").toISOString(),
        durationMin: durationNum,
        location: location.trim() || undefined,
        focus: focus.trim() || undefined,
        userNote: userNote.trim() || undefined
      });

      for (const item of files) {
        patchFile(item.id, { phase: "uploading" });
        try {
          await uploadVideoFile(session.id, item.file, (p) =>
            patchFile(item.id, { progress: p })
          );
          patchFile(item.id, { phase: "done", progress: 100 });
        } catch (err) {
          patchFile(item.id, {
            phase: "error",
            error:
              err instanceof ApiError ? err.message : (err as Error).message
          });
          throw err;
        }
      }

      router.push(`/sessions/${session.id}`);
    } catch (err) {
      if (!error) {
        setError(
          err instanceof ApiError
            ? err.message
            : "保存失败，请检查后重试（视频可稍后在报告页补传）"
        );
      }
      setSaving(false);
    }
  }

  const headerExtras = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        onClick={() => router.push("/sessions")}
        disabled={saving}
      >
        取消
      </Button>
      <Button variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "保存中…" : "保存并开始分析"}
      </Button>
    </div>
  );

  return (
    <AppFrame headerExtras={headerExtras}>
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-tight">新建训练</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-2">
          先填基础信息再上传视频，保存后 AI 自动开始分析
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Module head="训练信息" meta="约 1 分钟">
          <Field label="标题（可选）" htmlFor="title">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="留空将自动用「本次重点」或「类型 + 日期」"
            />
          </Field>

          <Field label="训练类型">
            <SegControl
              value={trainingType}
              onChange={(v) => setTrainingType(v)}
              options={TRAINING_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="日期">
              <DatePicker
                value={date}
                onChange={(d) => d && setDate(d)}
                allowClear={false}
                format="YYYY-MM-DD"
                className="w-full"
                placeholder="选择训练日期"
              />
            </Field>
            <Field label="时长（分钟）" htmlFor="duration">
              <Input
                id="duration"
                inputMode="numeric"
                value={durationMin}
                onChange={(e) =>
                  setDurationMin(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="例如 48"
              />
            </Field>
          </div>

          <Field label="地点" htmlFor="location">
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例如 中拳道拳馆"
            />
          </Field>

          <Field label="本次重点" htmlFor="focus">
            <Input
              id="focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="例如 jab 后快速回防 + 后撤步收脚"
            />
          </Field>

          <Field label="主观感受" htmlFor="note">
            <Textarea
              id="note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="今天状态、身体感觉、想专门练的点……"
              rows={3}
            />
          </Field>
        </Module>

        <Module head="训练视频" meta="支持多个 · 保存后自动处理">
          <Uploader onFiles={addFiles} disabled={saving} />

          {files.map((f) => (
            <div
              key={f.id}
              className="mt-2.5 flex items-center gap-3 rounded-sm border border-line bg-surface p-3"
            >
              <div className="h-10 w-16 flex-shrink-0 rounded-[5px] bg-[radial-gradient(circle_at_50%_40%,#2c3440,#161b22)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">
                  {f.file.name}
                  <span className="ml-1.5 text-[11px] font-normal text-ink-3">
                    {fmtSize(f.file.size)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-line bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-all ${f.phase === "error" ? "bg-risk" : "bg-brand"}`}
                    style={{
                      width: `${f.phase === "pending" ? 0 : f.progress}%`
                    }}
                  />
                </div>
              </div>
              {f.phase === "pending" && !saving ? (
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="text-[12px] text-ink-3 hover:text-risk"
                >
                  移除
                </button>
              ) : (
                <span
                  className={`whitespace-nowrap text-[11px] font-semibold ${
                    f.phase === "done"
                      ? "text-improved"
                      : f.phase === "error"
                        ? "text-risk"
                        : f.phase === "uploading"
                          ? "text-brand"
                          : "text-ink-3"
                  }`}
                >
                  {f.phase === "done"
                    ? "已完成"
                    : f.phase === "error"
                      ? "失败"
                      : f.phase === "uploading"
                        ? `上传中 ${f.progress}%`
                        : "待上传"}
                </span>
              )}
            </div>
          ))}

          {error && (
            <div className="mt-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk">
              {error}
            </div>
          )}

          <p className="mt-3 text-[12px] text-ink-3">
            视频为私有存储，仅你可见。保存后将自动转码、切分片段并生成 AI 复盘草稿。
          </p>
        </Module>
      </div>
    </AppFrame>
  );
}
