/**
 * CornerMan · video-worker
 *
 * 消费 BullMQ `video.process`：
 *   1. 从 MinIO 拉原始视频
 *   2. ffmpeg 转码 720p/360p、首帧封面、每 1s 抽帧
 *   3. 场景切点粗切片，写入候选 VideoSegment
 *   4. 写回 videos.ready，入队 `ai.analyze`（P3 消费）
 */
import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { processVideo } from "./process-video.js";

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

async function shutdown() {
  await worker.close();
  await aiQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
