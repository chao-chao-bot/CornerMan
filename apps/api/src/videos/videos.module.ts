import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VideosService } from "./videos.service";
import { VideosController } from "./videos.controller";

/**
 * 视频模块
 * 上传凭证（MinIO/OSS 预签名）签发、上传完成回调、转码状态、片段查询。
 * Storage 与 Queue 由全局模块提供。
 */
@Module({
  imports: [AuthModule],
  controllers: [VideosController],
  providers: [VideosService]
})
export class VideosModule {}
