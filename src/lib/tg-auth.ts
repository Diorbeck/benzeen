// Resolves the authenticated driver for a Mini App request.
//
// The Mini App sends the raw Telegram `initData` on every request via the
// `X-Telegram-Init-Data` header (cookies are unreliable inside Telegram's
// in-app WebView). We validate the signature, then look up the linked driver
// by their stored telegramId.

import { prisma } from '@/lib/prisma';
import { validateInitData, type TelegramUser } from '@/lib/telegram';

export const TG_INIT_DATA_HEADER = 'x-telegram-init-data';

export interface TgLinkedUser {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  companyId: string | null;
}

export interface TgContext {
  tgUser: TelegramUser;
  // Any linked user (driver or courier), or null if not linked yet.
  user: TgLinkedUser | null;
  // Back-compat alias: non-null only when the linked user is a DRIVER.
  driver: TgLinkedUser | null;
  // Non-null only when the linked user is a COURIER.
  courier: TgLinkedUser | null;
}

/**
 * Validates the initData header and returns the Telegram user plus the linked
 * driver (if any). Returns null when the header is missing/invalid — callers
 * should respond 401.
 */
export async function getTgContext(req: Request): Promise<TgContext | null> {
  const initData = req.headers.get(TG_INIT_DATA_HEADER);
  if (!initData) return null;

  const validated = validateInitData(initData);
  if (!validated) return null;

  const telegramId = String(validated.user.id);
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, name: true, phone: true, role: true, companyId: true },
  });

  const driver = user && user.role === 'DRIVER' ? user : null;
  const courier = user && user.role === 'COURIER' ? user : null;

  return { tgUser: validated.user, user: user ?? null, driver, courier };
}
