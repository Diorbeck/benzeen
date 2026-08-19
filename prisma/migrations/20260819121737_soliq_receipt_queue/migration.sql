-- AlterTable
ALTER TABLE "FuelingSession" ADD COLUMN     "soliqAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "soliqFiscalId" TEXT,
ADD COLUMN     "soliqLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "soliqLastError" TEXT;

-- CreateIndex
CREATE INDEX "FuelingSession_soliqSyncedAt_status_idx" ON "FuelingSession"("soliqSyncedAt", "status");
