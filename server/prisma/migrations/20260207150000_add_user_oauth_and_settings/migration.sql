-- AlterTable
ALTER TABLE "User"
ADD COLUMN "oauthProvider" TEXT,
ADD COLUMN "oauthSubject" TEXT,
ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "User_oauthProvider_oauthSubject_key" ON "User"("oauthProvider", "oauthSubject");
