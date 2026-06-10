-- 姿态分析指标落库：视频全局指标 + 片段级指标
ALTER TABLE "Video" ADD COLUMN "poseMetrics" JSONB;
ALTER TABLE "VideoSegment" ADD COLUMN "metrics" JSONB;
