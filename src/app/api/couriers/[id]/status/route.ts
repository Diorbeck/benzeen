import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({ deactivated: z.boolean() });

/**
 * Курьер 2.0 admin: toggle a courier's deactivation (SUPER_ADMIN only).
 * Deactivating sets `deactivatedAt` (blocks login + dispatch); reactivating
 * clears it. Additive, well-scoped — does not touch other auth/roles. Every
 * toggle is audited.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { role, id: actorId, email: actorEmail } = session.user as {
      role?: string;
      id?: string;
      email?: string;
    };
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const courier = await prisma.user.findFirst({ where: { id, role: 'COURIER' } });
    if (!courier) {
      return NextResponse.json({ error: 'Курьер не найден' }, { status: 404 });
    }

    const { deactivated } = schema.parse(await req.json());

    // If deactivating, also drop the courier off-duty so no live order offer can
    // reach them the instant before the flag propagates.
    await prisma.user.update({
      where: { id },
      data: deactivated
        ? { deactivatedAt: new Date(), onDuty: false }
        : { deactivatedAt: null },
    });

    await writeAuditLog({
      action: deactivated ? 'COURIER_DEACTIVATE' : 'COURIER_ACTIVATE',
      targetType: 'Courier',
      targetId: id,
      actorId: actorId ?? null,
      actorEmail: actorEmail ?? null,
      metadata: { name: courier.name },
    });

    return NextResponse.json({ ok: true, deactivated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
