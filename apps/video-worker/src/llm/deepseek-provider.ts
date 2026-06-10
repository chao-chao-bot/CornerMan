import { renderReportDraftPrompt } from "@cornerman/ai-prompts";
import type {
  AnalysisReportItem,
  ReportDraftInput,
  ReportDraftOutput,
  ReportDraftScore,
  ScoreDimension
} from "@cornerman/shared-types";
import type { LLMProvider } from "./provider.js";

const VALID_DIMENSIONS: ScoreDimension[] = [
  "stance",
  "guard",
  "footwork",
  "punch_technique",
  "defense",
  "combination",
  "overall"
];

function clampUnit(n: unknown, fallback = 0.5): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(1, v));
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 5;
  return Math.max(0, Math.min(10, v));
}

function asDimension(v: unknown): ScoreDimension | null {
  return typeof v === "string" && (VALID_DIMENSIONS as string[]).includes(v)
    ? (v as ScoreDimension)
    : null;
}

interface DeepSeekOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class DeepSeekProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts: DeepSeekOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.deepseek.com").replace(/\/+$/, "");
    this.model = opts.model ?? "deepseek-chat";
    this.name = `deepseek:${this.model}`;
  }

  async draftReport(input: ReportDraftInput): Promise<ReportDraftOutput> {
    const { system, user } = renderReportDraftPrompt(input);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 返回为空");

    return this.parse(content, input);
  }

  private parse(content: string, input: ReportDraftInput): ReportDraftOutput {
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("DeepSeek 输出非法 JSON");
    }
    const obj = raw as Record<string, unknown>;

    const summary = typeof obj.summary === "string" ? obj.summary : "";
    if (!summary) throw new Error("DeepSeek 输出缺少 summary");

    const validSegIds = new Set(input.segments.map((s) => s.id));

    const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
    const items: AnalysisReportItem[] = itemsRaw
      .map((it, idx): AnalysisReportItem | null => {
        const r = it as Record<string, unknown>;
        const dim = asDimension(r.dimension);
        if (!dim) return null;
        const title = typeof r.title === "string" ? r.title : "";
        const detail = typeof r.detail === "string" ? r.detail : "";
        if (!title && !detail) return null;
        const segId =
          typeof r.segmentId === "string" && validSegIds.has(r.segmentId)
            ? r.segmentId
            : undefined;
        const key =
          typeof r.key === "string" && r.key.trim() ? r.key : `ai-${dim}-${idx + 1}`;
        return {
          key,
          dimension: dim,
          title: title || detail.slice(0, 30),
          detail: detail || title,
          segmentId: segId,
          aiConfidence: clampUnit(r.aiConfidence)
        };
      })
      .filter((x): x is AnalysisReportItem => x !== null);

    if (!items.length) throw new Error("DeepSeek 输出 items 为空");

    const seen = new Set<string>();
    for (const it of items) {
      while (seen.has(it.key)) it.key = `${it.key}-dup`;
      seen.add(it.key);
    }

    const scoresRaw = Array.isArray(obj.scores) ? obj.scores : [];
    const byDim = new Map<ScoreDimension, ReportDraftScore>();
    for (const sc of scoresRaw) {
      const r = sc as Record<string, unknown>;
      const dim = asDimension(r.dimension);
      if (!dim || byDim.has(dim)) continue;
      const evidence = Array.isArray(r.evidenceSegmentIds)
        ? (r.evidenceSegmentIds.filter(
            (id) => typeof id === "string" && validSegIds.has(id)
          ) as string[])
        : [];
      byDim.set(dim, {
        dimension: dim,
        aiScore: clampScore(r.aiScore),
        confidence: clampUnit(r.confidence),
        rationale: typeof r.rationale === "string" ? r.rationale : undefined,
        evidenceSegmentIds: evidence
      });
    }

    const scores: ReportDraftScore[] = VALID_DIMENSIONS.map(
      (dim) =>
        byDim.get(dim) ?? {
          dimension: dim,
          aiScore: 5,
          confidence: 0.3,
          rationale: "模型未给出该维度评分，使用占位分。",
          evidenceSegmentIds: []
        }
    );

    return { summary, items, scores };
  }
}
