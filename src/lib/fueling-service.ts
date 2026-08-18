// Сценарий заправки на стационарной АЗС от резерва до чека — Модули 2 и 4 ТЗ v2.
//
// Здесь только работа с базой и вызовы эквайринга. Вся арифметика денег живёт в
// lib/fueling.ts и покрыта тестами; здесь она не дублируется.

import type { FuelType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAcquirer, AcquiringError } from '@/lib/acquiring';
import {
  applyTick,
  decideStale,
  FuelingError,
  planHold,
  settle,
  type FuelingRequest,
} from '@/lib/fueling';
import { aggregateStocks, isStationOnline } from '@/lib/stations';

export type StartInput = FuelingRequest & {
  clientId: string;
  stationId: string;
  /** Номер колонки, как он написан на объекте. */
  dispenserNumber: number;
  fuelType: FuelType;
  /** Токен карты на стороне банка. Номер карты у нас не появляется. */
  cardToken: string;
  /** Как определили клиента у колонки: вручную, по BLE-маячку или камерой. */
  identifiedBy?: 'MANUAL' | 'BLE' | 'CAMERA';
  carId?: string | null;
};

/**
 * Резерв перед заливкой.
 *
 * Порядок шагов важен: сначала проверки и цена, потом холд в банке, и только
 * потом запись сессии. Обратный порядок оставлял бы в базе «оплаченные» заправки,
 * которые банк не подтвердил.
 */
export async function startFuelingSession(input: StartInput) {
  const station = await prisma.fuelStation.findUnique({
    where: { id: input.stationId },
    select: {
      id: true,
      status: true,
      lastSeenAt: true,
      tanks: {
        where: { status: 'ACTIVE' },
        select: {
          fuelType: true,
          capacityL: true,
          currentLevelL: true,
          lastReadingAt: true,
          minLevelL: true,
          status: true,
        },
      },
      prices: { select: { fuelType: true, priceUzs: true } },
      dispensers: {
        where: { number: input.dispenserNumber },
        select: { id: true, status: true, fuelTypes: true, identificationMode: true },
      },
    },
  });

  if (!station || station.status !== 'ACTIVE') {
    throw new FuelingError('BAD_REQUEST', 'АЗС недоступна');
  }
  if (!isStationOnline(station.lastSeenAt)) {
    // Резерв на объекте без связи означал бы замороженные деньги без заправки.
    throw new FuelingError('BAD_REQUEST', 'АЗС не на связи — заправка невозможна');
  }

  const dispenser = station.dispensers[0];
  if (!dispenser || dispenser.status !== 'ACTIVE') {
    throw new FuelingError('BAD_REQUEST', 'Колонка недоступна');
  }
  if (dispenser.fuelTypes.length > 0 && !dispenser.fuelTypes.includes(input.fuelType)) {
    throw new FuelingError('BAD_REQUEST', 'Эта колонка не отпускает выбранное топливо');
  }

  // Одна активная сессия на колонку: две заправки одновременно из одного
  // пистолета — это гарантированный спор о том, чьи литры на счётчике.
  const busy = await prisma.fuelingSession.findFirst({
    where: { dispenserId: dispenser.id, status: { in: ['RESERVED', 'FLOWING'] } },
    select: { id: true },
  });
  if (busy) {
    throw new FuelingError('DISPENSER_BUSY', 'Колонка занята другой заправкой');
  }

  const price = station.prices.find((p) => p.fuelType === input.fuelType)?.priceUzs ?? 0;
  const stock = aggregateStocks(station.tanks).find((s) => s.fuelType === input.fuelType);
  const available = stock?.dataFresh ? stock.litersAvailable : 0;

  const plan = planHold(
    { liters: input.liters ?? null, amountUzs: input.amountUzs ?? null, fullTank: input.fullTank },
    price,
    available,
  );

  const acquirer = getAcquirer();
  const held = await acquirer.hold({
    sessionId: `${input.stationId}-${Date.now()}`,
    amountUzs: plan.holdAmountUzs,
    cardToken: input.cardToken,
    description: `Benzeen: заправка, колонка №${input.dispenserNumber}`,
  });

  return prisma.fuelingSession.create({
    data: {
      stationId: station.id,
      dispenserId: dispenser.id,
      clientId: input.clientId,
      carId: input.carId ?? null,
      fuelType: input.fuelType,
      requestedLiters: input.liters != null ? Math.round(input.liters) : null,
      requestedAmountUzs: input.amountUzs != null ? Math.round(input.amountUzs) : null,
      holdAmountUzs: plan.holdAmountUzs,
      priceUzs: price,
      limitLiters: plan.limitLiters,
      status: 'RESERVED',
      identifiedBy: input.identifiedBy ?? 'MANUAL',
      acquirerRef: held.acquirerRef,
    },
    select: {
      id: true,
      status: true,
      holdAmountUzs: true,
      priceUzs: true,
      limitLiters: true,
      fuelType: true,
      startedAt: true,
    },
  });
}

export type TickInput = {
  stationId: string;
  dispenserNumber: number;
  liters: number;
  amountUzs?: number | null;
  /** Пистолет вынут, колонка отдала итог. */
  finished?: boolean;
  /** Тик пришёл из буфера контроллера после восстановления связи. */
  buffered?: boolean;
};

/**
 * Тик с колонки: литры и сумма в момент заправки.
 *
 * Возвращает состояние, которое сразу уходит клиенту в приложение — экран должен
 * совпадать с экраном колонки, иначе клиент верит колонке, а не нам.
 */
export async function recordDispenserTick(input: TickInput) {
  const session = await prisma.fuelingSession.findFirst({
    where: {
      stationId: input.stationId,
      dispenser: { number: input.dispenserNumber },
      status: { in: ['RESERVED', 'FLOWING'] },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      priceUzs: true,
      limitLiters: true,
      holdAmountUzs: true,
      acquirerRef: true,
      status: true,
    },
  });

  if (!session) return null;

  const state = applyTick(
    { liters: input.liters, amountUzs: input.amountUzs ?? null },
    session.priceUzs,
    session.limitLiters ?? input.liters,
  );

  await prisma.fuelingSession.update({
    where: { id: session.id },
    data: {
      status: 'FLOWING',
      litersDispensed: state.liters,
      amountUzs: state.amountUzs,
      lastTickAt: new Date(),
      offlineBuffered: input.buffered ? true : undefined,
    },
  });

  if (input.finished || state.limitReached) {
    const settled = await settleFuelingSession(session.id);
    return { sessionId: session.id, ...state, settled };
  }

  return { sessionId: session.id, ...state, settled: null };
}

/**
 * Закрытие сессии: точное списание по факту и возврат разницы.
 *
 * Идемпотентно по статусу — контроллер вправе повторить финальный пакет, если не
 * дождался ответа, и повторная попытка не должна списать деньги дважды.
 */
export async function settleFuelingSession(sessionId: string) {
  const session = await prisma.fuelingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      litersDispensed: true,
      priceUzs: true,
      holdAmountUzs: true,
      acquirerRef: true,
    },
  });
  if (!session) throw new FuelingError('BAD_REQUEST', 'Сессия не найдена');
  if (session.status === 'SETTLED' || session.status === 'CANCELLED') {
    return { alreadySettled: true as const };
  }

  const result = settle(session.litersDispensed ?? 0, session.priceUzs, session.holdAmountUzs);
  const acquirer = getAcquirer();

  try {
    if (result.captureUzs > 0) {
      await acquirer.capture(session.acquirerRef ?? '', result.captureUzs);
    } else if (session.acquirerRef) {
      // Ни литра не отпущено — резерв размораживается целиком.
      await acquirer.release(session.acquirerRef);
    }
  } catch (e) {
    const code = e instanceof AcquiringError ? e.code : 'PROVIDER_UNAVAILABLE';
    await prisma.fuelingSession.update({
      where: { id: session.id },
      data: { status: code === 'ALREADY_SETTLED' ? 'SETTLED' : 'MANUAL_REVIEW', endedAt: new Date() },
    });
    throw e;
  }

  const updated = await prisma.fuelingSession.update({
    where: { id: session.id },
    data: {
      status: 'SETTLED',
      amountUzs: result.captureUzs,
      refundUzs: result.refundUzs,
      // Кешбек начислен нами; отметка о передаче чека в Солик появится, когда
      // будет доступ к их API (Модуль 5).
      cashbackUzs: result.cashbackUzs,
      endedAt: new Date(),
    },
    select: {
      id: true,
      litersDispensed: true,
      amountUzs: true,
      refundUzs: true,
      cashbackUzs: true,
      status: true,
    },
  });

  return { alreadySettled: false as const, ...updated };
}

/** Отмена клиентом до начала заливки: резерв размораживается. */
export async function cancelFuelingSession(sessionId: string, clientId: string) {
  const session = await prisma.fuelingSession.findFirst({
    where: { id: sessionId, clientId },
    select: { id: true, status: true, acquirerRef: true, litersDispensed: true },
  });
  if (!session) throw new FuelingError('BAD_REQUEST', 'Сессия не найдена');
  if (session.status === 'CANCELLED') return { status: 'CANCELLED' as const };
  if ((session.litersDispensed ?? 0) > 0) {
    throw new FuelingError('BAD_REQUEST', 'Заливка уже началась — отменить нельзя');
  }

  if (session.acquirerRef) {
    await getAcquirer().release(session.acquirerRef);
  }
  await prisma.fuelingSession.update({
    where: { id: session.id },
    data: { status: 'CANCELLED', endedAt: new Date() },
  });
  return { status: 'CANCELLED' as const };
}

/**
 * Разбор зависших сессий. Вызывается по расписанию.
 *
 * Без этого обхода деньги клиента остаются замороженными после любого сбоя связи —
 * ровно то, чего продукт обещает не делать.
 */
export async function sweepStaleFuelingSessions(now: Date = new Date()) {
  const stuck = await prisma.fuelingSession.findMany({
    where: { status: { in: ['RESERVED', 'FLOWING'] } },
    select: {
      id: true,
      status: true,
      startedAt: true,
      lastTickAt: true,
      litersDispensed: true,
      acquirerRef: true,
    },
  });

  const result = { cancelled: 0, settled: 0, manualReview: 0, kept: 0 };

  for (const s of stuck) {
    const decision = decideStale(
      {
        status: s.status as 'RESERVED' | 'FLOWING',
        startedAt: s.startedAt,
        lastTickAt: s.lastTickAt,
        litersDispensed: s.litersDispensed,
      },
      now,
    );

    if (decision.action === 'KEEP') {
      result.kept += 1;
      continue;
    }

    if (decision.action === 'CANCEL') {
      if (s.acquirerRef) {
        await getAcquirer()
          .release(s.acquirerRef)
          .catch(() => undefined);
      }
      await prisma.fuelingSession.update({
        where: { id: s.id },
        data: { status: 'CANCELLED', endedAt: now },
      });
      result.cancelled += 1;
      continue;
    }

    if (decision.action === 'COMPLETE') {
      await settleFuelingSession(s.id).catch(() => undefined);
      result.settled += 1;
      continue;
    }

    // Связь не вернулась: резерв размораживается, заливка уходит на сверку по
    // логу колонки — так решено в ТЗ, Модуль 4.
    if (s.acquirerRef) {
      await getAcquirer()
        .release(s.acquirerRef)
        .catch(() => undefined);
    }
    await prisma.fuelingSession.update({
      where: { id: s.id },
      data: { status: 'MANUAL_REVIEW', endedAt: now },
    });
    result.manualReview += 1;
  }

  return result;
}

/** История заправок клиента: чек по каждой — объём, сумма, АЗС, дата. */
export async function clientFuelingHistory(clientId: string, take = 50) {
  return prisma.fuelingSession.findMany({
    where: { clientId, status: { in: ['SETTLED', 'MANUAL_REVIEW', 'CANCELLED'] } },
    orderBy: { startedAt: 'desc' },
    take,
    select: {
      id: true,
      fuelType: true,
      litersDispensed: true,
      amountUzs: true,
      refundUzs: true,
      cashbackUzs: true,
      priceUzs: true,
      status: true,
      startedAt: true,
      endedAt: true,
      station: { select: { name: true, address: true } },
      dispenser: { select: { number: true } },
    },
  });
}
