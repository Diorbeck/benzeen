import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCode } from '@/lib/verification';
import {
  countDeletionBlockers,
  deleteCarPhotos,
  deleteClient,
  deletionBlock,
} from '@/lib/account-deletion';

const schema = z.object({ code: z.string().min(4).max(10) });

// Step 2 of self-deletion: verify the SMS code, then anonymize. The client
// signs out on success; the anonymized account can never authenticate again.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, deletedAt: true },
  });
  if (!me || me.deletedAt || !me.phone) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Re-check: an order/booking could have appeared between the two steps.
  const block = deletionBlock(await countDeletionBlockers(user.id));
  if (block) return NextResponse.json({ error: block }, { status: 409 });

  const verdict = await verifyCode({
    identifier: me.phone,
    code: parsed.data.code,
    purpose: 'account_delete',
  });
  if (!verdict.ok) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });

  const { photoUrls } = await deleteClient(user.id);
  await deleteCarPhotos(photoUrls);

  return NextResponse.json({ ok: true });
}
