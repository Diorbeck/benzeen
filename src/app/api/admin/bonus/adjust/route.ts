import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  userId: z.string().cuid(),
  liters: z.number().int().positive().max(10000),
  comment: z.string().trim().min(1).max(500),
});

// Manual bonus correction: creates ONE new append-only ADMIN_ADJUSTMENT ledger
// row (positive liters; the reason implies a +credit) with a required comment.
// NEVER edits or deletes an existing row. Blocked while the user is frozen.
// SUPER_ADMIN only; audited.
export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { userId, liters, comment } = schema.parse(await req.json());
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, bonusFrozen: true },
    });
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    // A frozen user gets no new postings, including manual adjustments.
    if (target.bonusFrozen) return NextResponse.json({ error: 'frozen' }, { status: 409 });

    const row = await prisma.bonusLedger.create({
      data: {
        userId,
        liters,
        reason: 'ADMIN_ADJUSTMENT',
        status: 'POSTED',
        adminComment: comment,
        adminId: guard.actorId,
      },
      select: { id: true },
    });

    await writeAuditLog({
      action: 'BONUS_ADJUSTMENT',
      targetType: 'BonusLedger',
      targetId: row.id,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
      metadata: { userId, liters, comment },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message || 'invalid' }, { status: 400 });
    }
    console.error('[admin/bonus/adjust]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
