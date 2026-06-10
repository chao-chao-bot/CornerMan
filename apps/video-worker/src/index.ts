/**
 * CornerMan · video-worker
 *
 * 消费 BullMQ `video.process`：
 *   1. 从 MinIO 拉原始视频
 *   2. ffmpeg 转码 720p/360p、首帧封面、每 1s 抽帧
 *   3. ai-service 姿态分析 → 动作驱动切片（失败回退场景切点/固定窗口）
 *   4. 写回 videos.ready，入队 `ai.analyze`（带姿态指标，P3 消费）
 */
import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import type { PoseMetrics } from "@cornerman/shared-types";
import { processVideo } from "./process-video.js";
import { analyzeSession } from "./analyze.js";

const connection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
};

const prisma = new PrismaClient();
const aiQueue = new Queue("ai.analyze", { connection });

const worker = new Worker<{ videoId: string }>(
  "video.process",
  async (job) => {
    console.log(`[video-worker] 开始处理 ${job.data.videoId}`);
    await processVideo(prisma, aiQueue, job.data.videoId);
  },
  { connection, concurrency: 2 }
);

worker.on("ready", () =>
  console.log("[video-worker] ready, listening video.process")
);
worker.on("failed", async (job, err) => {
  console.error(`[video-worker] job ${job?.id} failed`, err.message);
  if (job?.data.videoId && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.video
      .update({
        where: { id: job.data.videoId },
        data: { status: "failed", errorMessage: err.message.slice(0, 500) }
      })
      .catch(() => undefined);
  }
});

const aiWorker = new Worker<{
  videoId: string;
  sessionId: string;
  poseMetrics?: PoseMetrics;
}>(
  "ai.analyze",
  async (job) => {
    console.log(`[ai-worker] 开始分析 session ${job.data.sessionId}`);
    await analyzeSession(
      prisma,
      job.data.videoId,
      job.data.sessionId,
      job.data.poseMetrics
    );
  },
  { connection, concurrency: 1 }
);

aiWorker.on("ready", () =>
  console.log("[ai-worker] ready, listening ai.analyze")
);
aiWorker.on("failed", (job, err) =>
  console.error(`[ai-worker] job ${job?.id} failed`, err.message)
);

async function shutdown() {
  await worker.close();
  await aiWorker.close();
  await aiQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
