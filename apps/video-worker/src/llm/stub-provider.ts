import { SCORE_DIMENSIONS } from "@cornerman/ai-prompts";
import type {
  AnalysisReportItem,
  ReportDraftInput,
  ReportDraftOutput,
  ReportDraftScore,
  ScoreDimension
} from "@cornerman/shared-types";
import type { LLMProvider } from "./provider.js";

const DIMENSION_LABEL: Record<ScoreDimension, string> = {
  stance: "站架",
  guard: "护手",
  footwork: "步法",
  punch_technique: "出拳技术",
  defense: "防守",
  combination: "组合拳",
  overall: "整体表现"
};

const DIMENSION_TIP: Record<ScoreDimension, string> = {
  stance: "保持重心在两脚之间、膝盖微屈，避免身体过度前倾导致失衡。",
  guard: "出拳后注意收手回防，下巴内收，护手不要随出拳一起下沉。",
  footwork: "用小碎步保持距离与角度，避免双脚交叉或长时间静止站桩。",
  punch_technique: "出拳由蹬地、转髋、送肩发力，拳到位即收，避免甩臂。",
  defense: "结合格挡、闪避与脚步移动，被进攻时优先保护头部与肋部。",
  combination: "把单拳串成 2~3 拳的组合，注意节奏变化与最后一拳的回防。",
  overall: "整体节奏与攻防转换尚可，建议围绕薄弱维度做专项强化。"
};

/** 由字符串生成 0~1 的稳定伪随机数，保证 stub 输出确定但不千篇一律 */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 确定性 stub provider：无需任何外部依赖即可产出结构合理的报告草稿。
 * 当 DEEPSEEK_API_KEY 缺失或 DeepSeek 调用失败时作为兜底，保证链路始终能出 draft。
 */
export class StubProvider implements LLMProvider {
  readonly name = "stub-1.0.0";

  async draftReport(input: ReportDraftInput): Promise<ReportDraftOutput> {
    const segIds = input.segments.map((s) => s.id);
    const segCount = segIds.length;
    const noteHint = input.userNote?.trim()
      ? `结合你的自述「${input.userNote.trim().slice(0, 40)}」，`
      : "";

    const scores: ReportDraftScore[] = SCORE_DIMENSIONS.map((dim, idx) => {
      const base = 5.5 + seededUnit(`${dim}:${segCount}:${input.userNote ?? ""}`) * 3;
      const evidence = segCount
        ? [segIds[idx % segCount]]
        : [];
      return {
        dimension: dim,
        aiScore: round1(base),
        confidence: round1(0.45 + seededUnit(`c:${dim}`) * 0.35),
        rationale: `基于 ${segCount} 个片段对${DIMENSION_LABEL[dim]}的初步观察（自动草稿，待你校正）。`,
        evidenceSegmentIds: evidence
      };
    });

    const items: AnalysisReportItem[] = SCORE_DIMENSIONS.slice(0, Math.min(5, SCORE_DIMENSIONS.length)).map(
      (dim, idx) => ({
        key: `ai-${dim}-1`,
        dimension: dim,
        title: `${DIMENSION_LABEL[dim]}：可优化点`,
        detail: `${DIMENSION_TIP[dim]}`,
        segmentId: segCount ? segIds[idx % segCount] : undefined,
        aiConfidence: round1(0.45 + seededUnit(`i:${dim}`) * 0.35)
      })
    );

    const avg =
      round1(scores.reduce((s, x) => s + x.aiScore, 0) / scores.length);

    const summary = `${noteHint}本次训练共切分出 ${segCount} 个片段。整体表现约 ${avg}/10，` +
      `站架与出拳基础尚可，建议优先打磨步法与防守的衔接。以下条目为 AI 自动草稿，请逐条校正后定稿。`;

    return { summary, items, scores };
  }
}
