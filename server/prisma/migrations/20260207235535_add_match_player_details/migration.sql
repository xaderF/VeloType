-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN     "correctChars" INTEGER,
ADD COLUMN     "errors" INTEGER,
ADD COLUMN     "progressSamples" JSONB,
ADD COLUMN     "ratingAfter" INTEGER,
ADD COLUMN     "ratingBefore" INTEGER,
ADD COLUMN     "ratingDelta" INTEGER,
ADD COLUMN     "rawWpm" DOUBLE PRECISION,
ADD COLUMN     "totalTyped" INTEGER;
