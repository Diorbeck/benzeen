import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  priceUzs: z.number().int().positive().max(1_000_000).optional(),
  postsCount: z.number().int().min(1).max(20).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  operatorId: z.string().cuid().nullable().optional(),
});

// Edit / move / pause a point.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const exists = await prisma.propanePoint.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const point = await prisma.propanePoint.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ point });
}

// Delete a point — only when no future active bookings depend on it (else 409:
// pause it instead so clients keep their slots).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const future = await prisma.propaneBooking.count({
    where: { pointId: id, status: 'BOOKED', slotStart: { gte: new Date() } },
  });
  if (future > 0) return NextResponse.json({ error: 'has_bookings' }, { status: 409 });

  await prisma.propaneBooking.deleteMany({ where: { pointId: id } });
  await prisma.propanePoint.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
