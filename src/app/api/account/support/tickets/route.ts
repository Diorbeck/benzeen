import { NextResponse } from 'next/server';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// Список обращений клиента со статусами и последним сообщением.
export async function GET() {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: client.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      needsHuman: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { authorType: true, text: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      needsHuman: t.needsHuman,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      lastMessage: t.messages[0] ?? null,
    })),
  });
}
