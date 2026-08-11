import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем prisma: runAiTurn тестируется как связка «гейт → провайдер → записи».
vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    supportMessage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { prisma } from '@/lib/prisma';
import { runAiTurn } from './support-thread';
import type { SupportAiProvider } from './support-ai';

const mockedTicket = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  type: 'QUESTION',
  status: 'OPEN',
  needsHuman: false,
  messages: [{ authorType: 'CLIENT', text: 'Какой минимальный заказ?' }],
  ...over,
});

const provider = (kind: 'reply' | 'escalate' | 'disabled' | 'error'): SupportAiProvider => ({
  decide: vi.fn(async () =>
    kind === 'reply' ? { kind: 'reply' as const, text: 'Минимум 30 литров.' } : { kind },
  ),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runAiTurn (провайдер замокан)', () => {
  it('ответ ИИ пишется в тред, статус → ANSWERED', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockedTicket() as never);
    await runAiTurn('t1', provider('reply'));

    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 't1', authorType: 'AI', text: 'Минимум 30 литров.' },
    });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'ANSWERED' },
    });
  });

  it('эскалация от ИИ поднимает needsHuman, сообщение не создаётся', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockedTicket() as never);
    await runAiTurn('t1', provider('escalate'));

    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { needsHuman: true, status: 'OPEN' },
    });
  });

  it('жалоба минует ИИ полностью — провайдер даже не вызывается', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(
      mockedTicket({ type: 'COMPLAINT' }) as never,
    );
    const p = provider('reply');
    await runAiTurn('t1', p);

    expect(p.decide).not.toHaveBeenCalled();
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it('после эскалации (needsHuman) ИИ молчит', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(
      mockedTicket({ needsHuman: true }) as never,
    );
    const p = provider('reply');
    await runAiTurn('t1', p);
    expect(p.decide).not.toHaveBeenCalled();
  });

  it('выключенный провайдер (нет ключа) ничего не меняет — режим «только админ»', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockedTicket() as never);
    await runAiTurn('t1', provider('disabled'));

    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it('сбой провайдера не трогает тикет (ждёт оператора)', async () => {
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockedTicket() as never);
    await runAiTurn('t1', provider('error'));

    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });
});
