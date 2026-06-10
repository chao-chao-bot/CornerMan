import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { ReportDTO, SessionReportDTO } from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ReportsService } from "./reports.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("training-sessions/:sessionId/report")
  getReport(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string
  ): Promise<SessionReportDTO> {
    return this.reports.getSessionReport(user.userId, sessionId);
  }

  @Post("training-sessions/:sessionId/report/finalize")
  async finalize(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string
  ): Promise<ReportDTO> {
    const report = await this.reports.finalize(user.userId, sessionId);
    return this.reports.toReportDTO(report);
  }
}
