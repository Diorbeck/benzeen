import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveOperatorAction } from '@/lib/propane';

// Operator marks a no-show (only from BOOKED). Same point binding as serve:
// a foreign point's booking answers 404; SUPER_ADMIN is unrestricted.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== 'PROPANE_OPERATOR' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'forbidden' }, { status: user?.id ? 403 : 401 });
  }

  const { id } = await params;
  const booking = await prisma.propaneBooking.findUnique({
    where: { id },
    select: { id: true, status: true, point: { select: { operatorId: true } } },
  });

  const verdict = resolveOperatorAction({
    role: user.role,
    userId: user.id,
    booking: booking ? { status: booking.status, pointOperatorId: booking.point.operatorId } : null,
  });
  if (verdict === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (verdict === 'not_transitionable') {
    return NextResponse.json({ error: 'not_markable' }, { status: 409 });
  }

  await prisma.propaneBooking.update({ where: { id }, data: { status: 'NO_SHOW' } });
  return NextResponse.json({ ok: true, status: 'NO_SHOW' });
}
