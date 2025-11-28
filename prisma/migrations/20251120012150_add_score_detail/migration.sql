-- CreateTable
CREATE TABLE "ScoreDetail" (
    "id" SERIAL NOT NULL,
    "scoreId" INTEGER NOT NULL,
    "kriteria" TEXT NOT NULL,
    "nilai" INTEGER NOT NULL,
    "bobot" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreDetail_scoreId_idx" ON "ScoreDetail"("scoreId");

-- AddForeignKey
ALTER TABLE "ScoreDetail" ADD CONSTRAINT "ScoreDetail_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
