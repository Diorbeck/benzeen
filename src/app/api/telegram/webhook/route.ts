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
import { applyCourierAction } from '@/lib/courier-actions';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

// Telegram Bot webhook. Telegram POSTs updates here. We authenticate each call
// via the secret token configured when the webhook is registered
// (setWebhook?secret_token=...), which Telegram echoes in this header.
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface TgUpdate {
  message?: {
    message_id?: number;
    chat?: { id?: number };
    from?: { id?: number };
    text?: string;
    location?: { latitude: number; longitude: number };
  };
  callback_query?: {
    id: string;
    from?: { id?: number };
    message?: { message_id?: number; chat?: { id?: number } };
    data?: string;
  };
}

export async function POST(req: Request) {
  // No bot configured → accept-and-ignore so Telegram doesn't retry forever.
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
    } else if (update.message?.location) {
      await handleLocation(update.message);
    } else if (update.message) {
      await handleText(update.message);
    }
  } catch (e) {
    console.error('[telegram] webhook handler error:', e);
  }

  // Always 200 so Telegram considers the update delivered.
  return NextResponse.json({ ok: true });
}

// ---- /start and other plain text -------------------------------------------
async function handleText(message: NonNullable<TgUpdate['message']>) {
  const chatId = message.chat?.id;
  const text = (message.text || '').trim();
  if (!chatId || !text.startsWith('/start')) return;

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

// ---- Inline button presses --------------------------------------------------
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
    include: { car: { select: { plateNumber: true } } },
  });
  if (!order) {
    await answerCallbackQuery(cq.id, 'Заказ не найден');
    return;
  }

  // Courier taking a broadcast order.
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
          `❌ ${result.error}\n\n` + orderSummary(order),
        );
      }
      return;
    }
    await answerCallbackQuery(cq.id, 'Заказ взят');
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `✅ <b>Вы взяли заказ</b>\n\n` + orderSummary(order),
      );
    }
    return;
  }

  // Driver actions on their own draft order (confirm / edit / cancel).
  if (order.createdById !== user.id) {
    await answerCallbackQuery(cq.id, 'Это не ваш заказ');
    return;
  }

  // Driver confirms or disputes the dispensed amount.
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
        if (dispensed > 0) {
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
          message: `${order.car.plateNumber}: ${dispensed} L delivered`,
          orderId: order.id,
        });
      }
      await answerCallbackQuery(cq.id, 'Подтверждено');
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `✅ <b>Доставка подтверждена</b>: ${order.car.plateNumber} — ${dispensed} л.`,
        );
      }
      return;
    }

    // dispute_delivery — заморозить заказ, отправить к оператору, НЕ списывать.
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
        `⚠️ <b>Заказ заморожен</b>: ${order.car.plateNumber}.\nСвяжитесь с оператором${operatorPhone ? `: ${operatorPhone}` : ''}.`,
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
    // Drop the draft and invite the driver to recreate it in the Mini App.
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

// ---- Location share (final step) -------------------------------------------
async function handleLocation(message: NonNullable<TgUpdate['message']>) {
  const chatId = message.chat?.id;
  const fromId = message.from?.id ?? chatId;
  const loc = message.location;
  if (!chatId || !fromId || !loc) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(fromId) },
    select: { id: true },
  });
  if (!user) return;

  // The driver's order awaiting a location (most recent if several).
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
