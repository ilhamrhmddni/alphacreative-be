/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Peserta` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[noPeserta]` on the table `Peserta` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Juara" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Peserta" ADD COLUMN     "noPeserta" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateTable
CREATE TABLE "Score" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "pesertaId" INTEGER NOT NULL,
    "juriId" INTEGER NOT NULL,
    "nilai" INTEGER NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Score_eventId_pesertaId_juriId_key" ON "Score"("eventId", "pesertaId", "juriId");

-- CreateIndex
CREATE UNIQUE INDEX "Peserta_userId_key" ON "Peserta"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Peserta_noPeserta_key" ON "Peserta"("noPeserta");

-- AddForeignKey
ALTER TABLE "Juara" ADD CONSTRAINT "Juara_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_juriId_fkey" FOREIGN KEY ("juriId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
