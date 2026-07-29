import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyCouriersNewOrder } from '@/lib/order-dispatch';
import { DISPATCH_STALE_AFTER_MS } from '@/lib/constants';

export const runtime = 'nodejs';

// Vercel cron (every 2 min): B2C orders still unassigned after the initial
// nearest-courier offer get broadcast to ALL couriers, once. `botPhase` is
// reused as a "already broadcast" marker so we don't re-notify every run.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - DISPATCH_STALE_AFTER_MS);
  const stale = await prisma.order.findMany({
    where: {
      status: 'RECEIVED',
      assignedToId: null,
      clientId: { not: null },
      botPhase: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 50,
  });

  for (const o of stale) {
    await prisma.order.update({ where: { id: o.id }, data: { botPhase: 'BROADCAST' } });
    await notifyCouriersNewOrder(o.id);
  }

  return NextResponse.json({ ok: true, broadcast: stale.length });
}
