import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getTgContext } from '@/lib/tg-auth';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';

export const runtime = 'nodejs';

// A driver may edit or delete their own order only while it is still a draft
// (not yet accepted by a courier / dispatcher). These are the editable states.
const EDITABLE_STATUSES = ['CREATED', 'PENDING_APPROVAL'];

const patchSchema = z.object({
  fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']).optional(),
  volume: z.number().int().min(0).max(FULL_TANK_MAX_LITERS).optional(),
  isFullTank: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

async function loadOwnDraft(req: Request, id: string) {
  const ctx = await getTgContext(req);
  if (!ctx) return { error: NextResponse.json({ error: 'Invalid init data' }, { status: 401 }) };
  if (!ctx.driver) return { error: NextResponse.json({ error: 'Not linked' }, { status: 403 }) };

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.createdById !== ctx.driver.id) {
    return { error: NextResponse.json({ error: 'Заказ не найден' }, { status: 404 }) };
  }
  if (!EDITABLE_STATUSES.includes(order.status)) {
    return { error: NextResponse.json({ error: 'Заказ уже принят, изменить нельзя' }, { status: 409 }) };
  }
  return { order };
}

// Edit a draft order (volume / fuel / notes).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwnDraft(req, id);
  if (res.error) return res.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid data' }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      fuelType: data.fuelType,
      volume: data.volume,
      isFullTank: data.isFullTank,
      notes: data.notes,
    },
  });
  return NextResponse.json(updated);
}

// Delete a draft order.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwnDraft(req, id);
  if (res.error) return res.error;

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
