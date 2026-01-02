-- CreateTable
CREATE TABLE "Merchandise" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER,
    "stock" INTEGER,
    "photoPath" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Merchandise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchandise_productCode_key" ON "Merchandise"("productCode");

-- CreateIndex
CREATE INDEX "Merchandise_isPublished_idx" ON "Merchandise"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");
