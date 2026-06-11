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

/** 多视频时聚合姿态指标：次数求和、比率取平均、拳型分布累加。 */
function aggregatePoseMetrics(
  list: PoseMetrics[]
): PoseMetrics | undefined {
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];

  const avg = (key: keyof PoseMetrics): number | undefined => {
    const vals = list
      .map((m) => m[key])
      .filter((v): v is number => typeof v === "number");
    return vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000
      : undefined;
  };
  const sum = (key: keyof PoseMetrics): number =>
    list.reduce((acc, m) => {
      const v = m[key];
      return acc + (typeof v === "number" ? v : 0);
    }, 0);

  const punchTypes: Record<string, number> = {};
  for (const m of list) {
    for (const [k, n] of Object.entries(m.punchTypes ?? {})) {
      punchTypes[k] = (punchTypes[k] ?? 0) + n;
    }
  }

  return {
    punchCount: sum("punchCount"),
    punchesPerMin: avg("punchesPerMin"),
    guardUpRatio: avg("guardUpRatio"),
    stanceWidthRatio: avg("stanceWidthRatio"),
    highActivityRatio: avg("highActivityRatio"),
    detectRate: avg("detectRate"),
    evadeCount: sum("evadeCount"),
    punchTypes: Object.keys(punchTypes).length ? punchTypes : undefined
  };
}

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

  // 报告是 session 级聚合产物：取该训练下所有视频，等所有视频处理完再生成，
  // 避免“谁先 ready 谁先生成只含单视频的半成品报告”。
  const videos = await prisma.video.findMany({
    where: { sessionId, deletedAt: null, objectKey: { not: "" } },
    orderBy: { createdAt: "asc" }
  });

  const pending = videos.filter(
    (v) => v.status === "uploaded" || v.status === "processing"
  );
  if (pending.length > 0) {
    console.log(
      `[ai-worker] session ${sessionId} 仍有 ${pending.length} 个视频处理中，` +
        `暂不生成报告（待最后一个视频 ready 触发，trigger=${videoId}）`
    );
    return;
  }

  const readyVideos = videos.filter((v) => v.status === "ready");
  if (readyVideos.length === 0) {
    console.log(`[ai-worker] session ${sessionId} 无 ready 视频，跳过`);
    return;
  }
  const readyVideoIds = readyVideos.map((v) => v.id);

  // 聚合该 session 下所有 ready 视频的片段（按视频创建序 + 片段起点排序）
  const videoOrder = new Map(readyVideoIds.map((id, i) => [id, i]));
  const segments = (
    await prisma.videoSegment.findMany({
      where: { videoId: { in: readyVideoIds } }
    })
  ).sort((a, b) => {
    const va = videoOrder.get(a.videoId) ?? 0;
    const vb = videoOrder.get(b.videoId) ?? 0;
    return va !== vb ? va - vb : a.startMs - b.startMs;
  });

  // 聚合所有 ready 视频的姿态指标（trigger 视频的指标已落库，统一从 DB 取）
  const allMetrics = readyVideos
    .map((v) => v.poseMetrics as PoseMetrics | null)
    .filter((m): m is PoseMetrics => Boolean(m));
  const aggregatedPose =
    aggregatePoseMetrics(allMetrics) ?? poseMetrics ?? undefined;

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
    poseMetrics: aggregatedPose
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
    `[ai-worker] session ${sessionId} draft 完成（${modelVersion}，` +
      `${readyVideos.length} 个视频，${segments.length} 个片段，` +
      `${output.items.length} 条，${output.scores.length} 维评分）`
  );
}
