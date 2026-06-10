import { Injectable, NotFoundException } from "@nestjs/common";
import type { TrainingSession } from "@prisma/client";
import type {
  SessionListItemDTO,
  SessionReportStatus,
  TrainingSessionDTO,
  TrainingType
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTrainingSessionDto } from "./dto/create-training-session.dto";

@Injectable()
export class TrainingSessionsService {
  constructor(private readonly prisma: PrismaService) {}

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
      const statuses = s.reports.map((r) => r.status);
      const reportStatus: SessionReportStatus = statuses.includes("final")
        ? "final"
        : statuses.includes("draft")
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
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }
}
