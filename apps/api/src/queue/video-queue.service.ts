import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit
} from "@nestjs/common";
import { Queue } from "bullmq";

export const VIDEO_PROCESS_QUEUE = "video.process";

export interface VideoProcessJob {
  videoId: string;
}

/**
 * 视频处理队列生产者。
 * 直接用 bullmq Queue（不引入 @nestjs/bullmq），队列名与 video-worker 消费端一致。
 */
@Injectable()
export class VideoQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoQueueService.name);
  private queue!: Queue<VideoProcessJob>;

  onModuleInit(): void {
    this.queue = new Queue<VideoProcessJob>(VIDEO_PROCESS_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? "127.0.0.1",
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async enqueueProcess(videoId: string): Promise<void> {
    // 不固定 jobId：固定 jobId + removeOnComplete 会让「重新分析」再次入队时
    // 因同名 completed 任务仍在而被 BullMQ 静默忽略，导致永远卡 processing。
    await this.queue.add(
      "process",
      { videoId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );
    this.logger.log(`已入队 video.process：${videoId}`);
  }
}
