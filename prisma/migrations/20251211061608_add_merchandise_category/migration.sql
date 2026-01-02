-- AlterTable
ALTER TABLE "Merchandise" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "Merchandise_category_idx" ON "Merchandise"("category");
