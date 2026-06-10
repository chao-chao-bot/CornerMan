import { REPORT_PROMPT_VERSION } from "@cornerman/ai-prompts";
import type {
  PoseMetrics,
  ReportDraftInput,
  ReportDraftOutput,
  SegmentMetrics,
  TrainingType
} from "@cornerman/shared-types";
import type { PrismaClient } from "@prisma/client";
import { createLLMProvider, StubProvider, type LLMProvider } from "./llm/index.js";

const provider: LLMProvider = createLLMProvider();
const stubFallback = new StubProvider();

export async function analyzeSession(
  prisma: PrismaClient,
  videoId: string,
  sessionId: string,
  // process-video 阶段 ai-service 姿态分析的汇总指标（经 job payload 透传）
  poseMetrics?: PoseMetrics
): Promise<void> {
  // 幂等：该 session 已有 draft 则跳过，避免覆盖用户可能已定稿的内容
  const existingDraft = await prisma.analysisReport.findFirst({
    where: { sessionId, status: "draft", deletedAt: null }
  });
  if (existingDraft) {
    console.log(`[ai-worker] session ${sessionId} 已有 draft，跳过`);
    return;
  }

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId }
  });
  if (!session) throw new Error(`训练记录不存在：${sessionId}`);

  const segments = await prisma.videoSegment.findMany({
    where: { videoId },
    orderBy: { startMs: "asc" }
  });

  const input: ReportDraftInput = {
    trainingType: session.trainingType as TrainingType,
    userNote: session.userNote ?? undefined,
    segments: segments.map((s) => ({
      id: s.id,
      startMs: s.startMs,
      endMs: s.endMs,
      tags: s.tags,
      metrics: (s.metrics ?? undefined) as SegmentMetrics | undefined
    })),
    poseMetrics
  };

  let output: ReportDraftOutput;
  let modelVersion: string;
  try {
    output = await provider.draftReport(input);
    modelVersion = provider.name;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ai-worker] provider ${provider.name} 失败，降级 stub：${msg}`);
    output = await stubFallback.draftReport(input);
    modelVersion = `${stubFallback.name} (fallback from ${provider.name})`;
  }

  await prisma.$transaction(async (tx) => {
    // 二次幂等检查（事务内），防并发重复写
    const dup = await tx.analysisReport.findFirst({
      where: { sessionId, status: "draft", deletedAt: null }
    });
    if (dup) return;

    await tx.analysisReport.create({
      data: {
        sessionId,
        status: "draft",
        summary: output.summary,
        items: output.items as unknown as object,
        modelVersion,
        promptVersion: REPORT_PROMPT_VERSION
      }
    });

    for (const sc of output.scores) {
      await tx.score.upsert({
        where: {
          sessionId_dimension: { sessionId, dimension: sc.dimension }
        },
        create: {
          sessionId,
          dimension: sc.dimension,
          aiScore: sc.aiScore,
          confidence: sc.confidence,
          rationale: sc.rationale,
          evidenceSegmentIds: sc.evidenceSegmentIds ?? []
        },
        update: {
          aiScore: sc.aiScore,
          confidence: sc.confidence,
          rationale: sc.rationale,
          evidenceSegmentIds: sc.evidenceSegmentIds ?? []
        }
      });
    }
  });

  console.log(
    `[ai-worker] session ${sessionId} draft 完成（${modelVersion}，${output.items.length} 条，${output.scores.length} 维评分）`
  );
}
