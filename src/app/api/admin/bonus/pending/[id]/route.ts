import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ action: z.enum(['approve', 'reject']) });

// Decide a PENDING accrual: approve → POSTED, reject → REJECTED. This flips ONLY
// the row's `status` — liters/reason are never touched, and no row is deleted.
// Only PENDING rows are decidable (idempotent-ish: a decided row 409s).
// SUPER_ADMIN only; audited.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { id } = await params;
    const { action } = schema.parse(await req.json());

    const row = await prisma.bonusLedger.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, liters: true, reason: true },
    });
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (row.status !== 'PENDING') {
      return NextResponse.json({ error: 'not_pending' }, { status: 409 });
    }

    const nextStatus = action === 'approve' ? 'POSTED' : 'REJECTED';
    await prisma.bonusLedger.update({
      where: { id },
      // ONLY status changes. Never liters/reason.
      data: { status: nextStatus, adminId: guard.actorId },
    });

    await writeAuditLog({
      action: action === 'approve' ? 'BONUS_APPROVE' : 'BONUS_REJECT',
      targetType: 'BonusLedger',
      targetId: id,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
      metadata: { userId: row.userId, liters: row.liters, reason: row.reason },
    });

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message || 'invalid' }, { status: 400 });
    }
    console.error('[admin/bonus/pending]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
