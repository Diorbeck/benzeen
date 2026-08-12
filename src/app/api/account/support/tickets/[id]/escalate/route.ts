import { NextResponse } from 'next/server';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// «Позвать оператора»: ИИ замолкает, тикету бейдж «нужен человек».
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: client.id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    return NextResponse.json({ error: 'closed' }, { status: 409 });
  }

  await prisma.supportTicket.update({
    where: { id },
    data: { needsHuman: true, status: 'OPEN' },
  });
  return NextResponse.json({ ok: true });
}
