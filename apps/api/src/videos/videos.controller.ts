import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type {
  InitVideoUploadResponse,
  VideoDTO
} from "@cornerman/shared-types";
import { JwtAuthGuard, type AuthUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { VideosService } from "./videos.service";
import { InitVideoUploadDto } from "./dto/init-video-upload.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post("training-sessions/:sessionId/videos/upload-init")
  initUpload(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: InitVideoUploadDto
  ): Promise<InitVideoUploadResponse> {
    return this.videos.initUpload(user.userId, sessionId, dto);
  }

  @Get("training-sessions/:sessionId/videos")
  list(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string
  ): Promise<VideoDTO[]> {
    return this.videos.listBySession(user.userId, sessionId);
  }

  @Post("videos/:id/upload-complete")
  complete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<VideoDTO> {
    return this.videos.completeUpload(user.userId, id);
  }

  @Get("videos/:id")
  detail(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ): Promise<VideoDTO> {
    return this.videos.getOne(user.userId, id);
  }
}
