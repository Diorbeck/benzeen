import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SUPPORT_MESSAGES_PER_HOUR } from '@/lib/support-ai';
import { runAiTurn } from '@/lib/support-thread';

const schema = z.object({ text: z.string().trim().min(1).max(1000) });

// Сообщение клиента в тред. Закрытый диалог — только чтение (409);
// rate limit 20 сообщений/час на клиента суммарно по всем тредам (429).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: client.id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    return NextResponse.json({ error: 'closed' }, { status: 409 });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.supportMessage.count({
    where: {
      authorType: 'CLIENT',
      createdAt: { gte: since },
      ticket: { userId: client.id },
    },
  });
  if (recent >= SUPPORT_MESSAGES_PER_HOUR) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: id, authorType: 'CLIENT', text: parsed.data.text },
    }),
    prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN' } }),
  ]);

  // ИИ отвечает синхронно (haiku быстрый); сбой не ломает запрос.
  await runAiTurn(id);

  return NextResponse.json({ ok: true });
}
