import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { runAiTurn } from '@/lib/support-thread';

// Max tickets a single client may open per rolling hour.
const RATE_LIMIT_PER_HOUR = 3;

const ticketSchema = z.object({
  type: z.enum(['COMPLAINT', 'SUGGESTION', 'QUESTION']),
  text: z.string().trim().min(1).max(1000),
});

// Create a support ticket for the signed-in client. Rate-limited to 3/hour/user.
export async function POST(req: Request) {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { type, text } = ticketSchema.parse(await req.json());

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.supportTicket.count({
      where: { userId: client.id, createdAt: { gte: since } },
    });
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: client.id,
        type,
        text,
        // Поддержка 2.0: текст тикета — первое сообщение треда.
        messages: { create: { authorType: 'CLIENT', text } },
      },
      select: { id: true, status: true, createdAt: true },
    });

    // ИИ отвечает сразу (жалобы и выключенный провайдер гейтятся внутри).
    await runAiTurn(ticket.id);

    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/support POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
