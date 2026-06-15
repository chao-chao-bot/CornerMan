import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type TrainingSession } from "@prisma/client";
import type {
  SessionContent,
  SessionContentBlock,
  SessionListItemDTO,
  SessionOutcome,
  SessionReportStatus,
  TemplateSchema,
  TrainingSessionDTO,
  TrainingType
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { VideoQueueService } from "../queue/video-queue.service";
import { TemplatesService } from "../templates/templates.service";
import { CreateTrainingSessionDto } from "./dto/create-training-session.dto";
import { UpdateContentDto } from "./dto/update-content.dto";
import { UpdateSessionMetaDto } from "./dto/update-session-meta.dto";

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: VideoQueueService,
    private readonly templates: TemplatesService
  ) {}

  async create(
    userId: string,
    dto: CreateTrainingSessionDto
  ): Promise<TrainingSessionDTO> {
    let templateSnapshot: TemplateSchema | undefined;
    let content: SessionContent | undefined;
    if (dto.templateId) {
      const template = await this.templates.getVisibleOrThrow(
        userId,
        dto.templateId
      );
      templateSnapshot = template.schema as unknown as TemplateSchema;
      // 草稿确认保存时带 content：在空骨架上覆盖用户填写内容
      const skeleton = this.emptyContent(templateSnapshot);
      content = dto.content
        ? { ...skeleton, ...(dto.content as unknown as SessionContent) }
        : skeleton;
    } else if (dto.content) {
      content = dto.content as unknown as SessionContent;
    }

    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        title: dto.title,
        trainingType: dto.trainingType,
        trainedAt: new Date(dto.trainedAt),
        durationMin: dto.durationMin,
        location: dto.location,
        focus: dto.focus,
        userNote: dto.userNote,
        templateId: dto.templateId,
        templateSnapshot: templateSnapshot
          ? (templateSnapshot as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        content: content
          ? (content as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        outcome: dto.outcome
          ? (dto.outcome as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        savedAt: dto.content ? new Date() : undefined
      }
    });
    return this.toDTO(session);
  }

  /** 按模板 blocks 生成空内容骨架，避免前端面对空对象 */
  private emptyContent(schema: TemplateSchema): SessionContent {
    const content: SessionContent = {};
    for (const block of schema.blocks ?? []) {
      const entry: SessionContentBlock = { type: block.type };
      content[block.id] = entry;
    }
    return content;
  }

  async updateContent(
    userId: string,
    id: string,
    dto: UpdateContentDto
  ): Promise<TrainingSessionDTO> {
    await this.findOne(userId, id); // 归属校验
    const session = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        content: dto.content as unknown as Prisma.InputJsonValue,
        savedAt: new Date()
      }
    });
    return this.toDTO(session);
  }

  async updateMeta(
    userId: string,
    id: string,
    dto: UpdateSessionMetaDto
  ): Promise<TrainingSessionDTO> {
    await this.findOne(userId, id); // 归属校验
    const session = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        title: dto.title,
        trainingType: dto.trainingType,
        trainedAt: dto.trainedAt ? new Date(dto.trainedAt) : undefined,
        durationMin: dto.durationMin,
        location: dto.location,
        focus: dto.focus,
        userNote: dto.userNote,
        ...(dto.outcome
          ? { outcome: dto.outcome as unknown as Prisma.InputJsonValue }
          : {})
      }
    });
    return this.toDTO(session);
  }

  async findAllByUser(userId: string): Promise<SessionListItemDTO[]> {
    const sessions = await this.prisma.trainingSession.findMany({
      // savedAt 为空 = 未确认草稿（懒建用于承载视频），列表不展示
      where: { userId, deletedAt: null, savedAt: { not: null } },
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
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.trainingSession.update({
        where: { id },
        data: { deletedAt: now }
      }),
      // 连带软删该记录的视频（取消草稿时清掉已上传视频）
      this.prisma.video.updateMany({
        where: { sessionId: id, deletedAt: null },
        data: { deletedAt: now }
      })
    ]);
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
      templateId: session.templateId ?? undefined,
      templateSnapshot:
        (session.templateSnapshot as unknown as TemplateSchema) ?? undefined,
      content: (session.content as unknown as SessionContent) ?? undefined,
      outcome: (session.outcome as unknown as SessionOutcome) ?? undefined,
      savedAt: session.savedAt?.toISOString() ?? undefined,
      reviewedAt: session.reviewedAt?.toISOString() ?? undefined,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }
}
