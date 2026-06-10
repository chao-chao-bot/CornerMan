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

    const [reports, scores] = await Promise.all([
      this.prisma.analysisReport.findMany({
        where: { sessionId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { revisions: { orderBy: { createdAt: "asc" } } }
      }),
      this.prisma.score.findMany({ where: { sessionId } })
    ]);

    const draft = reports.find((r) => r.status === "draft") ?? null;
    const final = reports.find((r) => r.status === "final") ?? null;
    const revisions = final?.revisions ?? [];

    return {
      draft: draft ? this.toReportDTO(draft) : null,
      final: final ? this.toReportDTO(final) : null,
      scores: this.sortScores(scores).map((s) => this.toScoreDTO(s)),
      revisions: revisions.map((r) => this.toRevisionDTO(r))
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
