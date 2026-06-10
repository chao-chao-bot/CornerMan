import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import type { SessionReportDTO } from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RevisionsService } from "./revisions.service";
import { CreateRevisionDto } from "./dto/create-revision.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class RevisionsController {
  constructor(private readonly revisions: RevisionsService) {}

  @Post("reports/:reportId/revisions")
  create(
    @CurrentUser() user: AuthUser,
    @Param("reportId") reportId: string,
    @Body() dto: CreateRevisionDto
  ): Promise<SessionReportDTO> {
    return this.revisions.createRevision(user.userId, reportId, dto);
  }
}
