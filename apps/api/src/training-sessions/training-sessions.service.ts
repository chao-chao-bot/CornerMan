import { Injectable, NotFoundException } from "@nestjs/common";
import type { TrainingSession } from "@prisma/client";
import type { TrainingSessionDTO, TrainingType } from "@cornerman/shared-types";
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
        userNote: dto.userNote
      }
    });
    return this.toDTO(session);
  }

  async findAllByUser(userId: string): Promise<TrainingSessionDTO[]> {
    const sessions = await this.prisma.trainingSession.findMany({
      where: { userId, deletedAt: null },
      orderBy: { trainedAt: "desc" }
    });
    return sessions.map((s) => this.toDTO(s));
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

  private toDTO(session: TrainingSession): TrainingSessionDTO {
    return {
      id: session.id,
      title: session.title,
      trainingType: session.trainingType as TrainingType,
      trainedAt: session.trainedAt.toISOString(),
      userNote: session.userNote ?? undefined,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }
}
