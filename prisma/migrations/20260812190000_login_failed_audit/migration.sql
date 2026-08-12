-- PR-D: аудит неудачных staff-логинов. Аддитивно + идемпотентно.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
