-- CreateTable
CREATE TABLE "DailyScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "wpm" DOUBLE PRECISION NOT NULL,
    "rawWpm" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "correctChars" INTEGER NOT NULL,
    "totalTyped" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyScore_date_score_idx" ON "DailyScore"("date", "score");

-- CreateIndex
CREATE UNIQUE INDEX "DailyScore_userId_date_key" ON "DailyScore"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyScore" ADD CONSTRAINT "DailyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
