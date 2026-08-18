import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Живой поток данных с колонки в приложение клиента — Модуль 2 ТЗ v2:
// литры и сумма должны появляться на экране телефона синхронно с экраном
// колонки, задержка меньше двух секунд.
//
// Транспорт — Server-Sent Events, а не WebSocket. Поток здесь односторонний
// (сервер → телефон), SSE переживает смену сети и сам переподключается, и он
// работает через любой прокси, тогда как WebSocket на мобильном интернете в
// Узбекистане приходится ещё и обходить. Обмен с самим контроллером АЗС — это
// отдельный канал (MQTT/WebSocket), и он от этого выбора не зависит.
//
// Опрос базы раз в секунду — сознательное упрощение MVP: событийная шина
// появится вместе с реальной нагрузкой, а сейчас она добавила бы инфраструктуру,
// которую некому обслуживать.

const POLL_MS = 1000;
const MAX_LIFETIME_MS = 20 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  const userId = (auth?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const owned = await prisma.fuelingSession.findFirst({
    where: { id, clientId: userId },
    select: { id: true },
  });
  if (!owned) {
    return new Response('Not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastPayload = '';

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const s = await prisma.fuelingSession.findUnique({
            where: { id },
            select: {
              id: true,
              status: true,
              fuelType: true,
              priceUzs: true,
              holdAmountUzs: true,
              limitLiters: true,
              litersDispensed: true,
              amountUzs: true,
              refundUzs: true,
              cashbackUzs: true,
              lastTickAt: true,
              endedAt: true,
              dispenser: { select: { number: true } },
              station: { select: { name: true } },
            },
          });
          if (!s) {
            send('error', { error: 'Сессия не найдена' });
            controller.close();
            return;
          }

          const payload = JSON.stringify(s);
          // Шлём только изменения: телефон в кармане не должен получать
          // одинаковый пакет каждую секунду.
          if (payload !== lastPayload) {
            lastPayload = payload;
            send('state', s);
          } else {
            // Комментарий-пульс держит соединение живым через прокси.
            controller.enqueue(encoder.encode(': ping\n\n'));
          }

          const finished =
            s.status === 'SETTLED' || s.status === 'CANCELLED' || s.status === 'MANUAL_REVIEW';
          if (finished || Date.now() - startedAt > MAX_LIFETIME_MS) {
            send('done', { status: s.status });
            controller.close();
          }
        } catch {
          // База мигнула — поток не рвём, следующий тик попробует снова.
        }
      };

      await poll();
      timer = setInterval(poll, POLL_MS);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
