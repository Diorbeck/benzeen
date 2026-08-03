-- M5: referrals, bonus ledger, saved locations. Additive + idempotent.

DO $$ BEGIN
  CREATE TYPE "BonusReason" AS ENUM ('FRIEND_FIRST_ORDER', 'TEN_FRIENDS_MILESTONE', 'SPENT', 'REFUND');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- User: referral code + who referred them.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredById_idx" ON "User"("referredById");

-- Order: bonus liters applied.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bonusLitersUsed" INTEGER;

-- BonusLedger.
CREATE TABLE IF NOT EXISTS "BonusLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "liters" INTEGER NOT NULL,
  "reason" "BonusReason" NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BonusLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BonusLedger_userId_idx" ON "BonusLedger"("userId");
CREATE INDEX IF NOT EXISTS "BonusLedger_orderId_idx" ON "BonusLedger"("orderId");

-- SavedLocation.
CREATE TABLE IF NOT EXISTS "SavedLocation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedLocation_userId_idx" ON "SavedLocation"("userId");

-- FKs (idempotent).
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "BonusLedger" ADD CONSTRAINT "BonusLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "BonusLedger" ADD CONSTRAINT "BonusLedger_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SavedLocation" ADD CONSTRAINT "SavedLocation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
