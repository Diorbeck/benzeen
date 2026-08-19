import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { defaultDailyRate, validateDailyRate } from '@/lib/station-subscriptions';
import type { BillingItem } from '@/lib/station-billing';

// Модуль 7 ТЗ v2: управление подключениями и тарифами. Подключить или отключить
// резервуар/колонку в подписке АЗС может только Benzeen (SUPER_ADMIN) — это
// деньги, а не настройка объекта.
//
// Отключение не удаляет строку подписки, а закрывает её датой: уже выставленные
// счета должны оставаться пересчитываемыми.

export const dynamic = 'force-dynamic';

type Body = {
  stationId?: unknown;
  item?: unknown;
  targetId?: unknown;
  action?: unknown;
  dailyRateUzs?: unknown;
};

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'Malformed body' }, { status: 400 });
  }

  const stationId = typeof body.stationId === 'string' ? body.stationId : null;
  const targetId = typeof body.targetId === 'string' ? body.targetId : null;
  const item = body.item === 'TANK' || body.item === 'DISPENSER' ? (body.item as BillingItem) : null;
  const action = body.action === 'enable' || body.action === 'disable' ? body.action : null;
  if (!stationId || !targetId || !item || !action) {
    return Response.json({ error: 'stationId, targetId, item, action are required' }, { status: 400 });
  }

  // Объект должен принадлежать этой АЗС: иначе можно было бы подключить чужой
  // резервуар на счёт другой станции.
  const owned =
    item === 'TANK'
      ? await prisma.tank.findFirst({ where: { id: targetId, stationId }, select: { id: true } })
      : await prisma.dispenser.findFirst({
          where: { id: targetId, stationId },
          select: { id: true },
        });
  if (!owned) {
    return Response.json({ error: 'Target does not belong to the station' }, { status: 404 });
  }

  const now = new Date();
  const where =
    item === 'TANK'
      ? { stationId, item, tankId: targetId, endedAt: null }
      : { stationId, item, dispenserId: targetId, endedAt: null };

  if (action === 'disable') {
    const result = await prisma.stationBillingSubscription.updateMany({
      where,
      data: { endedAt: now },
    });
    return Response.json({ ok: true, closed: result.count });
  }

  const existing = await prisma.stationBillingSubscription.findFirst({
    where,
    select: { id: true, dailyRateUzs: true },
  });

  let dailyRateUzs = defaultDailyRate(item);
  if (body.dailyRateUzs !== undefined && body.dailyRateUzs !== null && body.dailyRateUzs !== '') {
    const parsed = validateDailyRate(body.dailyRateUzs);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    dailyRateUzs = parsed.dailyRateUzs;
  }

  // Уже подключён: смена ставки — это закрытие текущей строки и открытие новой,
  // чтобы в счёте были видны сутки по старой и по новой цене.
  if (existing) {
    if (existing.dailyRateUzs === dailyRateUzs) {
      return Response.json({ ok: true, unchanged: true, subscriptionId: existing.id });
    }
    const created = await prisma.$transaction(async (tx) => {
      await tx.stationBillingSubscription.update({
        where: { id: existing.id },
        data: { endedAt: now },
      });
      return tx.stationBillingSubscription.create({
        data: {
          stationId,
          item,
          tankId: item === 'TANK' ? targetId : null,
          dispenserId: item === 'DISPENSER' ? targetId : null,
          dailyRateUzs,
          startedAt: now,
        },
        select: { id: true },
      });
    });
    return Response.json({ ok: true, subscriptionId: created.id, rateChanged: true });
  }

  const created = await prisma.stationBillingSubscription.create({
    data: {
      stationId,
      item,
      tankId: item === 'TANK' ? targetId : null,
      dispenserId: item === 'DISPENSER' ? targetId : null,
      dailyRateUzs,
      startedAt: now,
    },
    select: { id: true },
  });
  return Response.json({ ok: true, subscriptionId: created.id });
}
