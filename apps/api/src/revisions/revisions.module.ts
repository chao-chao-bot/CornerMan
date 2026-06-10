import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReportsModule } from "../reports/reports.module";
import { RevisionsService } from "./revisions.service";
import { RevisionsController } from "./revisions.controller";

/**
 * 修订模块
 * 用户对 final 报告的逐条采纳 / 修改 / 删除 / 新增，永不覆盖 AI 原文。
 */
@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [RevisionsController],
  providers: [RevisionsService]
})
export class RevisionsModule {}
