// PR-C money-invariant tests for the accrual path. Exercises the real
// awardReferralOnDelivery against an in-memory prisma mock so we assert the
// actual writes: freeze blocks accrual, the 4th daily accrual is PENDING, and
// the ledger is append-only (create-only — never update/delete of liters/reason).
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = {
  id: string;
  userId: string;
  liters: number;
  reason: string;
  status: string;
  orderId?: string | null;
  createdAt: Date;
};

// Hoisted so the vi.mock factory (also hoisted) can safely reference it.
const h = vi.hoisted(() => {
  const db = {
    order: null as null | { id: string; clientId: string | null; status: string },
    users: new Map<string, { id: string; referredById: string | null; bonusFrozen: boolean }>(),
    deliveredCount: 1,
    ledger: [] as Row[],
    updateCalls: 0,
    deleteCalls: 0,
  };

  function whereMatches(r: Row, where: Record<string, unknown>): boolean {
    if (where.userId != null && r.userId !== where.userId) return false;
    if (where.reason != null && r.reason !== where.reason) return false;
    if (where.status != null && r.status !== where.status) return false;
    if (where.orderId != null && r.orderId !== where.orderId) return false;
    const ca = where.createdAt as { gte?: Date; lt?: Date } | undefined;
    if (ca?.gte && r.createdAt < ca.gte) return false;
    if (ca?.lt && r.createdAt >= ca.lt) return false;
    return true;
  }

  const bonusLedger = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      db.ledger.find((r) => whereMatches(r, where)) ?? null,
    ),
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      db.ledger.filter((r) => whereMatches(r, where)).length,
    ),
    create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
      const row: Row = {
        id: `L${db.ledger.length + 1}`,
        userId: data.userId!,
        liters: data.liters!,
        reason: data.reason!,
        status: data.status ?? 'POSTED',
        orderId: data.orderId ?? null,
        createdAt: new Date(),
      };
      db.ledger.push(row);
      return row;
    }),
    update: vi.fn(async () => {
      db.updateCalls++;
      return {};
    }),
    delete: vi.fn(async () => {
      db.deleteCalls++;
      return {};
    }),
  };

  return { db, bonusLedger };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(async () => h.db.order),
      count: vi.fn(async () => h.db.deliveredCount),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => h.db.users.get(where.id) ?? null),
    },
    bonusLedger: h.bonusLedger,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ bonusLedger: h.bonusLedger }),
  },
}));

import { awardReferralOnDelivery } from './referral';

const { db, bonusLedger } = h;

function seed(opts: { frozen?: boolean; todayPosted?: number }) {
  db.order = { id: 'ORD', clientId: 'friend', status: 'DELIVERED' };
  db.users.set('friend', { id: 'friend', referredById: 'ref', bonusFrozen: false });
  db.users.set('ref', { id: 'ref', referredById: null, bonusFrozen: !!opts.frozen });
  db.deliveredCount = 1;
  db.ledger = [];
  db.updateCalls = 0;
  db.deleteCalls = 0;
  for (let i = 0; i < (opts.todayPosted ?? 0); i++) {
    db.ledger.push({
      id: `seed${i}`,
      userId: 'ref',
      liters: 1,
      reason: 'FRIEND_FIRST_ORDER',
      status: 'POSTED',
      orderId: `seedOrd${i}`,
      createdAt: new Date(),
    });
  }
}

beforeEach(() => {
  bonusLedger.create.mockClear();
});

describe('INVARIANT: a frozen referrer accrues NOTHING', () => {
  it('creates no ledger row when the referrer is frozen', async () => {
    seed({ frozen: true });
    await awardReferralOnDelivery('ORD');
    expect(bonusLedger.create).not.toHaveBeenCalled();
    expect(db.ledger).toHaveLength(0);
  });
});

describe('INVARIANT: rate-cap creates the 4th daily accrual as PENDING', () => {
  it('1st–3rd of the day are POSTED', async () => {
    for (const already of [0, 1, 2]) {
      seed({ todayPosted: already });
      await awardReferralOnDelivery('ORD');
      const created = db.ledger.find((r) => r.orderId === 'ORD');
      expect(created?.status).toBe('POSTED');
    }
  });
  it('the 4th of the day is PENDING (not POSTED)', async () => {
    seed({ todayPosted: 3 });
    await awardReferralOnDelivery('ORD');
    const created = db.ledger.find((r) => r.orderId === 'ORD');
    expect(created?.status).toBe('PENDING');
  });
  it('a PENDING accrual does not advance the milestone', async () => {
    seed({ todayPosted: 3 });
    await awardReferralOnDelivery('ORD');
    expect(db.ledger.some((r) => r.reason === 'TEN_FRIENDS_MILESTONE')).toBe(false);
  });
});

describe('INVARIANT: the ledger is append-only', () => {
  it('accrual only ever CREATEs rows — never UPDATE/DELETE', async () => {
    seed({ todayPosted: 0 });
    await awardReferralOnDelivery('ORD');
    expect(bonusLedger.create).toHaveBeenCalled();
    expect(db.updateCalls).toBe(0);
    expect(db.deleteCalls).toBe(0);
  });
});
