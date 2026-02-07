-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "competitiveElo" INTEGER,
ADD COLUMN     "placementGamesPlayed" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "rating" DROP NOT NULL,
ALTER COLUMN "rating" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
