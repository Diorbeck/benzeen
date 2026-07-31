import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// A car can't be removed while it's tied to a live order.
const TERMINAL = ['DELIVERED', 'CANCELLED', 'REJECTED'] as const;

const carSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().max(60).optional(),
  tankCapacity: z.number().int().min(20).max(200).nullable().optional(),
});

async function ownCar(carId: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') return { error: 'unauthorized' as const };
  const car = await prisma.clientCar.findFirst({ where: { id: carId, userId: user.id } });
  if (!car) return { error: 'not_found' as const };
  return { userId: user.id, car };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }
  try {
    const { plate, model, tankCapacity } = carSchema.parse(await req.json());
    const car = await prisma.clientCar.update({
      where: { id },
      data: { plate, model: model || null, tankCapacity: tankCapacity ?? null },
      select: { id: true, plate: true, model: true, tankCapacity: true },
    });
    return NextResponse.json(car);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/cars PATCH]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }

  // Block deletion if the car is used by a non-terminal (active) order.
  const activeCount = await prisma.order.count({
    where: { clientCarId: id, status: { notIn: [...TERMINAL] } },
  });
  if (activeCount > 0) {
    return NextResponse.json({ error: 'car_in_active_order' }, { status: 409 });
  }

  await prisma.clientCar.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
