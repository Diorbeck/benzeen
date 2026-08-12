import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateRating } from '@/lib/order-rating';

// Оценка доставки: 1–5 звёзд + необязательный комментарий, один раз,
// только по своему DELIVERED-заказу.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { rating?: unknown; comment?: unknown };

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, clientId: user.id },
    select: { id: true, status: true, rating: true },
  });
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const verdict = validateRating({
    status: order.status,
    existingRating: order.rating,
    rating: body.rating,
    comment: body.comment,
  });
  if (!verdict.ok) {
    const status = verdict.error === 'invalid' ? 400 : 409;
    return NextResponse.json({ error: verdict.error }, { status });
  }

  await prisma.order.update({
    where: { id },
    data: { rating: verdict.rating, ratingComment: verdict.comment },
  });
  return NextResponse.json({ ok: true });
}
