/**
 * @cornerman/ai-prompts · LLM prompt 模板与版本管理
 *
 * 报告生成走「AI 起草 + 用户定稿」模式：把结构化的训练数据（训练类型 / 用户感受 /
 * 片段时间轴 / 姿态指标）渲染成 prompt，要求 LLM 以严格 JSON 输出复盘草稿与 7 维评分。
 * 以版本号管理 prompt，便于 A/B 与回溯（写入 AnalysisReport.promptVersion）。
 */

import type {
  ReportDraftInput,
  ScoreDimension,
  TrainingType
} from "@cornerman/shared-types";

export interface PromptTemplate {
  id: string;
  version: string;
  description: string;
  /** system 角色模板（固定，不含动态数据） */
  system: string;
}

/** 当前报告起草 prompt 版本 */
export const REPORT_PROMPT_VERSION = "1.3.0";

/** 7 个评分维度（与 ScoreDimension 对齐），用于约束 LLM 输出 */
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  "stance",
  "guard",
  "footwork",
  "punch_technique",
  "defense",
  "combination",
  "overall"
];

const DIMENSION_LABEL: Record<ScoreDimension, string> = {
  stance: "站架 (stance)",
  guard: "护手 (guard)",
  footwork: "步法 (footwork)",
  punch_technique: "出拳技术 (punch_technique)",
  defense: "防守 (defense)",
  combination: "组合拳 (combination)",
  overall: "整体 (overall)"
};

const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  private_lesson: "私教课",
  self_training: "自我训练",
  sparring: "实战 / 陪练"
};

export const REPORT_DRAFT_PROMPT: PromptTemplate = {
  id: "report-draft",
  version: REPORT_PROMPT_VERSION,
  description: "将训练结构化数据转为拳击复盘草稿（含 7 维评分）",
  system: [
    "你是一名资深拳击教练，正在为一名业余拳击爱好者撰写一次训练的复盘报告草稿。",
    "你会收到这次训练的结构化信息：训练类型、训练者自述感受、被切分出的视频片段时间轴，以及可选的姿态测量指标。",
    "请基于这些信息，输出专业、具体、可执行的复盘，避免空泛套话。",
    "",
    "硬性要求：",
    "1. 只输出一个 JSON 对象，不要包含 markdown 代码块、解释或任何额外文字。",
    "2. JSON 结构必须严格为：",
    "{",
    '  "summary": string,            // 200 字以内的整体复盘总结',
    '  "items": [                    // 3~7 条具体观察/建议',
    "    {",
    '      "key": string,            // 唯一稳定标识，使用 "ai-<维度>-<序号>" 形式',
    '      "dimension": string,      // 必须是 7 个维度之一',
    '      "title": string,          // 一句话要点',
    '      "detail": string,         // 具体说明与改进建议',
    '      "segmentId": string|null, // 若该观察对应某个视频片段，填其 id；否则 null',
    '      "aiConfidence": number    // 0~1 的置信度',
    "    }",
    "  ],",
    '  "scores": [                   // 必须正好覆盖全部 7 个维度，各一条',
    "    {",
    '      "dimension": string,      // 7 个维度之一',
    '      "aiScore": number,        // 0~10',
    '      "confidence": number,     // 0~1',
    '      "rationale": string,      // 给出该分数的简短理由',
    '      "evidenceSegmentIds": string[] // 支撑评分的片段 id 列表，可为空数组',
    "    }",
    "  ]",
    "}",
    "3. dimension 取值只能是：stance, guard, footwork, punch_technique, defense, combination, overall。",
    "4. segmentId / evidenceSegmentIds 只能引用输入中真实出现的片段 id。",
    "5. 评分需基于证据，信息不足时降低 confidence 而非编造细节。",
    "6. 片段时间轴中每个片段附带其量化指标（出拳数/拳型/护手/步伐等），观察与建议要尽量定位到具体片段：在 segmentId 中引用该片段 id，并在 detail 中说明该片段的时间区间与指标依据。"
  ].join("\n")
};

/** 片段标签 → 人话（动作驱动切片产出；candidate 为机械切片兜底） */
const SEGMENT_TAG_LABEL: Record<string, string> = {
  punch_burst: "出拳串（腕速峰值聚类）",
  evade: "躲闪（头部横移/下潜）",
  footwork: "步伐移动",
  guard_hold: "防守（护手保持高位）",
  high_activity: "原地高强度",
  rest: "休息/间歇",
  low_activity: "低活动强度",
  straight: "以直拳为主",
  hook_swing: "以勾/摆拳为主",
  uppercut: "以上勾拳为主",
  combo: "含组合拳（连续≥3拳）",
  moving: "移动中出拳",
  with_evade: "含躲闪动作",
  candidate: "候选片段（未做动作识别）"
};

const PUNCH_KIND_LABEL: Record<string, string> = {
  straight: "直拳",
  hook_swing: "勾/摆拳",
  uppercut: "上勾拳"
};

/** 片段级指标 → 简短中文（跟在片段行后） */
function renderSegmentMetrics(metrics: NonNullable<ReportDraftInput["segments"][number]["metrics"]>): string {
  const parts: string[] = [];
  if (typeof metrics.punchCount === "number" && metrics.punchCount > 0) {
    parts.push(`出拳 ${metrics.punchCount} 次`);
  }
  if (metrics.punchTypes && Object.keys(metrics.punchTypes).length) {
    const types = Object.entries(metrics.punchTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${PUNCH_KIND_LABEL[k] ?? k}×${n}`)
      .join(" ");
    parts.push(`拳型 ${types}`);
  }
  if (typeof metrics.avgPunchSpeed === "number") {
    parts.push(`平均腕速 ${metrics.avgPunchSpeed}（肩宽/秒）`);
  }
  if (typeof metrics.evadeCount === "number" && metrics.evadeCount > 0) {
    parts.push(`躲闪 ${metrics.evadeCount} 次`);
  }
  if (typeof metrics.guardUpRatio === "number") {
    parts.push(`护手到位 ${(metrics.guardUpRatio * 100).toFixed(0)}%`);
  }
  if (typeof metrics.footworkIntensity === "number") {
    parts.push(`步伐强度 ${metrics.footworkIntensity}`);
  }
  if (typeof metrics.activity === "number") {
    parts.push(`活动度 ${metrics.activity}`);
  }
  return parts.join("，");
}

function renderSegments(input: ReportDraftInput): string {
  if (!input.segments.length) {
    return "（本次训练暂无切分片段）";
  }
  return input.segments
    .map((seg, idx) => {
      const start = (seg.startMs / 1000).toFixed(1);
      const end = (seg.endMs / 1000).toFixed(1);
      const tags = seg.tags?.length
        ? `，类型: ${seg.tags.map((t) => SEGMENT_TAG_LABEL[t] ?? t).join("/")}`
        : "";
      const metrics = seg.metrics ? renderSegmentMetrics(seg.metrics) : "";
      const metricsPart = metrics ? `，指标: ${metrics}` : "";
      return `- 片段#${idx + 1} id=${seg.id} 时间 ${start}s~${end}s${tags}${metricsPart}`;
    })
    .join("\n");
}

/** 姿态指标 → 中文标签 + 单位格式化（未知 key 原样输出以兼容附加指标） */
const POSE_METRIC_RENDERERS: Record<
  string,
  { label: string; format: (v: number) => string }
> = {
  punchCount: { label: "出拳次数", format: (v) => `${v} 次` },
  punchesPerMin: { label: "出拳频率", format: (v) => `${v} 次/分钟` },
  guardUpRatio: {
    label: "护手到位率（双腕高于肩线时长占比）",
    format: (v) => `${(v * 100).toFixed(0)}%`
  },
  stanceWidthRatio: {
    label: "平均站距（踝距/肩宽）",
    format: (v) => v.toFixed(2)
  },
  highActivityRatio: {
    label: "高强度活动时间占比",
    format: (v) => `${(v * 100).toFixed(0)}%`
  },
  detectRate: {
    label: "姿态检出率（测量可信度参考）",
    format: (v) => `${(v * 100).toFixed(0)}%`
  },
  analyzedFrames: { label: "分析帧数", format: (v) => `${v} 帧` },
  sampleFps: { label: "采样帧率", format: (v) => `${v} fps` },
  evadeCount: { label: "躲闪次数（头部横移/下潜）", format: (v) => `${v} 次` }
};

function renderPoseMetrics(input: ReportDraftInput): string {
  const metrics = input.poseMetrics;
  if (!metrics || Object.keys(metrics).length === 0) {
    return "（无姿态测量数据，请基于片段时间轴与训练者自述进行复盘，并相应降低置信度）";
  }
  const lines = Object.entries(metrics)
    .filter(([k, v]) => v !== undefined && k !== "punchEvents")
    .map(([k, v]) => {
      const renderer = POSE_METRIC_RENDERERS[k];
      if (renderer && typeof v === "number") {
        return `- ${renderer.label}: ${renderer.format(v)}`;
      }
      if (k === "punchTypes" && v && typeof v === "object") {
        const types = Object.entries(v as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .map(([kind, n]) => `${PUNCH_KIND_LABEL[kind] ?? kind} ${n} 次`)
          .join("、");
        return `- 拳型分布: ${types || "（无）"}`;
      }
      return `- ${k}: ${v}`;
    });
  return [
    "（以下为姿态模型从视频中实际测量的数据，请优先以此为依据）",
    ...lines
  ].join("\n");
}

/** 渲染报告起草 prompt 的 system + user 两段 */
export function renderReportDraftPrompt(input: ReportDraftInput): {
  system: string;
  user: string;
} {
  const user = [
    `训练类型：${TRAINING_TYPE_LABEL[input.trainingType] ?? input.trainingType}`,
    "",
    "训练者自述感受：",
    input.userNote?.trim() ? input.userNote.trim() : "（训练者未填写感受）",
    "",
    "视频片段时间轴：",
    renderSegments(input),
    "",
    "姿态测量指标：",
    renderPoseMetrics(input),
    "",
    `请覆盖以下 7 个评分维度：${SCORE_DIMENSIONS.map((d) => DIMENSION_LABEL[d]).join("、")}。`,
    "现在请严格按要求输出 JSON。"
  ].join("\n");

  return { system: REPORT_DRAFT_PROMPT.system, user };
}
