-- M2 / PR-B: Payme (Paycom) Merchant API transactions. Additive + idempotent.
CREATE TABLE IF NOT EXISTS "PaymeTransaction" (
  "id" TEXT NOT NULL,
  "paycomId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "state" INTEGER NOT NULL DEFAULT 1,
  "reason" INTEGER,
  "createTime" BIGINT NOT NULL,
  "performTime" BIGINT,
  "cancelTime" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymeTransaction_paycomId_key" ON "PaymeTransaction"("paycomId");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_orderId_idx" ON "PaymeTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_createTime_idx" ON "PaymeTransaction"("createTime");

DO $$ BEGIN
  ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
