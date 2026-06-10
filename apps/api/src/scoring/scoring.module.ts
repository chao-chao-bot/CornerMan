import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ScoringService } from "./scoring.service";
import { ScoringController } from "./scoring.controller";

/**
 * 评分模块
 * 7 维评分：AI 给出初始分 + 置信度，用户可逐维覆盖 userScore。
 */
@Module({
  imports: [AuthModule],
  controllers: [ScoringController],
  providers: [ScoringService]
})
export class ScoringModule {}
