import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refundBonusOnCancel } from '@/lib/referral';
import { clientCancelVerdict, validateCancelInput } from '@/lib/order-cancel';
import { notifyCouriersOrderCancelled } from '@/lib/order-dispatch';

const schema = z.object({
  reason: z.string(),
  comment: z.string().max(200).optional(),
});

// Клиент отменяет свой заказ в RECEIVED или SCHEDULED с причиной.
// COURIER_ASSIGNED/IN_DELIVERY и терминальные → 409 (UI ведёт в поддержку).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const input = validateCancelInput(body.data.reason, body.data.comment);
  if (!input.ok) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { id } = await params;
  // Ownership: чужой заказ неотличим от несуществующего.
  const order = await prisma.order.findFirst({
    where: { id, clientId: user.id },
    select: { id: true, status: true },
  });
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const verdict = clientCancelVerdict(order.status);
  if (verdict !== 'ok') {
    return NextResponse.json({ error: 'not_cancellable', verdict }, { status: 409 });
  }

  const wasLive = order.status === 'RECEIVED';

  await prisma.order.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelReason: input.reason,
      cancelComment: input.comment,
    },
  });

  // M5: вернуть потраченные бонусные литры (идемпотентно).
  await refundBonusOnCancel(id);

  // Заказ уже рассылался курьерам → сообщаем им об отмене (best-effort).
  if (wasLive) {
    await notifyCouriersOrderCancelled(id).catch(() => null);
  }

  return NextResponse.json({ ok: true, status: 'CANCELLED' });
}
