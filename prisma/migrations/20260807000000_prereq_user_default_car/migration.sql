-- Prereq (session + default car): a client's default vehicle pointer.
-- Additive + idempotent. Nullable column + FK with ON DELETE SET NULL, so
-- deleting a car never cascades to the user and existing rows stay valid.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultCarId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_defaultCarId_fkey"
    FOREIGN KEY ("defaultCarId") REFERENCES "ClientCar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
