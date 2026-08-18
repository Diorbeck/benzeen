-- v2: цифровой контроль топлива на стационарных АЗС.
-- Аддитивно и идемпотентно: ни одна существующая таблица доставки не меняется,
-- повторный запуск на уже применённой базе ничего не ломает.

-- 1. Новые значения существующих типов. ALTER TYPE ... ADD VALUE нельзя
--    выполнять в транзакции вместе с использованием значения, поэтому только
--    объявляем — использование появляется в следующих миграциях и в коде.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STATION_OWNER';
ALTER TYPE "FuelType" ADD VALUE IF NOT EXISTS 'AI_98';
ALTER TYPE "FuelType" ADD VALUE IF NOT EXISTS 'DIESEL';

-- 2. Новые перечисления.
DO $$ BEGIN
  CREATE TYPE "StationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TankStatus" AS ENUM ('ACTIVE', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DispenserStatus" AS ENUM ('ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IdentificationMode" AS ENUM ('MANUAL', 'BLE', 'CAMERA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TankReadingSource" AS ENUM ('SENSOR', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FuelingStatus" AS ENUM ('RESERVED', 'FLOWING', 'COMPLETED', 'SETTLED', 'CANCELLED', 'MANUAL_REVIEW', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StationBillingItem" AS ENUM ('TANK', 'DISPENSER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StationInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. АЗС.
CREATE TABLE IF NOT EXISTS "FuelStation" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "brand"             TEXT,
  "address"           TEXT NOT NULL,
  "region"            TEXT,
  "lat"               DOUBLE PRECISION NOT NULL,
  "lng"               DOUBLE PRECISION NOT NULL,
  "status"            "StationStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerId"           TEXT,
  "controllerKeyHash" TEXT,
  "lastSeenAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuelStation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FuelStation_ownerId_idx" ON "FuelStation"("ownerId");
CREATE INDEX IF NOT EXISTS "FuelStation_status_idx" ON "FuelStation"("status");

-- 4. Цена АЗС по виду топлива: цену ставит сама АЗС, к нам она приезжает.
CREATE TABLE IF NOT EXISTS "StationPrice" (
  "id"        TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "fuelType"  "FuelType" NOT NULL,
  "priceUzs"  INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StationPrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StationPrice_stationId_fuelType_key" ON "StationPrice"("stationId", "fuelType");

-- 5. Резервуар с датчиком уровня — ядро продукта.
CREATE TABLE IF NOT EXISTS "Tank" (
  "id"            TEXT NOT NULL,
  "stationId"     TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "fuelType"      "FuelType" NOT NULL,
  "capacityL"     INTEGER NOT NULL,
  "minLevelL"     INTEGER,
  "status"        "TankStatus" NOT NULL DEFAULT 'ACTIVE',
  "sensorSerial"  TEXT,
  "currentLevelL" DOUBLE PRECISION,
  "lastReadingAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tank_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tank_sensorSerial_key" ON "Tank"("sensorSerial");
CREATE UNIQUE INDEX IF NOT EXISTS "Tank_stationId_label_key" ON "Tank"("stationId", "label");
CREATE INDEX IF NOT EXISTS "Tank_stationId_fuelType_idx" ON "Tank"("stationId", "fuelType");

-- 6. История показаний. Только добавление — это доказательная база при
--    расхождениях, строки не обновляются и не удаляются.
CREATE TABLE IF NOT EXISTS "TankReading" (
  "id"           TEXT NOT NULL,
  "tankId"       TEXT NOT NULL,
  "levelL"       DOUBLE PRECISION NOT NULL,
  "temperatureC" DOUBLE PRECISION,
  "volumeL"      DOUBLE PRECISION,
  "source"       "TankReadingSource" NOT NULL DEFAULT 'SENSOR',
  "measuredAt"   TIMESTAMP(3) NOT NULL,
  "receivedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TankReading_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TankReading_tankId_measuredAt_idx" ON "TankReading"("tankId", "measuredAt");

-- 7. Колонка.
CREATE TABLE IF NOT EXISTS "Dispenser" (
  "id"                 TEXT NOT NULL,
  "stationId"          TEXT NOT NULL,
  "number"             INTEGER NOT NULL,
  "status"             "DispenserStatus" NOT NULL DEFAULT 'ACTIVE',
  "fuelTypes"          "FuelType"[],
  "identificationMode" "IdentificationMode" NOT NULL DEFAULT 'MANUAL',
  "bleBeaconId"        TEXT,
  "lastSeenAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispenser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Dispenser_bleBeaconId_key" ON "Dispenser"("bleBeaconId");
CREATE UNIQUE INDEX IF NOT EXISTS "Dispenser_stationId_number_key" ON "Dispenser"("stationId", "number");
CREATE INDEX IF NOT EXISTS "Dispenser_stationId_idx" ON "Dispenser"("stationId");

-- 8. Заправка: двухфазная транзакция, резерв под полный бак и точное списание.
CREATE TABLE IF NOT EXISTS "FuelingSession" (
  "id"                 TEXT NOT NULL,
  "stationId"          TEXT NOT NULL,
  "dispenserId"        TEXT NOT NULL,
  "clientId"           TEXT,
  "carId"              TEXT,
  "fuelType"           "FuelType" NOT NULL,
  "requestedLiters"    INTEGER,
  "requestedAmountUzs" INTEGER,
  "holdAmountUzs"      INTEGER NOT NULL,
  "priceUzs"           INTEGER NOT NULL,
  "litersDispensed"    DOUBLE PRECISION,
  "amountUzs"          INTEGER,
  "status"             "FuelingStatus" NOT NULL DEFAULT 'RESERVED',
  "identifiedBy"       "IdentificationMode" NOT NULL DEFAULT 'MANUAL',
  "acquirerRef"        TEXT,
  "soliqSyncedAt"      TIMESTAMP(3),
  "cashbackUzs"        INTEGER,
  "offlineBuffered"    BOOLEAN NOT NULL DEFAULT false,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"            TIMESTAMP(3),
  CONSTRAINT "FuelingSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FuelingSession_stationId_startedAt_idx" ON "FuelingSession"("stationId", "startedAt");
CREATE INDEX IF NOT EXISTS "FuelingSession_clientId_startedAt_idx" ON "FuelingSession"("clientId", "startedAt");
CREATE INDEX IF NOT EXISTS "FuelingSession_status_idx" ON "FuelingSession"("status");

-- 9. Подписка: суточная ставка за резервуар и за колонку с идентификацией.
CREATE TABLE IF NOT EXISTS "StationBillingSubscription" (
  "id"           TEXT NOT NULL,
  "stationId"    TEXT NOT NULL,
  "item"         "StationBillingItem" NOT NULL,
  "tankId"       TEXT,
  "dispenserId"  TEXT,
  "dailyRateUzs" INTEGER NOT NULL,
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"      TIMESTAMP(3),
  CONSTRAINT "StationBillingSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StationBillingSubscription_stationId_endedAt_idx" ON "StationBillingSubscription"("stationId", "endedAt");
CREATE INDEX IF NOT EXISTS "StationBillingSubscription_tankId_idx" ON "StationBillingSubscription"("tankId");
CREATE INDEX IF NOT EXISTS "StationBillingSubscription_dispenserId_idx" ON "StationBillingSubscription"("dispenserId");

-- 10. Счёт за месяц: выставляется один раз в начале месяца.
CREATE TABLE IF NOT EXISTS "StationInvoice" (
  "id"            TEXT NOT NULL,
  "stationId"     TEXT NOT NULL,
  "periodStart"   TIMESTAMP(3) NOT NULL,
  "periodEnd"     TIMESTAMP(3) NOT NULL,
  "tankDays"      INTEGER NOT NULL,
  "dispenserDays" INTEGER NOT NULL,
  "amountUzs"     INTEGER NOT NULL,
  "status"        "StationInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt"      TIMESTAMP(3),
  "paidAt"        TIMESTAMP(3),
  "dueAt"         TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StationInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StationInvoice_stationId_periodStart_key" ON "StationInvoice"("stationId", "periodStart");
CREATE INDEX IF NOT EXISTS "StationInvoice_status_dueAt_idx" ON "StationInvoice"("status", "dueAt");

-- 11. Связи. Добавляются в конце: так порядок создания таблиц не важен.
DO $$ BEGIN
  ALTER TABLE "FuelStation" ADD CONSTRAINT "FuelStation_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StationPrice" ADD CONSTRAINT "StationPrice_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Tank" ADD CONSTRAINT "Tank_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TankReading" ADD CONSTRAINT "TankReading_tankId_fkey"
    FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Dispenser" ADD CONSTRAINT "Dispenser_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FuelingSession" ADD CONSTRAINT "FuelingSession_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FuelingSession" ADD CONSTRAINT "FuelingSession_dispenserId_fkey"
    FOREIGN KEY ("dispenserId") REFERENCES "Dispenser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FuelingSession" ADD CONSTRAINT "FuelingSession_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StationBillingSubscription" ADD CONSTRAINT "StationBillingSubscription_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StationBillingSubscription" ADD CONSTRAINT "StationBillingSubscription_tankId_fkey"
    FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StationBillingSubscription" ADD CONSTRAINT "StationBillingSubscription_dispenserId_fkey"
    FOREIGN KEY ("dispenserId") REFERENCES "Dispenser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StationInvoice" ADD CONSTRAINT "StationInvoice_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
