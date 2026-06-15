import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TemplatesService } from "./templates.service";
import { TemplatesController } from "./templates.controller";

/**
 * 模板模块
 * 系统模板 + 个人自定义模板的读取、创建、更新、软删、复制。
 */
@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService]
})
export class TemplatesModule {}
