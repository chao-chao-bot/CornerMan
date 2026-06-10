import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

/**
 * 报告模块
 * AI 起草（draft 只读快照）+ 用户定稿（final 可编辑）的组装与读写。
 */
@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
