// Поддержка 2.0: общий серверный флоу «сообщение клиента → возможный ответ ИИ».
// Используется и при создании тикета, и при ответе в тред.

import { prisma } from '@/lib/prisma';
import { getSupportAi, shouldAutoReply, type SupportAiProvider } from '@/lib/support-ai';

/**
 * После сохранения сообщения клиента: если тред открыт для ИИ — спросить
 * провайдера. Ответ пишется в тред (статус ANSWERED), сигнал эскалации
 * поднимает needsHuman («нужен человек»), выключенный/упавший провайдер
 * оставляет тикет оператору (статус OPEN).
 */
export async function runAiTurn(
  ticketId: string,
  ai: SupportAiProvider = getSupportAi(),
): Promise<void> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      type: true,
      status: true,
      needsHuman: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { authorType: true, text: true },
      },
    },
  });
  if (!ticket) return;
  if (!shouldAutoReply(ticket)) return;

  const decision = await ai.decide(ticket.messages);

  if (decision.kind === 'reply') {
    await prisma.$transaction([
      prisma.supportMessage.create({
        data: { ticketId, authorType: 'AI', text: decision.text },
      }),
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'ANSWERED' },
      }),
    ]);
    return;
  }

  if (decision.kind === 'escalate') {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { needsHuman: true, status: 'OPEN' },
    });
  }
  // disabled / error → тикет остаётся OPEN и ждёт оператора.
}
