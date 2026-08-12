// PR-D: аудит неудачных staff-логинов. Идентификатор маскируется — в журнале
// не должно быть полных телефонов/почт.
import { writeAuditLog } from '@/lib/audit';

/** +998901234567 → +9989***4567; user@mail.com → u***@mail.com */
export function maskIdentifier(raw: string): string {
  const id = raw.trim();
  if (id.includes('@')) {
    const [local, domain] = id.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 7) {
    return `${id.slice(0, 5)}***${id.slice(-4)}`;
  }
  return '***';
}

/** Fire-and-forget запись о неудачной попытке (никогда не роняет authorize). */
export async function logFailedStaffLogin(mode: string, identifier: string): Promise<void> {
  try {
    await writeAuditLog({
      action: 'LOGIN_FAILED',
      targetType: 'Auth',
      targetId: null,
      actorId: null,
      actorEmail: null,
      metadata: { mode, identifier: maskIdentifier(identifier) },
    });
  } catch {
    /* журнал недоступен — вход это не блокирует */
  }
}
