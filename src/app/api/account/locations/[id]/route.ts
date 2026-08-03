import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const renameSchema = z.object({ name: z.string().trim().min(1).max(40) });

async function ownLocation(id: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') return { error: 'unauthorized' as const };
  const loc = await prisma.savedLocation.findFirst({ where: { id, userId: user.id } });
  if (!loc) return { error: 'not_found' as const };
  return { userId: user.id };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownLocation(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }
  try {
    const { name } = renameSchema.parse(await req.json());
    const loc = await prisma.savedLocation.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, lat: true, lng: true },
    });
    return NextResponse.json(loc);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/locations PATCH]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownLocation(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }
  await prisma.savedLocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
