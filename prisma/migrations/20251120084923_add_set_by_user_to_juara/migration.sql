/*
  Warnings:

  - You are about to drop the column `userId` on the `Juara` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pesertaId]` on the table `Partisipasi` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,eventId]` on the table `Peserta` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "DetailPeserta" DROP CONSTRAINT "DetailPeserta_pesertaId_fkey";

-- DropForeignKey
ALTER TABLE "Juara" DROP CONSTRAINT "Juara_userId_fkey";

-- DropIndex
DROP INDEX "Peserta_noPeserta_key";

-- DropIndex
DROP INDEX "Peserta_userId_key";

-- AlterTable
ALTER TABLE "Berita" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DetailPeserta" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Juara" DROP COLUMN "userId",
ADD COLUMN     "setByUserId" INTEGER,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Partisipasi" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Peserta" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Score" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ScoreDetail" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Partisipasi_pesertaId_key" ON "Partisipasi"("pesertaId");

-- CreateIndex
CREATE INDEX "Peserta_userId_idx" ON "Peserta"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Peserta_userId_eventId_key" ON "Peserta"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "DetailPeserta" ADD CONSTRAINT "DetailPeserta_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Juara" ADD CONSTRAINT "Juara_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
