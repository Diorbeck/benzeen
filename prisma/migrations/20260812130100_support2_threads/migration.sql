-- Поддержка 2.0, шаг 2: треды. Аддитивно + идемпотентно; безопасно к повтору.

-- Статусы существующих тикетов: NEW → OPEN, RESOLVED → CLOSED (идемпотентно —
-- повторный прогон не найдёт строк в legacy-статусах).
UPDATE "SupportTicket" SET "status" = 'OPEN' WHERE "status" = 'NEW';
UPDATE "SupportTicket" SET "status" = 'CLOSED' WHERE "status" = 'RESOLVED';
ALTER TABLE "SupportTicket" ALTER COLUMN "status" SET DEFAULT 'OPEN';

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "needsHuman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");

DO $$ BEGIN
  CREATE TYPE "SupportMessageAuthor" AS ENUM ('CLIENT', 'ADMIN', 'AI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorType" "SupportMessageAuthor" NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx"
  ON "SupportMessage"("ticketId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SupportMessage"
    ADD CONSTRAINT "SupportMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Текст существующего тикета становится первым сообщением треда (один раз).
INSERT INTO "SupportMessage" ("id", "ticketId", "authorType", "text", "createdAt")
SELECT 'seedmsg-' || t."id", t."id", 'CLIENT', t."text", t."createdAt"
FROM "SupportTicket" t
WHERE NOT EXISTS (
  SELECT 1 FROM "SupportMessage" m WHERE m."id" = 'seedmsg-' || t."id"
);
