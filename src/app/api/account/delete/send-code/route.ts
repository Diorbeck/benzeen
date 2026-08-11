import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAndSendCode } from '@/lib/verification';
import { countDeletionBlockers, deletionBlock } from '@/lib/account-deletion';

// Step 1 of self-deletion: confirm intent with an SMS code to the client's own
// number. Refuses up front while an active order / propane booking exists.
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, deletedAt: true },
  });
  if (!me || me.deletedAt || !me.phone) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const block = deletionBlock(await countDeletionBlockers(user.id));
  if (block) return NextResponse.json({ error: block }, { status: 409 });

  const sent = await createAndSendCode({
    identifier: me.phone,
    method: 'phone',
    purpose: 'account_delete',
  });
  if (!sent.ok) return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
