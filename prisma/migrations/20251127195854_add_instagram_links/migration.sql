-- CreateTable
CREATE TABLE "InstagramLink" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER,
    "postedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "InstagramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramLink_isActive_postedAt_idx" ON "InstagramLink"("isActive", "postedAt");

-- CreateIndex
CREATE INDEX "InstagramLink_sortOrder_postedAt_idx" ON "InstagramLink"("sortOrder", "postedAt");
