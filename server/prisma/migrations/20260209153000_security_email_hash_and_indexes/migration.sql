-- Add deterministic email hash used for identity lookups
ALTER TABLE "User"
ADD COLUMN "emailHash" TEXT;

-- Replace encrypted-email uniqueness with deterministic hash uniqueness.
-- Encrypted email is randomized (non-deterministic), so it is not safe for equality lookups.
DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");
