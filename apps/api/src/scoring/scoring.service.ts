import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { ScoreDTO, ScoreDimension } from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";

const DIMENSIONS: ScoreDimension[] = [
  "stance",
  "guard",
  "footwork",
  "punch_technique",
  "defense",
  "combination",
  "overall"
];

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUserScore(
    userId: string,
    sessionId: string,
    dimension: string,
    userScore: number
  ): Promise<ScoreDTO> {
    await this.assertSessionOwner(userId, sessionId);

    if (!DIMENSIONS.includes(dimension as ScoreDimension)) {
      throw new BadRequestException("非法的评分维度");
    }

    const score = await this.prisma.score.upsert({
      where: { sessionId_dimension: { sessionId, dimension } },
      create: { sessionId, dimension, userScore, evidenceSegmentIds: [] },
      update: { userScore }
    });

    return {
      dimension: score.dimension as ScoreDimension,
      aiScore: score.aiScore ?? undefined,
      userScore: score.userScore ?? undefined,
      confidence: score.confidence ?? undefined,
      rationale: score.rationale ?? undefined,
      evidenceSegmentIds: score.evidenceSegmentIds ?? []
    };
  }

  private async assertSessionOwner(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { userId: true }
    });
    if (!session) throw new NotFoundException("训练记录不存在");
    if (session.userId !== userId) {
      throw new ForbiddenException("无权访问该训练记录");
    }
  }
}
