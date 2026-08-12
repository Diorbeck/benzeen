// Order dispatch helpers shared between the bot webhook and the REST API.
//
// Centralizes two things:
//   1. Building the human-readable order summary used in Telegram messages.
//   2. Notifying available couriers when an order becomes "live" (RECEIVED).
//
// All Telegram calls are fire-and-forget and degrade to no-ops when the bot is
// unconfigured, so order mutations are never blocked by a Telegram outage.

import * as Sentry from '@sentry/nextjs';
import { prisma } from './prisma';
import { createNotification } from './notifications';
import { haversineKm } from './geo';
import {
  COURIER_LOCATION_MAX_AGE_MS,
  DISPATCH_NEAREST_COUNT,
  DISPATCH_STALE_AFTER_MS,
  SCHEDULE_ACTIVATE_WINDOW_MS,
} from './constants';
import {
  sendTelegramMessage,
  getMiniAppUrl,
  FUEL_LABEL_RU,
  escapeHtml,
  type InlineKeyboardMarkup,
} from './telegram';

interface OrderForSummary {
  fuelType: string;
  volume: number;
  isFullTank: boolean;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  // B2B orders carry `car`; B2C orders carry `clientCar` (+ client phone).
  car?: { plateNumber: string } | null;
  clientCar?: { plate: string } | null;
  clientPhone?: string | null;
  // B2C scheduled orders carry the planned delivery time.
  scheduledFor?: Date | null;
}

/** Yandex.Maps deep link to a point (lng,lat is the order Yandex expects). */
function mapUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`;
}

/** Formats a delivery time in Tashkent local time, e.g. "07.08 в 14:30". */
export function formatDeliveryTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')} в ${get('hour')}:${get('minute')}`;
}

/**
 * Builds the multi-line order summary shown to drivers and couriers.
 *
 * FUEL and LITERS are bold; the delivery address renders as a tappable map link
 * (when coordinates are known) and the client phone as a `tel:` link. Scheduled
 * orders show the planned delivery time prominently at the top. All dynamic
 * values are HTML-escaped for Telegram's HTML parse mode.
 */
export function orderSummary(order: OrderForSummary): string {
  const fuel = FUEL_LABEL_RU[order.fuelType] ?? order.fuelType;
  const volume = order.isFullTank
    ? `полный бак (${order.volume} л)`
    : `${order.volume} л`;
  const plate = order.car?.plateNumber ?? order.clientCar?.plate ?? '—';

  const lines: string[] = [];

  // Scheduled orders: surface the delivery time first, prominently.
  if (order.scheduledFor) {
    lines.push(`⏰ <b>К ${formatDeliveryTime(order.scheduledFor)}</b>`, '');
  }

  lines.push(
    `Машина: <b>${escapeHtml(plate)}</b>`,
    `Топливо: <b>${escapeHtml(fuel)}</b>`,
    `Объём: <b>${escapeHtml(volume)}</b>`,
  );

  if (order.clientPhone) {
    const digits = order.clientPhone.replace(/[^\d+]/g, '');
    lines.push(
      `Клиент: <a href="tel:${escapeHtml(digits)}">${escapeHtml(order.clientPhone)}</a>`,
    );
  }

  if (order.address) {
    const hasCoords = order.lat != null && order.lng != null;
    lines.push(
      hasCoords
        ? `Адрес: <a href="${mapUrl(order.lat!, order.lng!)}">${escapeHtml(order.address)}</a>`
        : `Адрес: ${escapeHtml(order.address)}`,
    );
  } else if (order.lat != null && order.lng != null) {
    lines.push(`Карта: <a href="${mapUrl(order.lat, order.lng)}">открыть на карте</a>`);
  }

  return lines.join('\n');
}

/**
 * Eligible couriers for a new-order offer (Курьер 2.0): linked Telegram account,
 * currently ON DUTY, AND a live location fresher than COURIER_LOCATION_MAX_AGE_MS.
 * Off-duty couriers and couriers whose location has gone stale are excluded from
 * every dispatch path (nearest geo-dispatch and the broadcast backstop).
 */
async function eligibleCourierLocations(): Promise<
  { chatId: string; lat: number; lng: number }[]
> {
  const since = new Date(Date.now() - COURIER_LOCATION_MAX_AGE_MS);
  const locations = await prisma.courierLocation.findMany({
    where: {
      updatedAt: { gte: since },
      courier: {
        role: 'COURIER',
        telegramId: { not: null },
        onDuty: true,
        // Курьер 2.0 admin: deactivated couriers never receive new orders.
        deactivatedAt: null,
      },
    },
    include: { courier: { select: { telegramId: true } } },
  });
  return locations.map((l) => ({ chatId: l.courier.telegramId!, lat: l.lat, lng: l.lng }));
}

/**
 * Notifies eligible couriers (on-duty + fresh live location) about a new live
 * order. Each gets a "Взять заказ" inline button (callback take:<orderId>).
 */
export async function notifyCouriersNewOrder(orderId: string): Promise<void> {
  const eligible = await eligibleCourierLocations();
  if (eligible.length === 0) return;
  await notifyCouriers(
    orderId,
    eligible.map((c) => c.chatId),
  );
}

/**
 * Клиентская отмена: если заказ уже рассылался курьерам (статус RECEIVED),
 * сообщаем той же аудитории (on-duty + свежая геолокация), что заказ снят.
 */
export async function notifyCouriersOrderCancelled(orderId: string): Promise<void> {
  const eligible = await eligibleCourierLocations();
  if (eligible.length === 0) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, volume: true, fuelType: true, address: true },
  });
  if (!order) return;
  const text =
    `❌ <b>Заказ отменён клиентом</b>\n\n` +
    `${order.fuelType.replace('_', '-')} · ${order.volume} л` +
    (order.address ? `\n📍 ${order.address}` : '');
  await Promise.all(
    eligible.map((c) => sendTelegramMessage(c.chatId, text).catch(() => null)),
  );
}

/** Sends the "new order" offer (with a Взять button) to specific courier chats. */
async function notifyCouriers(orderId: string, chatIds: string[]): Promise<void> {
  if (chatIds.length === 0) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      car: { select: { plateNumber: true } },
      clientCar: { select: { plate: true } },
      client: { select: { phone: true } },
    },
  });
  if (!order) return;

  const text =
    `🆕 <b>Новый заказ</b>\n\n` +
    orderSummary({
      fuelType: order.fuelType,
      volume: order.volume,
      isFullTank: order.isFullTank,
      address: order.address,
      lat: order.lat,
      lng: order.lng,
      car: order.car,
      clientCar: order.clientCar,
      clientPhone: order.client?.phone,
      scheduledFor: order.scheduledFor,
    });

  const miniAppUrl = getMiniAppUrl();
  const markup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: '✅ Взять заказ', callback_data: `take:${order.id}` }],
      ...(miniAppUrl
        ? [[{ text: '📋 Мои заказы', web_app: { url: miniAppUrl } }]]
        : []),
    ],
  };

  for (const chatId of chatIds) {
    void sendTelegramMessage(chatId, text, markup);
  }
}

/**
 * B2C geo-dispatch: offer a freshly-created RECEIVED order to the N on-duty
 * couriers with the freshest live location, nearest first (haversine). Off-duty
 * couriers and stale locations are skipped (see eligibleCourierLocations).
 *
 * When NO courier is eligible the order is left untouched in RECEIVED — the
 * activity/cron redispatch path (redispatchStale) re-offers it once a courier
 * comes on shift, so it is never lost — and a Sentry "no couriers on duty"
 * warning is emitted so operators are alerted. Returns the number of couriers
 * offered the order (0 when none were eligible).
 */
export async function dispatchB2COrderToNearest(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { lat: true, lng: true },
  });
  if (!order || order.lat == null || order.lng == null) return 0;

  const eligible = await eligibleCourierLocations();
  if (eligible.length === 0) {
    // No on-duty courier with a fresh location. Do NOT fail/unassign the order —
    // it stays RECEIVED for redispatchStale to pick up. Alert operators via
    // Sentry (alerts are already enabled). No operator Telegram channel exists
    // in the codebase, so we don't post there.
    Sentry.captureMessage('no couriers on duty', {
      level: 'warning',
      tags: { area: 'dispatch', orderType: 'b2c' },
      extra: { orderId },
    });
    return 0;
  }

  const origin = { lat: order.lat, lng: order.lng };
  const nearest = eligible
    .map((l) => ({ chatId: l.chatId, dist: haversineKm(origin, { lat: l.lat, lng: l.lng }) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, DISPATCH_NEAREST_COUNT);

  await notifyCouriers(orderId, nearest.map((n) => n.chatId));
  return nearest.length;
}

/**
 * Marks an order as live (RECEIVED) and notifies couriers. Used after a driver
 * confirms + shares location in the bot, or after a manager approves a full
 * tank. No-op if the order isn't in a state that can go live.
 */
export async function dispatchOrder(orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'RECEIVED', botPhase: null },
  });
  await notifyCouriersNewOrder(orderId);
}

/**
 * Backstop for B2C orders that nobody took after the initial nearest-courier
 * offer: broadcast them to ALL couriers, once (`botPhase` marker prevents
 * re-notifying). Same query the daily cron runs — but this is also called on
 * ordinary system activity (a new B2C order, a courier taking a job), so stale
 * orders get re-dispatched in near-real-time without a paid sub-daily cron.
 *
 * Fire-and-forget friendly: never throws, returns how many were broadcast.
 */
export async function redispatchStale(): Promise<number> {
  try {
    // (a) Activate SCHEDULED orders whose window is now open (<= now + 30 min):
    // flip to RECEIVED and geo-dispatch to the nearest couriers.
    const dueBy = new Date(Date.now() + SCHEDULE_ACTIVATE_WINDOW_MS);
    const due = await prisma.order.findMany({
      where: { status: 'SCHEDULED', clientId: { not: null }, scheduledFor: { lte: dueBy } },
      select: { id: true },
      take: 50,
    });
    for (const o of due) {
      await prisma.order.update({ where: { id: o.id }, data: { status: 'RECEIVED', botPhase: null } });
      await dispatchB2COrderToNearest(o.id);
    }

    // (b) Broadcast RECEIVED B2C orders nobody took after the nearest offer.
    const cutoff = new Date(Date.now() - DISPATCH_STALE_AFTER_MS);
    const stale = await prisma.order.findMany({
      where: {
        status: 'RECEIVED',
        assignedToId: null,
        clientId: { not: null },
        botPhase: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: 50,
    });

    for (const o of stale) {
      await prisma.order.update({ where: { id: o.id }, data: { botPhase: 'BROADCAST' } });
      await notifyCouriersNewOrder(o.id);
    }
    return stale.length;
  } catch (e) {
    console.error('[redispatchStale] error:', e);
    return 0;
  }
}

/**
 * Puts a full-tank order into the manager-approval queue (PENDING_APPROVAL) and
 * notifies the company's admins. Couriers are NOT notified until a manager
 * approves (see dispatchOrder).
 */
export async function requestFullTankApproval(orderId: string): Promise<void> {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PENDING_APPROVAL', botPhase: null },
    include: { car: { select: { plateNumber: true, companyId: true } } },
  });

  if (!order.car) return; // full-tank approval is a B2B-only flow
  const admins = await prisma.user.findMany({
    where: { role: 'COMPANY_ADMIN', companyId: order.car.companyId },
    select: { id: true },
  });
  for (const a of admins) {
    await createNotification({
      userId: a.id,
      type: 'FULL_TANK_PENDING',
      title: 'Full tank approval',
      message: `${order.car.plateNumber}: запрос на полный бак (${order.volume} л) ожидает согласования`,
      orderId: order.id,
    });
  }
}
