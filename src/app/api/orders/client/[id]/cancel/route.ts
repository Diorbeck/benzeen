import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refundBonusOnCancel } from '@/lib/referral';

// Client cancels their own SCHEDULED order (only while still scheduled).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, clientId: user.id },
    select: { id: true, status: true },
  });
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (order.status !== 'SCHEDULED') {
    return NextResponse.json({ error: 'not_cancellable' }, { status: 409 });
  }

  await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  // M5: return any bonus liters spent on this order (idempotent).
  await refundBonusOnCancel(id);
  return NextResponse.json({ ok: true, status: 'CANCELLED' });
}
