import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getBotToken,
  getMiniAppUrl,
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
  type InlineKeyboardMarkup,
  type ReplyKeyboardMarkup,
  type ReplyKeyboardRemove,
} from '@/lib/telegram';
import {
  orderSummary,
  dispatchOrder,
  requestFullTankApproval,
} from '@/lib/order-dispatch';
import { applyCourierAction, courierOrderActions } from '@/lib/courier-actions';
import { createNotification } from '@/lib/notifications';
import { COURIER_LOCATION_MAX_AGE_MS } from '@/lib/constants';
import {
  computeBucket,
  formatAvgDuration,
  startOfTashkentDay,
  startOfLast7Days,
} from '@/lib/courier-stats';

export const runtime = 'nodejs';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

// Courier shift reply-keyboard buttons (Курьер 2.0). Tapping a button sends its
// text as a normal message, which handleText routes to the duty toggle.
const COURIER_ON_DUTY_BTN = '🟢 На смене';
const COURIER_OFF_DUTY_BTN = '🔴 Завершить смену';

// Polite onboarding reply for someone hitting a courier-only surface without a
// courier account. No system internals — just points them to an admin.
const COURIER_ONBOARDING_TEXT =
  'Похоже, у вас пока нет доступа курьера.\n\n' +
  'Пожалуйста, попросите администратора создать вам доступ.';

/** Persistent reply keyboard shown to couriers: shift toggle + stats hint. */
function courierDutyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: COURIER_ON_DUTY_BTN }, { text: COURIER_OFF_DUTY_BTN }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Step-by-step prompt to turn on Telegram live-location sharing. */
function liveLocationHelpText(): string {
  return (
    '📍 <b>Как включить трансляцию геопозиции:</b>\n' +
    '1. Нажмите скрепку 📎 (или «+») в этом чате.\n' +
    '2. Выберите «Геопозиция».\n' +
    '3. Нажмите «Транслировать мою геопозицию» и выберите срок (например, 8 часов).\n\n' +
    'Пока вы не транслируете геопозицию, новые заказы приходить не будут.'
  );
}

interface TgMessage {
  message_id?: number;
  chat?: { id?: number };
  from?: { id?: number };
  text?: string;
  location?: { latitude: number; longitude: number };
}

interface TgUpdate {
  message?: TgMessage;
  // Live-location updates arrive as edits to the original location message.
  edited_message?: TgMessage;
  callback_query?: {
    id: string;
    from?: { id?: number };
    message?: { message_id?: number; chat?: { id?: number } };
    data?: string;
  };
}

export async function POST(req: Request) {
  if (!getBotToken()) {
    return NextResponse.json({ ok: true });
  }

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get(SECRET_HEADER);
    if (got !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.edited_message?.location) {
      // Live-location update (courier sharing movement) — refresh only, no reply.
      await handleLocation(update.edited_message, true);
    } else if (update.message?.location) {
      await handleLocation(update.message, false);
    } else if (update.message) {
      await handleText(update.message);
    }
  } catch (e) {
    console.error('[telegram] webhook handler error:', e);
  }

  return NextResponse.json({ ok: true });
}

async function handleText(message: NonNullable<TgUpdate['message']>) {
  const chatId = message.chat?.id;
  const text = (message.text || '').trim();
  if (!chatId) return;
  const fromId = message.from?.id ?? chatId;

  // Courier shift toggle (reply-keyboard buttons).
  if (text === COURIER_ON_DUTY_BTN) {
    await handleDutyToggle(chatId, fromId, true);
    return;
  }
  if (text === COURIER_OFF_DUTY_BTN) {
    await handleDutyToggle(chatId, fromId, false);
    return;
  }

  if (text.startsWith('/stats')) {
    await handleStatsCommand(chatId, fromId);
    return;
  }

  if (text.startsWith('/orders')) {
    await handleOrdersCommand(chatId, fromId);
    return;
  }

  if (!text.startsWith('/start')) return;

  // Known couriers get the shift keyboard; everyone else keeps the existing
  // B2C welcome (this bot is shared with clients, so /start must not gate them).
  const courier = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { role: true },
  });
  if (courier?.role === 'COURIER') {
    await sendTelegramMessage(
      chatId,
      'Добро пожаловать, курьер! 🚚\n\n' +
        'Нажмите <b>«На смене»</b>, чтобы начать получать заказы, и включите трансляцию геопозиции.\n' +
        'Команды: /orders — активные заказы, /stats — ваша статистика.',
      courierDutyKeyboard(),
    );
    return;
  }

  const miniAppUrl = getMiniAppUrl();
  const replyMarkup: InlineKeyboardMarkup | undefined = miniAppUrl
    ? { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url: miniAppUrl } }]] }
    : undefined;

  await sendTelegramMessage(
    chatId,
    'Добро пожаловать в <b>Benzeen</b>!\n\nНажмите кнопку ниже, чтобы открыть приложение.',
    replyMarkup,
  );
}

/**
 * Toggles a courier's on/off duty flag (Курьер 2.0).
 *  - ON DUTY: mark onDuty=true. If there's no fresh live location, still mark
 *    them on-duty but clearly tell them they won't get orders until they share
 *    live location (step-by-step prompt).
 *  - OFF DUTY: mark onDuty=false. If they still have an active order it STAYS
 *    assigned to them — we only warn them to finish it.
 * Non-couriers / unlinked users get the polite onboarding message.
 */
async function handleDutyToggle(chatId: number, fromId: number, onDuty: boolean) {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'COURIER') {
    await sendTelegramMessage(chatId, COURIER_ONBOARDING_TEXT);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { onDuty } });

  if (onDuty) {
    const loc = await prisma.courierLocation.findUnique({
      where: { courierId: user.id },
      select: { updatedAt: true },
    });
    const freshLoc =
      loc && Date.now() - loc.updatedAt.getTime() <= COURIER_LOCATION_MAX_AGE_MS;
    if (freshLoc) {
      await sendTelegramMessage(
        chatId,
        '🟢 Вы <b>на смене</b>. Ожидайте новые заказы — они придут сюда.',
        courierDutyKeyboard(),
      );
    } else {
      // On-duty, but no usable location yet — be explicit that no orders will
      // come until they start sharing live location.
      await sendTelegramMessage(
        chatId,
        '🟢 Вы <b>на смене</b>, но мы пока не видим вашу геопозицию.\n\n' +
          liveLocationHelpText(),
        courierDutyKeyboard(),
      );
    }
    return;
  }

  // Going OFF duty: the order (if any) stays assigned — just warn.
  const activeCount = await prisma.order.count({
    where: {
      assignedToId: user.id,
      status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] },
    },
  });
  let msg = '🔴 Вы <b>завершили смену</b>. Новые заказы поступать не будут.';
  if (activeCount > 0) {
    msg +=
      `\n\n⚠️ У вас ${activeCount === 1 ? 'есть незакрытый заказ' : `есть незакрытые заказы (${activeCount})`}. ` +
      'Он остаётся за вами — пожалуйста, завершите доставку.';
  }
  await sendTelegramMessage(chatId, msg, courierDutyKeyboard());
}

/**
 * /stats — the courier's OWN delivery stats for today and the last 7 days:
 * delivered count, total liters, and average TAKE→DELIVERED time (only over
 * orders that have both timestamps). No other courier's numbers are shown.
 */
async function handleStatsCommand(chatId: number, fromId: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'COURIER') {
    await sendTelegramMessage(chatId, COURIER_ONBOARDING_TEXT);
    return;
  }

  const now = new Date();
  const todayStart = startOfTashkentDay(now);
  const weekStart = startOfLast7Days(now);

  const rows = await prisma.order.findMany({
    where: {
      assignedToId: user.id,
      status: 'DELIVERED',
      deliveredAt: { gte: weekStart },
    },
    select: { deliveredAt: true, takenAt: true, dispensedVolume: true },
  });

  const week = computeBucket(rows);
  const today = computeBucket(
    rows.filter((r) => r.deliveredAt != null && r.deliveredAt >= todayStart),
  );

  const block = (title: string, b: ReturnType<typeof computeBucket>) =>
    `<b>${title}</b>\n` +
    `• Доставлено: <b>${b.count}</b>\n` +
    `• Литров: <b>${b.liters}</b>\n` +
    `• Среднее время (взял → доставил): <b>${formatAvgDuration(b.avgTakeToDeliverMs)}</b>`;

  await sendTelegramMessage(
    chatId,
    `📊 <b>Ваша статистика</b>\n\n` +
      block('Сегодня', today) +
      '\n\n' +
      block('За 7 дней', week),
  );
}

/**
 * /orders — lists the courier's ACTIVE orders (COURIER_ASSIGNED / IN_DELIVERY),
 * each as its own card with the same next-step action button as the live order
 * card (Выехал → Доставлено). Read-only aside from letting the courier advance
 * the order via the shared action buttons.
 */
async function handleOrdersCommand(chatId: number, fromId: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'COURIER') {
    await sendTelegramMessage(chatId, COURIER_ONBOARDING_TEXT);
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      assignedToId: user.id,
      status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      car: { select: { plateNumber: true } },
      clientCar: { select: { plate: true } },
      client: { select: { phone: true } },
    },
  });

  if (orders.length === 0) {
    await sendTelegramMessage(chatId, '📭 У вас нет активных заказов.');
    return;
  }

  await sendTelegramMessage(
    chatId,
    `📋 <b>Активные заказы: ${orders.length}</b>`,
  );

  for (const order of orders) {
    const stage = order.status === 'IN_DELIVERY' ? '🛣️ В пути' : '🚚 Назначен';
    const text =
      `${stage}\n\n` +
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
    await sendTelegramMessage(chatId, text, courierOrderActions(order));
  }
}

async function handleCallback(cq: NonNullable<TgUpdate['callback_query']>) {
  const fromId = cq.from?.id;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const data = cq.data || '';
  if (!fromId) {
    await answerCallbackQuery(cq.id);
    return;
  }

  const [verb, orderId] = data.split(':');
  if (!verb || !orderId) {
    await answerCallbackQuery(cq.id);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true, role: true },
  });
  if (!user) {
    await answerCallbackQuery(cq.id, 'Аккаунт не привязан');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      car: { select: { plateNumber: true } },
      clientCar: { select: { plate: true } },
      client: { select: { phone: true } },
    },
  });
  if (!order) {
    await answerCallbackQuery(cq.id, 'Заказ не найден');
    return;
  }

  // Courier order card, mapped from the fetched order (bold fuel/liters, map
  // link, tel: link, scheduled time). Reused by the take + on-route cards.
  const courierCard = () =>
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

  if (verb === 'take') {
    if (user.role !== 'COURIER') {
      await answerCallbackQuery(cq.id, 'Только для курьеров');
      return;
    }
    const result = await applyCourierAction(user.id, orderId, 'TAKE');
    if (!result.ok) {
      await answerCallbackQuery(cq.id, result.error);
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `❌ ${result.error}\n\n` + courierCard(),
        );
      }
      return;
    }
    await answerCallbackQuery(cq.id, 'Заказ взят');
    // Remind the courier to share live location if we don't have a fresh fix —
    // clients track the courier on the map (M3) and geo-dispatch needs it.
    let takeExtra = '';
    const loc = await prisma.courierLocation.findUnique({
      where: { courierId: user.id },
      select: { updatedAt: true },
    });
    const freshLoc = loc && Date.now() - loc.updatedAt.getTime() <= COURIER_LOCATION_MAX_AGE_MS;
    if (!freshLoc) {
      takeExtra =
        '\n\n📍 Включите трансляцию геопозиции (скрепка → Геопозиция → Транслировать), чтобы клиент видел вас на карте.';
    }
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `✅ <b>Вы взяли заказ</b>\n\n` + courierCard() + takeExtra,
        courierOrderActions({ id: order.id, status: 'COURIER_ASSIGNED' }),
      );
    }
    return;
  }

  if (verb === 'on_route') {
    if (user.role !== 'COURIER') {
      await answerCallbackQuery(cq.id, 'Только для курьеров');
      return;
    }
    const result = await applyCourierAction(user.id, orderId, 'ON_ROUTE');
    if (!result.ok) {
      await answerCallbackQuery(cq.id, result.error);
      return;
    }
    await answerCallbackQuery(cq.id, 'В пути');
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `🛣️ <b>Вы в пути к клиенту</b>\n\n` + courierCard(),
        courierOrderActions({ id: order.id, status: 'IN_DELIVERY' }),
      );
    }
    return;
  }

  if (verb === 'delivered') {
    // Fallback when the Mini App URL is unset: liters are entered in the app,
    // which owns the money/limit logic. Just point the courier there.
    if (user.role !== 'COURIER') {
      await answerCallbackQuery(cq.id, 'Только для курьеров');
      return;
    }
    await answerCallbackQuery(cq.id, 'Укажите литры в приложении');
    return;
  }

  if (order.createdById !== user.id) {
    await answerCallbackQuery(cq.id, 'Это не ваш заказ');
    return;
  }

  if (verb === 'confirm_delivery' || verb === 'dispute_delivery') {
    if (order.botPhase !== 'AWAIT_DELIVERY_CONFIRM') {
      await answerCallbackQuery(cq.id, 'Уже обработано');
      return;
    }

    if (verb === 'confirm_delivery') {
      const dispensed = order.dispensedVolume ?? 0;
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'DELIVERED', botPhase: null, deliveredAt: new Date() },
        });
        if (dispensed > 0 && order.carId) {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          await tx.carUsage.upsert({
            where: { carId_month_year: { carId: order.carId, month, year } },
            create: { carId: order.carId, month, year, usedLiters: dispensed },
            update: { usedLiters: { increment: dispensed } },
          });
        }
      });
      if (order.createdById) {
        await createNotification({
          userId: order.createdById,
          type: 'ORDER_DELIVERED',
          title: 'Order delivered',
          message: `${order.car?.plateNumber ?? ""}: ${dispensed} L delivered`,
          orderId: order.id,
        });
      }
      await answerCallbackQuery(cq.id, 'Подтверждено');
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `✅ <b>Доставка подтверждена</b>: ${order.car?.plateNumber ?? ""} — ${dispensed} л.`,
        );
      }
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPUTED', botPhase: null },
    });
    await answerCallbackQuery(cq.id, 'Спор зафиксирован');
    const operatorPhone = process.env.OPERATOR_PHONE ?? '';
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `⚠️ <b>Заказ заморожен</b>: ${order.car?.plateNumber ?? ""}.\nСвяжитесь с оператором${operatorPhone ? `: ${operatorPhone}` : ''}.`,
      );
    }
    return;
  }

  if (order.status !== 'CREATED') {
    await answerCallbackQuery(cq.id, 'Заказ уже обработан');
    return;
  }

  if (verb === 'cancel') {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', botPhase: null },
    });
    await answerCallbackQuery(cq.id, 'Заказ отменён');
    if (chatId && messageId) {
      await editMessageText(chatId, messageId, `❌ <b>Заказ отменён</b>\n\n` + orderSummary(order));
    }
    return;
  }

  if (verb === 'edit') {
    await prisma.order.delete({ where: { id: orderId } });
    await answerCallbackQuery(cq.id, 'Создайте заказ заново');
    const miniAppUrl = getMiniAppUrl();
    const markup: InlineKeyboardMarkup | undefined = miniAppUrl
      ? { inline_keyboard: [[{ text: '✏️ Открыть приложение', web_app: { url: miniAppUrl } }]] }
      : undefined;
    if (chatId && messageId) {
      await editMessageText(chatId, messageId, `✏️ Заказ отменён для изменения.`);
    }
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        'Откройте приложение и создайте заказ заново с нужными параметрами.',
        markup,
      );
    }
    return;
  }

  if (verb === 'confirm') {
    await prisma.order.update({
      where: { id: orderId },
      data: { botPhase: 'AWAIT_LOCATION' },
    });
    await answerCallbackQuery(cq.id, 'Подтверждено');
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `✅ <b>Заказ подтверждён</b>\n\n` + orderSummary(order),
      );
    }
    if (chatId) {
      const locKeyboard: ReplyKeyboardMarkup = {
        keyboard: [[{ text: '📍 Отправить локацию', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      };
      await sendTelegramMessage(
        chatId,
        'Отправьте вашу <b>локацию</b>, чтобы курьер знал, куда ехать. Нажмите кнопку ниже.',
        locKeyboard,
      );
    }
    return;
  }

  await answerCallbackQuery(cq.id);
}

async function handleLocation(message: TgMessage, isEdited: boolean) {
  const chatId = message.chat?.id;
  const fromId = message.from?.id ?? chatId;
  const loc = message.location;
  if (!chatId || !fromId || !loc) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true, role: true },
  });
  if (!user) return;

  // Courier live location → feed geo-dispatch. Silent on live-update edits.
  if (user.role === 'COURIER') {
    await prisma.courierLocation.upsert({
      where: { courierId: user.id },
      create: { courierId: user.id, lat: loc.latitude, lng: loc.longitude },
      update: { lat: loc.latitude, lng: loc.longitude },
    });
    if (!isEdited) {
      await sendTelegramMessage(
        chatId,
        '📍 Локация получена. Вы в очереди на ближайшие заказы.',
      );
    }
    return;
  }

  const order = await prisma.order.findFirst({
    where: { createdById: user.id, status: 'CREATED', botPhase: 'AWAIT_LOCATION' },
    orderBy: { createdAt: 'desc' },
    include: { car: { select: { plateNumber: true } } },
  });

  const removeKeyboard: ReplyKeyboardRemove = { remove_keyboard: true };

  if (!order) {
    await sendTelegramMessage(chatId, 'Нет заказа, ожидающего локацию.', removeKeyboard);
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { lat: loc.latitude, lng: loc.longitude },
  });

  if (order.isFullTank) {
    await requestFullTankApproval(order.id);
    await sendTelegramMessage(
      chatId,
      `🕓 Локация получена. Заказ на <b>полный бак</b> отправлен на согласование менеджеру.\n\n` +
        orderSummary(order),
      removeKeyboard,
    );
  } else {
    await dispatchOrder(order.id);
    await sendTelegramMessage(
      chatId,
      `🚀 Локация получена. Заказ отправлен курьерам!\n\n` + orderSummary(order),
      removeKeyboard,
    );
  }
}
