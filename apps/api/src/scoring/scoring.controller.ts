import { Body, Controller, Param, Patch, UseGuards } from "@nestjs/common";
import type { ScoreDTO } from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ScoringService } from "./scoring.service";
import { UpdateScoreDto } from "./dto/update-score.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Patch("training-sessions/:sessionId/scores/:dimension")
  update(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Param("dimension") dimension: string,
    @Body() dto: UpdateScoreDto
  ): Promise<ScoreDTO> {
    return this.scoring.updateUserScore(
      user.userId,
      sessionId,
      dimension,
      dto.userScore
    );
  }
}
