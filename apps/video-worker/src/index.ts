/**
 * CornerMan · video-worker（占位）
 *
 * 消费 BullMQ `video.process` 队列：
 *   1. 拉取 OSS 原始视频
 *   2. ffmpeg 转码 720p/360p、首帧封面、每 1s 抽帧
 *   3. 粗切片，产出候选 VideoSegment
 *   4. 写回 videos.processed 状态，触发 ai.analyze 任务
 *
 * 本文件为骨架：仅声明 Worker，处理逻辑后续补全。
 */
import { Worker } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
};

const worker = new Worker(
  "video.process",
  async (job) => {
    // TODO: 实现转码 / 抽帧 / 粗切片 / 入队 ai.analyze
    console.log(`[video-worker] received job ${job.id}`, job.data);
  },
  { connection }
);

worker.on("ready", () => console.log("[video-worker] ready, listening video.process"));
worker.on("failed", (job, err) => console.error(`[video-worker] job ${job?.id} failed`, err));
