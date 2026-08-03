-- Client profile: last name. Additive + idempotent (nullable column).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
