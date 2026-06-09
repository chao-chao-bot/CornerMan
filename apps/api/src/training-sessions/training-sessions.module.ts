import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TrainingSessionsService } from "./training-sessions.service";
import { TrainingSessionsController } from "./training-sessions.controller";

/**
 * 训练模块
 * 训练创建、类型、感受、本次重点、状态机。
 */
@Module({
  imports: [AuthModule],
  controllers: [TrainingSessionsController],
  providers: [TrainingSessionsService]
})
export class TrainingSessionsModule {}
