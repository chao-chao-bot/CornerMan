import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import {
  detectSceneCuts,
  extractFrames,
  poster,
  probe,
  transcode
} from "./ffmpeg.js";
import { buildCandidateSegments } from "./segments.js";
import { analyzeVideoPose } from "./pose-client.js";
import { downloadObject, presignGetUrl, uploadFile } from "./storage.js";

/** 由 original 对象 key 推出同目录下的派生对象 key */
function deriveKey(objectKey: string, name: string): string {
  const dir = objectKey.slice(0, objectKey.lastIndexOf("/"));
  return `${dir}/${name}`;
}

export async function processVideo(
  prisma: PrismaClient,
  aiQueue: Queue,
  videoId: string
): Promise<void> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) throw new Error(`视频不存在：${videoId}`);
  if (!video.objectKey) throw new Error(`视频缺少 objectKey：${videoId}`);

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "processing", errorMessage: null }
  });

  const workDir = join(tmpdir(), "cornerman", videoId);
  const framesDir = join(workDir, "frames");
  await mkdir(framesDir, { recursive: true });

  try {
    const originalPath = join(workDir, "original");
    await downloadObject(video.objectKey, originalPath);

    const meta = await probe(originalPath);

    const path720 = join(workDir, "720.mp4");
    const path360 = join(workDir, "360.mp4");
    const posterPath = join(workDir, "poster.jpg");
    await transcode(originalPath, path720, 720);
    await transcode(originalPath, path360, 360);
    await poster(originalPath, posterPath);
    await extractFrames(originalPath, join(framesDir, "%04d.jpg"));

    const key720 = deriveKey(video.objectKey, "720.mp4");
    const key360 = deriveKey(video.objectKey, "360.mp4");
    const posterKey = deriveKey(video.objectKey, "poster.jpg");
    const framesPrefix = `${video.objectKey.slice(0, video.objectKey.lastIndexOf("/"))}/frames/`;

    await uploadFile(path720, key720, "video/mp4");
    await uploadFile(path360, key360, "video/mp4");
    await uploadFile(posterPath, posterKey, "image/jpeg");

    const frameFiles = (await readdir(framesDir)).filter((f) =>
      f.endsWith(".jpg")
    );
    for (const f of frameFiles) {
      await uploadFile(join(framesDir, f), `${framesPrefix}${f}`, "image/jpeg");
    }

    // 优先动作驱动切片（ai-service 姿态分析 360p）；失败/降级回退机械切片
    const signedUrl360 = await presignGetUrl(key360, 3600);
    const pose = await analyzeVideoPose(
      video.sessionId,
      signedUrl360,
      meta.durationMs
    );

    const segmentRows = pose
      ? pose.segments.map((s) => ({
          videoId,
          startMs: s.startMs,
          endMs: s.endMs,
          tags: s.tags,
          problemCodes: [],
          aiConfidence: s.confidence,
          metrics: (s.metrics ?? undefined) as object | undefined
        }))
      : buildCandidateSegments(
          meta.durationMs,
          await detectSceneCuts(originalPath)
        ).map((c) => ({
          videoId,
          startMs: c.startMs,
          endMs: c.endMs,
          tags: ["candidate"],
          problemCodes: [],
          aiConfidence: 0.5
        }));

    await prisma.$transaction([
      prisma.videoSegment.deleteMany({ where: { videoId } }),
      prisma.videoSegment.createMany({ data: segmentRows }),
      prisma.video.update({
        where: { id: videoId },
        data: {
          status: "ready",
          durationMs: meta.durationMs,
          width: meta.width,
          height: meta.height,
          posterObjectKey: posterKey,
          playback720Key: key720,
          playback360Key: key360,
          framesPrefix,
          poseMetrics: pose ? (pose.metrics as object) : undefined
        }
      })
    ]);

    await aiQueue.add(
      "analyze",
      {
        videoId,
        sessionId: video.sessionId,
        poseMetrics: pose?.metrics
      },
      { jobId: videoId, removeOnComplete: 100, removeOnFail: 100 }
    );

    console.log(
      `[video-worker] ${videoId} ready：${segmentRows.length} 个片段（${pose ? "姿态分析" : "机械切片"}），${frameFiles.length} 帧`
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
