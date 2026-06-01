import { prisma } from '@/lib/prisma';
import type { AuditAction, Prisma } from '@prisma/client';

type WriteAuditArgs = {
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Best-effort audit write. NEVER throws — auditing must not break the mutation
 * it records. Keep `metadata` small and free of PII (no phones/emails beyond
 * the actor's own email, which admins already know).
 */
export async function writeAuditLog(args: WriteAuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId ?? null,
        actorId: args.actorId ?? null,
        actorEmail: args.actorEmail ?? null,
        metadata: args.metadata,
      },
    });
  } catch (e) {
    console.error('[audit] failed to write audit log:', e);
  }
}
