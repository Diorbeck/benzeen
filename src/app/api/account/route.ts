import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  name: z.string().trim().max(80).optional(),
});

// Update the signed-in client's own profile. CLIENT role only.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name } = patchSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: name && name.length > 0 ? name : null },
      select: { name: true },
    });

    return NextResponse.json({ ok: true, name: updated.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    console.error('[account PATCH]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
