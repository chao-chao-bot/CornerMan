-- AlterTable
ALTER TABLE "AnalysisReport" ADD COLUMN     "promptVersion" TEXT;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "evidenceSegmentIds" TEXT[],
ADD COLUMN     "rationale" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Score_sessionId_dimension_key" ON "Score"("sessionId", "dimension");
