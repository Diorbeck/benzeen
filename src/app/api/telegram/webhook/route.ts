import { NextResponse } from 'next/server';
import {
  getBotToken,
  getMiniAppUrl,
  sendTelegramMessage,
  type ReplyMarkup,
} from '@/lib/telegram';

export const runtime = 'nodejs';

// Telegram Bot webhook. Telegram POSTs updates here. We authenticate each call
// via the secret token configured when the webhook is registered
// (setWebhook?secret_token=...), which Telegram echoes in this header.
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface TgUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
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

  const chatId = update.message?.chat?.id;
  const text = (update.message?.text || '').trim();

  if (chatId && text.startsWith('/start')) {
    const miniAppUrl = getMiniAppUrl();
    const replyMarkup: ReplyMarkup | undefined = miniAppUrl
      ? {
          inline_keyboard: [
            [{ text: '🚀 Открыть приложение', web_app: { url: miniAppUrl } }],
          ],
        }
      : undefined;

    await sendTelegramMessage(
      chatId,
      'Добро пожаловать в <b>Benzeen</b>!\n\nНажмите кнопку ниже, чтобы открыть приложение и создать заказ на топливо.',
      replyMarkup,
    );
  }

  // Always 200 so Telegram considers the update delivered.
  return NextResponse.json({ ok: true });
}
