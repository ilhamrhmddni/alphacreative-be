/*
  Warnings:

  - You are about to drop the `InstagramLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Partisipasi" ADD COLUMN     "linkDrive" TEXT;

-- DropTable
DROP TABLE "InstagramLink";
