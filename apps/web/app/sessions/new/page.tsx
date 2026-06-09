"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainingType } from "@cornerman/shared-types";
import { Button, Card, Field, Input, Tabs, Textarea } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { AppFrame } from "../../components/app-frame";
import { api } from "../../lib/api";
import { TRAINING_TYPE_OPTIONS } from "../../lib/labels";

function todayLocalDate(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [trainingType, setTrainingType] = useState<TrainingType>("private_lesson");
  const [date, setDate] = useState(todayLocalDate());
  const [userNote, setUserNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createSession({
        title: title.trim(),
        trainingType,
        trainedAt: new Date(`${date}T00:00:00`).toISOString(),
        userNote: userNote.trim() || undefined
      });
      router.push("/sessions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame>
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-tight">新建训练</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-2">
          先记录训练元数据与感受，稍后可上传视频与 AI 复盘
        </p>
      </div>

      <div className="max-w-[640px]">
        <Card>
          <form onSubmit={onSubmit}>
            <Field label="标题" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：周一私教课 · jab + 后撤"
                required
              />
            </Field>

            <Field label="训练类型">
              <Tabs
                value={trainingType}
                onChange={(k) => setTrainingType(k as TrainingType)}
                items={TRAINING_TYPE_OPTIONS.map((o) => ({
                  key: o.value,
                  label: o.label
                }))}
              />
            </Field>

            <Field label="训练日期" htmlFor="date">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            <Field
              label="本次感受 / 重点（文字）"
              htmlFor="note"
              hint="记录当下的主观感觉，例如：膝盖有点紧、出拳后回防慢"
            >
              <Textarea
                id="note"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="今天练了什么？哪里别扭？"
                rows={4}
              />
            </Field>

            {error && (
              <div className="mb-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "保存中…" : "保存训练"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/sessions")}
              >
                取消
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppFrame>
  );
}
