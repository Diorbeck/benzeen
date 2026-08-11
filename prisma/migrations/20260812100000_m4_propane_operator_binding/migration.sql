-- M4 review fix: bind operators to their point. Additive + idempotent.
-- NULL operatorId = unassigned (only SUPER_ADMIN can serve that queue).

ALTER TABLE "PropanePoint" ADD COLUMN IF NOT EXISTS "operatorId" TEXT;

CREATE INDEX IF NOT EXISTS "PropanePoint_operatorId_idx"
  ON "PropanePoint"("operatorId");

DO $$ BEGIN
  ALTER TABLE "PropanePoint"
    ADD CONSTRAINT "PropanePoint_operatorId_fkey"
    FOREIGN KEY ("operatorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
