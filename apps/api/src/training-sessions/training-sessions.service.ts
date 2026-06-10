import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type TrainingSession } from "@prisma/client";
import type {
  SessionListItemDTO,
  SessionReportStatus,
  TrainingSessionDTO,
  TrainingType
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { VideoQueueService } from "../queue/video-queue.service";
import { CreateTrainingSessionDto } from "./dto/create-training-session.dto";

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: VideoQueueService
  ) {}

  async create(
    userId: string,
    dto: CreateTrainingSessionDto
  ): Promise<TrainingSessionDTO> {
    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        title: dto.title,
        trainingType: dto.trainingType,
        trainedAt: new Date(dto.trainedAt),
        durationMin: dto.durationMin,
        location: dto.location,
        focus: dto.focus,
        userNote: dto.userNote
      }
    });
    return this.toDTO(session);
  }

  async findAllByUser(userId: string): Promise<SessionListItemDTO[]> {
    const sessions = await this.prisma.trainingSession.findMany({
      where: { userId, deletedAt: null },
      orderBy: { trainedAt: "desc" },
      include: {
        reports: { where: { deletedAt: null }, select: { status: true } },
        scores: {
          where: { dimension: "overall" },
          select: { aiScore: true, userScore: true }
        }
      }
    });

    return sessions.map((s) => {
      // 状态由「是否完成复盘」驱动：归档(reviewedAt)→final；有任何报告→draft(待复盘)；否则 pending(分析中)
      const reportStatus: SessionReportStatus = s.reviewedAt
        ? "final"
        : s.reports.length > 0
          ? "draft"
          : "pending";
      const overall = s.scores[0];
      const aiScore = overall?.aiScore ?? undefined;
      const overallScore = overall?.userScore ?? overall?.aiScore ?? undefined;
      return {
        ...this.toDTO(s),
        reportStatus,
        overallScore,
        aiScore
      };
    });
  }

  async findOne(userId: string, id: string): Promise<TrainingSessionDTO> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id, userId, deletedAt: null }
    });
    if (!session) {
      throw new NotFoundException("训练记录不存在");
    }
    return this.toDTO(session);
  }

  /**
   * 重新分析：软删旧报告（draft + final）、清空复盘归档，重新入队所有视频走姿态分析。
   * 注意：worker 会 deleteMany 重建动作片段（新 segmentId），旧 final 的证据链接会失效，
   * 故旧报告整体作废，由新分析生成全新草稿。
   */
  async reanalyze(userId: string, id: string): Promise<{ id: string; videoCount: number }> {
    await this.findOne(userId, id); // 校验归属

    const videos = await this.prisma.video.findMany({
      where: { sessionId: id, deletedAt: null, objectKey: { not: "" } },
      select: { id: true }
    });
    if (videos.length === 0) {
      throw new NotFoundException("该训练没有可分析的视频");
    }

    const videoIds = videos.map((v) => v.id);
    await this.prisma.$transaction([
      this.prisma.analysisReport.updateMany({
        where: { sessionId: id, deletedAt: null },
        data: { deletedAt: new Date() }
      }),
      this.prisma.trainingSession.update({
        where: { id },
        data: { reviewedAt: null }
      }),
      // 清旧动作片段，避免处理中时间线仍展示作废数据
      this.prisma.videoSegment.deleteMany({
        where: { videoId: { in: videoIds } }
      }),
      this.prisma.video.updateMany({
        where: { sessionId: id, deletedAt: null, objectKey: { not: "" } },
        // 同时清空姿态指标（含 punchEvents），处理中三轨一致为空
        data: {
          status: "processing",
          errorMessage: null,
          poseMetrics: Prisma.JsonNull
        }
      })
    ]);

    await Promise.all(videos.map((v) => this.queue.enqueueProcess(v.id)));

    return { id, videoCount: videos.length };
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id, userId, deletedAt: null }
    });
    if (!session) {
      throw new NotFoundException("训练记录不存在");
    }
    await this.prisma.trainingSession.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return { id };
  }

  private toDTO(session: TrainingSession): TrainingSessionDTO {
    return {
      id: session.id,
      title: session.title,
      trainingType: session.trainingType as TrainingType,
      trainedAt: session.trainedAt.toISOString(),
      durationMin: session.durationMin ?? undefined,
      location: session.location ?? undefined,
      focus: session.focus ?? undefined,
      userNote: session.userNote ?? undefined,
      reviewedAt: session.reviewedAt?.toISOString() ?? undefined,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }
}
