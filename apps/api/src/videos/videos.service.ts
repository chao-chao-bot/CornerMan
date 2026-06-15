import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Video, VideoSegment } from "@prisma/client";
import type {
  InitVideoUploadResponse,
  VideoDTO,
  VideoSegmentDTO,
  VideoStatus
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { VideoQueueService } from "../queue/video-queue.service";
import { InitVideoUploadDto } from "./dto/init-video-upload.dto";

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm"
]);
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: VideoQueueService
  ) {}

  async initUpload(
    userId: string,
    sessionId: string,
    dto: InitVideoUploadDto
  ): Promise<InitVideoUploadResponse> {
    await this.assertSessionOwner(userId, sessionId);

    if (!ALLOWED_CONTENT_TYPES.has(dto.contentType)) {
      throw new BadRequestException("不支持的视频格式");
    }
    if (dto.sizeBytes <= 0 || dto.sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException("视频大小超出允许范围");
    }

    const ext = extensionFor(dto.fileName, dto.contentType);
    const video = await this.prisma.video.create({
      data: {
        sessionId,
        status: "uploading",
        objectKey: "", // 占位，下面用 id 拼出后回写
        originalFileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes
      }
    });

    const objectKey = `users/${userId}/sessions/${sessionId}/${video.id}/original.${ext}`;
    await this.prisma.video.update({
      where: { id: video.id },
      data: { objectKey }
    });

    const presigned = await this.storage.presignPut(objectKey, dto.contentType);

    return {
      videoId: video.id,
      objectKey,
      uploadUrl: presigned.url,
      uploadHeaders: presigned.headers,
      expiresIn: presigned.expiresIn
    };
  }

  async completeUpload(userId: string, videoId: string): Promise<VideoDTO> {
    const video = await this.getOwnedVideo(userId, videoId);
    if (video.status !== "uploading") {
      throw new BadRequestException("视频状态不允许该操作");
    }
    const updated = await this.prisma.video.update({
      where: { id: video.id },
      data: { status: "uploaded" }
    });
    await this.queue.enqueueProcess(video.id);
    return this.toDTO(updated, []);
  }

  async listBySession(userId: string, sessionId: string): Promise<VideoDTO[]> {
    await this.assertSessionOwner(userId, sessionId);
    const videos = await this.prisma.video.findMany({
      where: { sessionId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { segments: true } } }
    });
    return Promise.all(
      videos.map((v) =>
        this.toDTO(v, [], { segmentCount: v._count.segments })
      )
    );
  }

  async getOne(userId: string, videoId: string): Promise<VideoDTO> {
    const video = await this.getOwnedVideo(userId, videoId);
    const segments = await this.prisma.videoSegment.findMany({
      where: { videoId },
      orderBy: { startMs: "asc" }
    });
    return this.toDTO(video, segments);
  }

  async remove(userId: string, videoId: string): Promise<{ id: string }> {
    const video = await this.getOwnedVideo(userId, videoId);
    await this.prisma.video.update({
      where: { id: video.id },
      data: { deletedAt: new Date() }
    });
    return { id: video.id };
  }

  private async getOwnedVideo(userId: string, videoId: string): Promise<Video> {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, deletedAt: null }
    });
    if (!video) {
      throw new NotFoundException("视频不存在");
    }
    await this.assertSessionOwner(userId, video.sessionId);
    return video;
  }

  private async assertSessionOwner(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { userId: true }
    });
    if (!session) {
      throw new NotFoundException("训练记录不存在");
    }
    if (session.userId !== userId) {
      throw new ForbiddenException("无权访问该训练记录");
    }
  }

  private async toDTO(
    video: Video,
    segments: VideoSegment[],
    opts?: { segmentCount?: number }
  ): Promise<VideoDTO> {
    const isReady = video.status === "ready";
    const posterUrl =
      isReady && video.posterObjectKey
        ? await this.storage.presignGet(video.posterObjectKey)
        : undefined;
    const playbackUrl =
      isReady && video.playback720Key
        ? await this.storage.presignGet(video.playback720Key)
        : undefined;

    return {
      id: video.id,
      sessionId: video.sessionId,
      status: video.status as VideoStatus,
      originalFileName: video.originalFileName ?? undefined,
      durationMs: video.durationMs ?? undefined,
      width: video.width ?? undefined,
      height: video.height ?? undefined,
      errorMessage: video.errorMessage ?? undefined,
      posterUrl,
      playbackUrl,
      segmentCount: opts?.segmentCount ?? segments.length,
      segments: segments.length
        ? segments.map((s): VideoSegmentDTO => ({
            id: s.id,
            videoId: s.videoId,
            startMs: s.startMs,
            endMs: s.endMs,
            tags: s.tags,
            aiConfidence: s.aiConfidence ?? undefined,
            metrics: (s.metrics ?? undefined) as VideoSegmentDTO["metrics"]
          }))
        : undefined,
      poseMetrics: (video.poseMetrics ?? undefined) as VideoDTO["poseMetrics"],
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString()
    };
  }
}

function extensionFor(fileName: string, contentType: string): string {
  const fromName = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase()
    : "";
  if (fromName) return fromName.replace(/[^a-z0-9]/g, "") || "mp4";
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/webm": "webm"
  };
  return map[contentType] ?? "mp4";
}
