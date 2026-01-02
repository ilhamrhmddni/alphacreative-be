-- AlterTable
ALTER TABLE "Score" ADD COLUMN "useManualNilai" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing manual scores
UPDATE "Score"
SET "useManualNilai" = true
WHERE "nilai" IS NOT NULL;
