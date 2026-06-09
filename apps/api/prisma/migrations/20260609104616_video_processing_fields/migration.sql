-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "framesPrefix" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "playback360Key" TEXT,
ADD COLUMN     "playback720Key" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;
