import { NextResponse } from 'next/server';
import { z } from 'zod';
import { del } from '@vercel/blob';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// A car can't be removed while it's tied to a live order.
const TERMINAL = ['DELIVERED', 'CANCELLED', 'REJECTED'] as const;

const carSelect = {
  id: true,
  plate: true,
  model: true,
  tankCapacity: true,
  brand: true,
  color: true,
  fuelType: true,
  oilType: true,
  photoUrl: true,
} as const;

const carSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().max(60).optional(),
  tankCapacity: z.number().int().min(20).max(200).nullable().optional(),
  brand: z.string().trim().max(60).optional(),
  color: z.string().trim().max(40).optional(),
  fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']).nullable().optional(),
  oilType: z.string().trim().max(60).optional(),
});

async function ownCar(carId: string) {
  const client = await getCurrentClient();
  if (!client) return { error: 'unauthorized' as const };
  const car = await prisma.clientCar.findFirst({ where: { id: carId, userId: client.id } });
  if (!car) return { error: 'not_found' as const };
  return { userId: client.id, car };
}

// Best-effort blob cleanup — a missing token or already-deleted blob must never
// break the request. Only our own car photos live under this host.
async function deleteBlob(url: string | null | undefined) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.error('[account/cars blob del]', err);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }
  const car = await prisma.clientCar.findUnique({ where: { id }, select: carSelect });
  return NextResponse.json(car);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }
  try {
    const p = carSchema.parse(await req.json());
    const car = await prisma.clientCar.update({
      where: { id },
      data: {
        plate: p.plate,
        model: p.model || null,
        tankCapacity: p.tankCapacity ?? null,
        brand: p.brand || null,
        color: p.color || null,
        fuelType: p.fuelType ?? null,
        oilType: p.oilType || null,
      },
      select: carSelect,
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
  // Remove the associated photo blob after the row is gone.
  await deleteBlob(owned.car.photoUrl);
  return NextResponse.json({ ok: true });
}
