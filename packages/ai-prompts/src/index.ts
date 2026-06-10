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
export const REPORT_PROMPT_VERSION = "1.0.0";

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
    "5. 评分需基于证据，信息不足时降低 confidence 而非编造细节。"
  ].join("\n")
};

function renderSegments(input: ReportDraftInput): string {
  if (!input.segments.length) {
    return "（本次训练暂无切分片段）";
  }
  return input.segments
    .map((seg, idx) => {
      const start = (seg.startMs / 1000).toFixed(1);
      const end = (seg.endMs / 1000).toFixed(1);
      const tags = seg.tags?.length ? `，标签: ${seg.tags.join("/")}` : "";
      return `- 片段#${idx + 1} id=${seg.id} 时间 ${start}s~${end}s${tags}`;
    })
    .join("\n");
}

function renderPoseMetrics(input: ReportDraftInput): string {
  if (!input.poseMetrics || Object.keys(input.poseMetrics).length === 0) {
    return "（无姿态测量数据，姿态分析能力尚在接入中）";
  }
  return Object.entries(input.poseMetrics)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
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
