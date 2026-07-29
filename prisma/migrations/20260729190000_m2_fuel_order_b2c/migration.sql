-- M2 (B2C fuel order flow). Fully additive + idempotent: new nullable columns,
-- new tables, new enums. Existing B2B orders keep working (all new columns null).

-- New enums (idempotent: swallow "already exists").
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('COURIER_POS', 'PAYME', 'CLICK', 'UZUM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Order: carId becomes nullable (B2C orders have no B2B Car).
ALTER TABLE "Order" ALTER COLUMN "carId" DROP NOT NULL;

-- Order: additive B2C columns.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientCarId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pricePerLiter" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalAmount" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus";

-- ClientCar (B2C client vehicle).
CREATE TABLE IF NOT EXISTS "ClientCar" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "model" TEXT,
  "tankCapacity" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientCar_pkey" PRIMARY KEY ("id")
);

-- CourierLocation (latest live location per courier).
CREATE TABLE IF NOT EXISTS "CourierLocation" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourierLocation_pkey" PRIMARY KEY ("id")
);

-- Indexes (idempotent).
CREATE INDEX IF NOT EXISTS "Order_clientId_idx" ON "Order"("clientId");
CREATE INDEX IF NOT EXISTS "Order_status_assignedToId_idx" ON "Order"("status", "assignedToId");
CREATE INDEX IF NOT EXISTS "ClientCar_userId_idx" ON "ClientCar"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourierLocation_courierId_key" ON "CourierLocation"("courierId");

-- Foreign keys (idempotent: swallow "already exists").
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_clientCarId_fkey"
    FOREIGN KEY ("clientCarId") REFERENCES "ClientCar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientCar" ADD CONSTRAINT "ClientCar_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_courierId_fkey"
    FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
