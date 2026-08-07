import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentClient } from '@/lib/session';

// Set the caller's default car. Ownership-checked: a client can only default to
// one of their own cars. The rich "Основная" badge/toggle UI lands in PR-A; this
// is the server seam it calls.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const car = await prisma.clientCar.findFirst({ where: { id, userId: client.id }, select: { id: true } });
  if (!car) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.user.update({ where: { id: client.id }, data: { defaultCarId: car.id } });
  return NextResponse.json({ ok: true, defaultCarId: car.id });
}
