-- Кабинет 2.0 (PR-A): richer ClientCar profile + support tickets.
-- Additive + idempotent. No column drops, no non-null backfills.

-- ClientCar: optional profile fields. fuelType reuses the existing FuelType enum.
ALTER TABLE "ClientCar" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "ClientCar" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "ClientCar" ADD COLUMN IF NOT EXISTS "fuelType" "FuelType";
ALTER TABLE "ClientCar" ADD COLUMN IF NOT EXISTS "oilType" TEXT;
ALTER TABLE "ClientCar" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- Support ticket enums.
DO $$ BEGIN
  CREATE TYPE "SupportTicketType" AS ENUM ('COMPLAINT', 'SUGGESTION', 'QUESTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SupportTicket table.
CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "SupportTicketType" NOT NULL,
  "text" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX IF NOT EXISTS "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
