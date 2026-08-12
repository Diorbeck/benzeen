-- Поддержка 2.0, шаг 1: новые значения enum'ов. Отдельная миграция —
-- Postgres запрещает использовать новое значение enum в той же транзакции,
-- где оно добавлено. Всё аддитивно и идемпотентно.
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'ANSWERED';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_REPLY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_CLOSE';
