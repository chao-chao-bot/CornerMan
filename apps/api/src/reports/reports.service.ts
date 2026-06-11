import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type {
  AnalysisReport,
  ReportRevision,
  Score
} from "@prisma/client";
import type {
  AnalysisReportItem,
  ReportCoverage,
  ReportDTO,
  RevisionDTO,
  ScoreDTO,
  ScoreDimension,
  SessionReportDTO
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionReport(
    userId: string,
    sessionId: string
  ): Promise<SessionReportDTO> {
    await this.assertSessionOwner(userId, sessionId);

    const [reports, scores, readyVideos] = await Promise.all([
      this.prisma.analysisReport.findMany({
        where: { sessionId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { revisions: { orderBy: { createdAt: "asc" } } }
      }),
      this.prisma.score.findMany({ where: { sessionId } }),
      this.prisma.video.findMany({
        where: {
          sessionId,
          deletedAt: null,
          status: "ready",
          objectKey: { not: "" }
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          segments: { select: { id: true } }
        }
      })
    ]);

    const draft = reports.find((r) => r.status === "draft") ?? null;
    const final = reports.find((r) => r.status === "final") ?? null;
    const revisions = final?.revisions ?? [];

    return {
      draft: draft ? this.toReportDTO(draft) : null,
      final: final ? this.toReportDTO(final) : null,
      scores: this.sortScores(scores).map((s) => this.toScoreDTO(s)),
      revisions: revisions.map((r) => this.toRevisionDTO(r)),
      coverage: this.computeCoverage(
        readyVideos,
        draft,
        final,
        scores
      )
    };
  }

  /**
   * 计算报告覆盖范围：报告是 session 级聚合产物，补传视频可能尚未纳入。
   * 判定「已纳入」：
   *   1. 视频有【当前存在的】片段被报告条目或评分证据引用；或
   *   2. 报告未失效（!staleEvidence）且视频在报告生成前已存在（被聚合分析过，
   *      只是 LLM 未逐一引用）。
   * 视频被重新处理后片段 id 变化会让旧引用悬空 → staleEvidence=true，
   * 此时禁用按时间的兜底纳入，确保失效视频落到未纳入并提示重新生成。
   */
  private computeCoverage(
    readyVideos: {
      id: string;
      createdAt: Date;
      segments: { id: string }[];
    }[],
    draft: AnalysisReport | null,
    final: AnalysisReport | null,
    scores: Score[]
  ): ReportCoverage {
    const active = final ?? draft;
    // 草稿生成时刻代表 AI 实际聚合了哪些视频，作为时间兜底的基准
    const referenceTime = (draft ?? final)?.createdAt ?? null;

    const referencedSegmentIds = new Set<string>();
    const collect = (report: AnalysisReport | null) => {
      if (!report) return;
      const items =
        (report.items as unknown as AnalysisReportItem[] | null) ?? [];
      for (const item of items) {
        if (item.segmentId) referencedSegmentIds.add(item.segmentId);
      }
    };
    collect(draft);
    collect(final);
    for (const sc of scores) {
      for (const id of sc.evidenceSegmentIds ?? []) {
        referencedSegmentIds.add(id);
      }
    }

    // 当前实际存在的片段 id 集合（跨所有 ready 视频）
    const currentSegmentIds = new Set<string>();
    for (const video of readyVideos) {
      for (const s of video.segments) currentSegmentIds.add(s.id);
    }

    // 报告引用了已不存在的片段（视频重新处理后片段 id 变化）→ 证据悬空
    const staleEvidence = active
      ? [...referencedSegmentIds].some((id) => !currentSegmentIds.has(id))
      : false;

    const unincludedVideoIds: string[] = [];
    let includedVideoCount = 0;
    for (const video of readyVideos) {
      if (!active) continue;
      const includedByReference = video.segments.some((s) =>
        referencedSegmentIds.has(s.id)
      );
      const includedByTime =
        !staleEvidence &&
        referenceTime !== null &&
        video.createdAt <= referenceTime;
      if (includedByReference || includedByTime) includedVideoCount += 1;
      else unincludedVideoIds.push(video.id);
    }

    return {
      readyVideoCount: readyVideos.length,
      includedVideoCount,
      unincludedVideoIds,
      reportUpdatedAt: active ? active.updatedAt.toISOString() : null,
      staleEvidence
    };
  }

  /** 懒定稿：无 final 则把 draft 克隆为 final 返回；已存在直接返回 */
  async finalize(userId: string, sessionId: string): Promise<AnalysisReport> {
    await this.assertSessionOwner(userId, sessionId);

    const existingFinal = await this.prisma.analysisReport.findFirst({
      where: { sessionId, status: "final", deletedAt: null }
    });
    if (existingFinal) return existingFinal;

    const draft = await this.prisma.analysisReport.findFirst({
      where: { sessionId, status: "draft", deletedAt: null }
    });
    if (!draft) {
      throw new NotFoundException("尚无 AI 草稿，无法定稿");
    }

    return this.prisma.analysisReport.create({
      data: {
        sessionId,
        status: "final",
        summary: draft.summary,
        items: draft.items as object,
        modelVersion: draft.modelVersion,
        promptVersion: draft.promptVersion
      }
    });
  }

  /** 完成复盘：确保 final 存在并标记 session.reviewedAt（归档到列表「已复盘」） */
  async complete(userId: string, sessionId: string): Promise<AnalysisReport> {
    const final = await this.finalize(userId, sessionId);
    await this.prisma.trainingSession.update({
      where: { id: sessionId },
      data: { reviewedAt: new Date() }
    });
    return final;
  }

  async assertSessionOwner(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { userId: true }
    });
    if (!session) throw new NotFoundException("训练记录不存在");
    if (session.userId !== userId) {
      throw new ForbiddenException("无权访问该训练记录");
    }
  }

  toReportDTO(report: AnalysisReport): ReportDTO {
    return {
      id: report.id,
      sessionId: report.sessionId,
      status: report.status as ReportDTO["status"],
      summary: report.summary,
      items: (report.items as unknown as AnalysisReportItem[]) ?? [],
      modelVersion: report.modelVersion ?? undefined,
      promptVersion: report.promptVersion ?? undefined,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    };
  }

  toScoreDTO(score: Score): ScoreDTO {
    return {
      dimension: score.dimension as ScoreDimension,
      aiScore: score.aiScore ?? undefined,
      userScore: score.userScore ?? undefined,
      confidence: score.confidence ?? undefined,
      rationale: score.rationale ?? undefined,
      evidenceSegmentIds: score.evidenceSegmentIds ?? []
    };
  }

  toRevisionDTO(rev: ReportRevision): RevisionDTO {
    return {
      id: rev.id,
      reportId: rev.reportId,
      itemKey: rev.itemKey,
      action: rev.action as RevisionDTO["action"],
      aiOriginal: rev.aiOriginal ?? undefined,
      userResult: rev.userResult ?? undefined,
      createdAt: rev.createdAt.toISOString()
    };
  }

  private sortScores(scores: Score[]): Score[] {
    const order: ScoreDimension[] = [
      "stance",
      "guard",
      "footwork",
      "punch_technique",
      "defense",
      "combination",
      "overall"
    ];
    return [...scores].sort(
      (a, b) =>
        order.indexOf(a.dimension as ScoreDimension) -
        order.indexOf(b.dimension as ScoreDimension)
    );
  }
}
