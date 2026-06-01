import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTgContext } from '@/lib/tg-auth';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';
import { applyCourierAction } from '@/lib/courier-actions';

export const runtime = 'nodejs';

const schema = z.object({
  action: z.enum(['TAKE', 'ON_ROUTE', 'DELIVERED']),
  volume: z.number().int().min(1).max(FULL_TANK_MAX_LITERS).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }
  if (!ctx.courier) {
    return NextResponse.json({ error: 'Not a courier' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid data' },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await applyCourierAction(
    ctx.courier.id,
    id,
    parsed.data.action,
    parsed.data.volume,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.order);
}
