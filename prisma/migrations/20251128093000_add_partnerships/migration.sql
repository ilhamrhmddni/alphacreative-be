-- CreateTable
CREATE TABLE "Partnership" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "logoPath" TEXT,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);

-- Indexes to speed up public landing queries
CREATE INDEX "Partnership_type_idx" ON "Partnership"("type");
CREATE INDEX "Partnership_isPublished_idx" ON "Partnership"("isPublished");
