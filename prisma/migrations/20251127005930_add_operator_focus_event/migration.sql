-- AlterTable
ALTER TABLE "User" ADD COLUMN     "focusEventId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_focusEventId_fkey" FOREIGN KEY ("focusEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
