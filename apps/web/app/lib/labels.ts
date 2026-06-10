import type { ScoreDimension, TrainingType } from "@cornerman/shared-types";

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

export const SCORE_DIMENSION_LABEL: Record<ScoreDimension, string> = {
  stance: "站架",
  guard: "护手",
  footwork: "步法",
  punch_technique: "出拳技术",
  defense: "防守",
  combination: "组合拳",
  overall: "整体"
};

export const SCORE_DIMENSION_ORDER: ScoreDimension[] = [
  "stance",
  "guard",
  "footwork",
  "punch_technique",
  "defense",
  "combination",
  "overall"
];

/** 动作片段标签 → 中文（主标签 + 副标签） */
export const SEGMENT_TAG_LABEL: Record<string, string> = {
  punch_burst: "出拳串",
  evade: "躲闪",
  footwork: "步伐移动",
  guard_hold: "防守保持",
  high_activity: "原地高强度",
  rest: "休息",
  low_activity: "低强度",
  straight: "直拳为主",
  hook_swing: "勾/摆拳为主",
  uppercut: "上勾拳为主",
  combo: "组合拳",
  moving: "移动中出拳",
  with_evade: "含躲闪",
  candidate: "候选片段"
};

export const PUNCH_KIND_LABEL: Record<string, string> = {
  straight: "直拳",
  hook_swing: "勾/摆拳",
  uppercut: "上勾拳"
};
