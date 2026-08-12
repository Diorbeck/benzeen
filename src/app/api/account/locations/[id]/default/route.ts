import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentClient } from '@/lib/session';

// Этап 2: адрес по умолчанию. Ownership-checked; повторный POST по тому же
// адресу снимает отметку (toggle).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const loc = await prisma.savedLocation.findFirst({
    where: { id, userId: client.id },
    select: { id: true },
  });
  if (!loc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const me = await prisma.user.findUnique({
    where: { id: client.id },
    select: { defaultLocationId: true },
  });
  const next = me?.defaultLocationId === loc.id ? null : loc.id;
  await prisma.user.update({ where: { id: client.id }, data: { defaultLocationId: next } });
  return NextResponse.json({ ok: true, defaultLocationId: next });
}
