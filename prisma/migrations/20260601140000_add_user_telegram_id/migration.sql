-- Add Telegram linkage to users (one Telegram account per driver).
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;

-- Enforce one-to-one mapping; NULLs are allowed and not deduplicated by Postgres.
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
