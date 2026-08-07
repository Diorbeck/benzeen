// Referral + bonus service (M5). Server-only; all writes here are money-adjacent.
import { prisma } from './prisma';
import {
  FRIEND_FIRST_ORDER_BONUS,
  TEN_FRIENDS_BONUS,
  TEN_FRIENDS_AT,
  FRIEND_FIRST_ORDER_DAILY_CAP,
  bonusBalanceFrom,
  accrualStatusForDay,
  utcDayRange,
} from './bonus';

// Unambiguous alphabet (no 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

/** Returns the user's referral code, generating a unique one on first use. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 8; i++) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: genCode() },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      // unique collision — retry
    }
  }
  throw new Error('could not allocate referral code');
}

export async function getBonusBalance(userId: string): Promise<number> {
  // PR-C: only POSTED rows count. bonusBalanceFrom filters on status.
  const rows = await prisma.bonusLedger.findMany({
    where: { userId },
    select: { liters: true, reason: true, status: true },
  });
  return bonusBalanceFrom(rows);
}

export async function getReferralStats(userId: string) {
  const code = await ensureReferralCode(userId);
  const [rows, friendCount] = await Promise.all([
    prisma.bonusLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, liters: true, reason: true, status: true, createdAt: true },
    }),
    // Milestone progress counts POSTED FRIEND_FIRST_ORDER only (PR-C).
    prisma.bonusLedger.count({
      where: { userId, reason: 'FRIEND_FIRST_ORDER', status: 'POSTED' },
    }),
  ]);
  return {
    code,
    balance: bonusBalanceFrom(rows),
    friendCount,
    milestoneAt: TEN_FRIENDS_AT,
    ledger: rows.map((r) => ({
      id: r.id,
      liters: r.liters,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/**
 * Resolve a referrer for a brand-new client. Ignores self-referral and unknown
 * codes. Returns the referrer id or null. Called only at first registration.
 */
export async function resolveReferrer(code: string, newUserPhone: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const ref = await prisma.user.findUnique({ where: { referralCode: clean }, select: { id: true, phone: true } });
  if (!ref) return null;
  if (ref.phone && ref.phone === newUserPhone) return null; // no self-referral
  return ref.id;
}

/**
 * Accrual hook — call after a B2C order becomes DELIVERED. Idempotent:
 *  - a referred friend's FIRST delivered order → +1 л to the referrer (once per friend);
 *  - reaching 10 such friends → +10 л milestone (once).
 */
export async function awardReferralOnDelivery(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, status: true },
  });
  if (!order?.clientId || order.status !== 'DELIVERED') return;

  const client = await prisma.user.findUnique({
    where: { id: order.clientId },
    select: { referredById: true },
  });
  const referrerId = client?.referredById;
  if (!referrerId) return;

  // PR-C: a frozen referrer accrues NOTHING (no FRIEND_FIRST_ORDER, no
  // milestone). The balance stays visible; only new postings are blocked.
  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { bonusFrozen: true },
  });
  if (referrer?.bonusFrozen) return;

  // Only the friend's FIRST delivered order counts.
  const deliveredCount = await prisma.order.count({
    where: { clientId: order.clientId, status: 'DELIVERED' },
  });
  if (deliveredCount !== 1) return;

  await prisma.$transaction(async (tx) => {
    // Idempotency guard inside the tx (by orderId).
    const already = await tx.bonusLedger.findFirst({ where: { reason: 'FRIEND_FIRST_ORDER', orderId } });
    if (already) return;

    // PR-C rate-cap: ≤3 POSTED FRIEND_FIRST_ORDER accruals per referrer per UTC
    // day. The 4th+ today lands as PENDING for admin review (never auto-blocked).
    const { start, end } = utcDayRange(new Date());
    const todayPosted = await tx.bonusLedger.count({
      where: {
        userId: referrerId,
        reason: 'FRIEND_FIRST_ORDER',
        status: 'POSTED',
        createdAt: { gte: start, lt: end },
      },
    });
    const status = accrualStatusForDay(todayPosted, FRIEND_FIRST_ORDER_DAILY_CAP);

    await tx.bonusLedger.create({
      data: {
        userId: referrerId,
        liters: FRIEND_FIRST_ORDER_BONUS,
        reason: 'FRIEND_FIRST_ORDER',
        status,
        orderId,
      },
    });

    // A PENDING accrual does not advance the milestone; only POSTED rows count.
    if (status !== 'POSTED') return;

    const friendCount = await tx.bonusLedger.count({
      where: { userId: referrerId, reason: 'FRIEND_FIRST_ORDER', status: 'POSTED' },
    });
    if (friendCount === TEN_FRIENDS_AT) {
      const milestone = await tx.bonusLedger.findFirst({
        where: { userId: referrerId, reason: 'TEN_FRIENDS_MILESTONE' },
      });
      if (!milestone) {
        await tx.bonusLedger.create({
          data: { userId: referrerId, liters: TEN_FRIENDS_BONUS, reason: 'TEN_FRIENDS_MILESTONE' },
        });
      }
    }
  });
}

/** Return bonus liters when a bonus-using order is cancelled before delivery. Idempotent. */
export async function refundBonusOnCancel(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, bonusLitersUsed: true },
  });
  if (!order?.clientId || !order.bonusLitersUsed || order.bonusLitersUsed <= 0) return;
  const already = await prisma.bonusLedger.findFirst({ where: { reason: 'REFUND', orderId } });
  if (already) return;
  await prisma.bonusLedger.create({
    data: { userId: order.clientId, liters: order.bonusLitersUsed, reason: 'REFUND', orderId },
  });
}
