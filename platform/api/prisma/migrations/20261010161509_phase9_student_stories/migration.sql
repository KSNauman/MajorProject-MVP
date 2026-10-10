-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "isReady" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "StudentStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "prompt" TEXT NOT NULL,
    "videoUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentStory" ADD CONSTRAINT "StudentStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
