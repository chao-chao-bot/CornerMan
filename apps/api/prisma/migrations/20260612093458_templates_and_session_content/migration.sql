-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "content" JSONB,
ADD COLUMN     "outcome" JSONB,
ADD COLUMN     "savedAt" TIMESTAMP(3),
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateSnapshot" JSONB;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_userId_idx" ON "Template"("userId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
