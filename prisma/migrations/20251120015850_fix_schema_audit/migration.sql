/*
  Warnings:

  - Added the required column `updatedAt` to the `Berita` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DetailPeserta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Juara` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Partisipasi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Peserta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Score` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ScoreDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Berita" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "DetailPeserta" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "Juara" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "Partisipasi" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "Peserta" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "ScoreDetail" ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER;
