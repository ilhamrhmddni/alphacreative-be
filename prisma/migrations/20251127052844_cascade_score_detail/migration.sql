-- DropForeignKey
ALTER TABLE "ScoreDetail" DROP CONSTRAINT "ScoreDetail_scoreId_fkey";

-- AddForeignKey
ALTER TABLE "ScoreDetail" ADD CONSTRAINT "ScoreDetail_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE CASCADE ON UPDATE CASCADE;
