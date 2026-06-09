import type { TrainingType } from "@cornerman/shared-types";

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  private_lesson: "私教课",
  self_training: "自我训练",
  sparring: "实战约练"
};

export const TRAINING_TYPE_OPTIONS: { value: TrainingType; label: string }[] = [
  { value: "private_lesson", label: "私教课" },
  { value: "self_training", label: "自我训练" },
  { value: "sparring", label: "实战约练" }
];

export const VIDEO_STATUS_LABEL: Record<string, string> = {
  uploading: "上传中",
  uploaded: "待处理",
  processing: "处理中",
  ready: "就绪",
  failed: "失败"
};
