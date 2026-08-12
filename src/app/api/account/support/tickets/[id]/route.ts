import { NextResponse } from 'next/server';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// Тред обращения (только владелец).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: client.id },
    select: {
      id: true,
      type: true,
      status: true,
      needsHuman: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorType: true, text: true, createdAt: true },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ticket });
}
