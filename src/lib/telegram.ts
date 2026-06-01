// Telegram Bot + Mini App helpers (server-only).
//
// Two responsibilities:
//   1. validateInitData() — verify the `initData` string a Mini App sends, so
//      we can trust the Telegram user id without a cookie/session. Uses the
//      documented HMAC-SHA256 scheme.
//   2. sendTelegramMessage() — push a message to a chat via the Bot API.
//
// Everything degrades to a graceful no-op when TELEGRAM_BOT_TOKEN is unset, so
// the app keeps working in environments without a configured bot.

import { createHmac } from 'crypto';

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: number;
  queryId?: string;
}

/**
 * Validates a Mini App `initData` query string per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns the parsed user on success, or null if the signature is invalid,
 * the data is too old, the bot token is missing, or the payload is malformed.
 *
 * @param initData raw initData string (key=value&... url-encoded)
 * @param maxAgeSeconds reject payloads older than this (default 24h)
 */
export function validateInitData(
  initData: string,
  maxAgeSeconds = 86400,
): ValidatedInitData | null {
  const token = getBotToken();
  if (!token) return null;
  if (!initData) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;

  // Build the data-check-string: all fields except `hash`, sorted by key,
  // joined as key=value with newlines.
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  // secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Constant-time-ish comparison (lengths are equal hex strings).
  if (computedHash.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  if (diff !== 0) return null;

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number(authDateRaw) : 0;
  if (!authDate || Number.isNaN(authDate)) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
  if (!user?.id || typeof user.id !== 'number') return null;

  return {
    user,
    authDate,
    queryId: params.get('query_id') || undefined,
  };
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  web_app?: { url: string };
}

export interface ReplyMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * Sends a message via the Bot API. No-op (returns false) when the bot token is
 * not configured. Never throws — failures are logged and swallowed so callers
 * (e.g. order status transitions) are never blocked by a Telegram outage.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: ReplyMarkup,
): Promise<boolean> {
  const token = getBotToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram] sendMessage error:', e);
    return false;
  }
}

/** URL of the Mini App, used in /start bot replies. */
export function getMiniAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_TG_MINIAPP_URL;
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, '')}/tg` : null;
}
