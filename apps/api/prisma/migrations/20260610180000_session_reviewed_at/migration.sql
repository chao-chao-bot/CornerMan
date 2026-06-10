-- 复盘归档时间：用户显式「完成复盘」后写入，驱动列表「已复盘」状态
ALTER TABLE "TrainingSession" ADD COLUMN "reviewedAt" TIMESTAMP(3);
