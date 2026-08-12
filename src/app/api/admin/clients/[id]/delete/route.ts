import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import {
  countDeletionBlockers,
  deleteCarPhotos,
  deleteClient,
  deletionBlock,
  hardDeleteEligible,
} from '@/lib/account-deletion';

const schema = z.object({
  reason: z.string().trim().max(500).optional(),
  // Hard delete is for spam accounts only: allowed with zero orders AND zero
  // ledger rows; anything else must anonymize.
  hard: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.role !== 'CLIENT') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (target.deletedAt) {
    return NextResponse.json({ error: 'already_deleted' }, { status: 409 });
  }

  const block = deletionBlock(await countDeletionBlockers(id));
  if (block) return NextResponse.json({ error: block }, { status: 409 });

  if (parsed.data.hard) {
    const [orders, ledger] = await Promise.all([
      prisma.order.count({ where: { clientId: id } }),
      prisma.bonusLedger.count({ where: { userId: id } }),
    ]);
    if (!hardDeleteEligible({ orders, ledger })) {
      return NextResponse.json({ error: 'not_eligible' }, { status: 409 });
    }
    const cars = await prisma.clientCar.findMany({ where: { userId: id }, select: { photoUrl: true } });
    try {
      await prisma.user.delete({ where: { id } });
    } catch (e) {
      // FK restrict (e.g. invitees pointing at this user) — fall back to 409;
      // the admin can anonymize instead.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return NextResponse.json({ error: 'not_eligible' }, { status: 409 });
      }
      throw e;
    }
    await deleteCarPhotos(cars.map((c) => c.photoUrl).filter((u): u is string => Boolean(u)));
    await prisma.auditLog.create({
      data: {
        actorId: guard.actorId,
        actorEmail: guard.actorEmail,
        action: 'CLIENT_HARD_DELETE',
        targetType: 'Client',
        targetId: id,
        metadata: { reason: parsed.data.reason ?? null },
      },
    });
    return NextResponse.json({ ok: true, mode: 'hard' });
  }

  const { photoUrls } = await deleteClient(id);
  await deleteCarPhotos(photoUrls);
  await prisma.auditLog.create({
    data: {
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
      action: 'CLIENT_ANONYMIZE',
      targetType: 'Client',
      targetId: id,
      metadata: { reason: parsed.data.reason ?? null },
    },
  });
  return NextResponse.json({ ok: true, mode: 'anonymized' });
}
