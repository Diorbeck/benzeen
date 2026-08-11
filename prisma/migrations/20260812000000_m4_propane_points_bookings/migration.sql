-- M4 Propane: points + slot bookings. Additive + idempotent — no drops, no
-- backfills; every statement is safe to re-run.

-- New role for point operators and the LPG fuel type. ADD VALUE IF NOT EXISTS
-- must run as a top-level statement (not inside DO).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PROPANE_OPERATOR';
ALTER TYPE "FuelType" ADD VALUE IF NOT EXISTS 'PROPANE';

-- Enums for point/booking lifecycle (CREATE TYPE has no IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE "PropanePointStatus" AS ENUM ('ACTIVE', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PropaneBookingStatus" AS ENUM ('BOOKED', 'SERVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PropanePoint" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "status" "PropanePointStatus" NOT NULL DEFAULT 'ACTIVE',
  "priceUzs" INTEGER NOT NULL,
  "postsCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropanePoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropaneBooking" (
  "id" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "slotStart" TIMESTAMP(3) NOT NULL,
  "status" "PropaneBookingStatus" NOT NULL DEFAULT 'BOOKED',
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropaneBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropaneBooking_code_key"
  ON "PropaneBooking"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "PropaneBooking_pointId_clientId_slotStart_key"
  ON "PropaneBooking"("pointId", "clientId", "slotStart");
CREATE INDEX IF NOT EXISTS "PropaneBooking_pointId_slotStart_status_idx"
  ON "PropaneBooking"("pointId", "slotStart", "status");
CREATE INDEX IF NOT EXISTS "PropaneBooking_clientId_slotStart_idx"
  ON "PropaneBooking"("clientId", "slotStart");

DO $$ BEGIN
  ALTER TABLE "PropaneBooking"
    ADD CONSTRAINT "PropaneBooking_pointId_fkey"
    FOREIGN KEY ("pointId") REFERENCES "PropanePoint"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PropaneBooking"
    ADD CONSTRAINT "PropaneBooking_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
