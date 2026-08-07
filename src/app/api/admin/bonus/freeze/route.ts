import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  userId: z.string().cuid(),
  frozen: z.boolean(),
});

// Toggle User.bonusFrozen. Frozen users cannot accrue or spend bonus liters
// (the balance stays visible). Every change is audited. SUPER_ADMIN only.
export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { userId, frozen } = schema.parse(await req.json());
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await prisma.user.update({ where: { id: userId }, data: { bonusFrozen: frozen } });

    await writeAuditLog({
      action: frozen ? 'BONUS_FREEZE' : 'BONUS_UNFREEZE',
      targetType: 'User',
      targetId: userId,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
    });

    return NextResponse.json({ ok: true, frozen });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message || 'invalid' }, { status: 400 });
    }
    console.error('[admin/bonus/freeze]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
