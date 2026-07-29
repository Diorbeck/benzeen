import { describe, it, expect, beforeEach } from 'vitest';
import {
  handlePaymeRpc,
  verifyPaymeAuth,
  paymeCheckoutUrl,
  PAYME_ERR,
  PAYME_STATE,
  type PaymeDb,
  type PaymeOrder,
  type PaymeTxn,
} from './payme';

// --- In-memory fake DB + hooks ---------------------------------------------
function makeDb(orders: PaymeOrder[]) {
  const orderMap = new Map(orders.map((o) => [o.id, { ...o }]));
  const txns = new Map<string, PaymeTxn>();
  const db: PaymeDb & { _orders: typeof orderMap; _txns: typeof txns } = {
    _orders: orderMap,
    _txns: txns,
    async getOrder(id) {
      return orderMap.get(id) ?? null;
    },
    async getTxnByPaycomId(id) {
      return txns.get(id) ?? null;
    },
    async getActiveTxnByOrder(orderId) {
      return [...txns.values()].find((t) => t.orderId === orderId && t.state === 1) ?? null;
    },
    async createTxn(t) {
      txns.set(t.paycomId, { ...t });
    },
    async updateTxn(id, data) {
      const t = txns.get(id);
      if (t) txns.set(id, { ...t, ...data });
    },
    async listTxns(from, to) {
      return [...txns.values()].filter((t) => t.createTime >= from && t.createTime <= to);
    },
  };
  return db;
}

function makeHooks() {
  const performed: string[] = [];
  const cancelled: { orderId: string; wasPerformed: boolean }[] = [];
  return {
    performed,
    cancelled,
    hooks: {
      async onPerform(orderId: string) {
        performed.push(orderId);
      },
      async onCancel(orderId: string, wasPerformed: boolean) {
        cancelled.push({ orderId, wasPerformed });
      },
    },
  };
}

const ORDER = { id: 'order1', totalAmount: 414000, paymentStatus: 'PENDING' as string | null };
const AMOUNT = 414000 * 100; // tiyin
let clock: number;
const nowMs = () => clock;

describe('Payme JSON-RPC', () => {
  let db: ReturnType<typeof makeDb>;
  let h: ReturnType<typeof makeHooks>;
  beforeEach(() => {
    clock = 1_700_000_000_000;
    db = makeDb([{ ...ORDER }]);
    h = makeHooks();
  });

  const call = (method: string, params: Record<string, unknown>) =>
    handlePaymeRpc({ method, params, id: 1 }, { db, hooks: h.hooks, nowMs });

  it('CheckPerformTransaction allows a valid order+amount', async () => {
    const res = await call('CheckPerformTransaction', { amount: AMOUNT, account: { order_id: 'order1' } });
    expect(res).toEqual({ result: { allow: true } });
  });

  it('CheckPerformTransaction rejects a wrong amount', async () => {
    const res = (await call('CheckPerformTransaction', { amount: 999, account: { order_id: 'order1' } })) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.INVALID_AMOUNT);
  });

  it('CheckPerformTransaction rejects an unknown order', async () => {
    const res = (await call('CheckPerformTransaction', { amount: AMOUNT, account: { order_id: 'nope' } })) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.ORDER_NOT_FOUND);
  });

  it('CreateTransaction creates, then is idempotent for the same id', async () => {
    const p = { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } };
    const first = (await call('CreateTransaction', p)) as { result: { state: number; transaction: string; create_time: number } };
    expect(first.result.state).toBe(PAYME_STATE.CREATED);
    expect(first.result.transaction).toBe('tx1');

    const again = (await call('CreateTransaction', p)) as { result: { state: number; create_time: number } };
    expect(again.result.state).toBe(PAYME_STATE.CREATED);
    expect(again.result.create_time).toBe(first.result.create_time);
    expect(db._txns.size).toBe(1); // no duplicate
  });

  it('CreateTransaction blocks a second concurrent transaction for one order', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    const res = (await call('CreateTransaction', { id: 'tx2', time: clock, amount: AMOUNT, account: { order_id: 'order1' } })) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.ORDER_BUSY);
  });

  it('PerformTransaction pays once and fires onPerform; second call is idempotent', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    clock += 5000;
    const done = (await call('PerformTransaction', { id: 'tx1' })) as { result: { state: number; perform_time: number } };
    expect(done.result.state).toBe(PAYME_STATE.PERFORMED);
    expect(done.result.perform_time).toBe(clock);
    expect(h.performed).toEqual(['order1']);

    const again = (await call('PerformTransaction', { id: 'tx1' })) as { result: { state: number; perform_time: number } };
    expect(again.result.state).toBe(PAYME_STATE.PERFORMED);
    expect(again.result.perform_time).toBe(clock); // unchanged
    expect(h.performed).toEqual(['order1']); // hook not fired twice
  });

  it('PerformTransaction on an unknown id errors', async () => {
    const res = (await call('PerformTransaction', { id: 'ghost' })) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.TRANSACTION_NOT_FOUND);
  });

  it('CancelTransaction after create → state -1; idempotent', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    const c = (await call('CancelTransaction', { id: 'tx1', reason: 3 })) as { result: { state: number } };
    expect(c.result.state).toBe(PAYME_STATE.CANCELLED_AFTER_CREATE);
    expect(h.cancelled).toEqual([{ orderId: 'order1', wasPerformed: false }]);
    const again = (await call('CancelTransaction', { id: 'tx1', reason: 3 })) as { result: { state: number } };
    expect(again.result.state).toBe(PAYME_STATE.CANCELLED_AFTER_CREATE);
    expect(h.cancelled).toHaveLength(1); // not fired twice
  });

  it('CancelTransaction after perform → state -2 (refund)', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    await call('PerformTransaction', { id: 'tx1' });
    const c = (await call('CancelTransaction', { id: 'tx1', reason: 5 })) as { result: { state: number } };
    expect(c.result.state).toBe(PAYME_STATE.CANCELLED_AFTER_PERFORM);
    expect(h.cancelled).toEqual([{ orderId: 'order1', wasPerformed: true }]);
  });

  it('CheckTransaction reports state/times', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    const r = (await call('CheckTransaction', { id: 'tx1' })) as { result: { state: number; create_time: number; perform_time: number } };
    expect(r.result.state).toBe(PAYME_STATE.CREATED);
    expect(r.result.create_time).toBe(clock);
    expect(r.result.perform_time).toBe(0);
  });

  it('GetStatement returns transactions in range', async () => {
    await call('CreateTransaction', { id: 'tx1', time: clock, amount: AMOUNT, account: { order_id: 'order1' } });
    const r = (await call('GetStatement', { from: clock - 1000, to: clock + 1000 })) as { result: { transactions: unknown[] } };
    expect(r.result.transactions).toHaveLength(1);
    const empty = (await call('GetStatement', { from: 0, to: 1 })) as { result: { transactions: unknown[] } };
    expect(empty.result.transactions).toHaveLength(0);
  });

  it('unknown method → method not found', async () => {
    const res = (await call('Nope', {})) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.METHOD_NOT_FOUND);
  });

  it('paying an already-paid order is rejected', async () => {
    db._orders.get('order1')!.paymentStatus = 'PAID';
    const res = (await call('CheckPerformTransaction', { amount: AMOUNT, account: { order_id: 'order1' } })) as { error: { code: number } };
    expect(res.error.code).toBe(PAYME_ERR.ORDER_NOT_PAYABLE);
  });
});

describe('Payme helpers', () => {
  it('verifyPaymeAuth accepts the correct Basic password', () => {
    const header = 'Basic ' + Buffer.from('Paycom:secretkey').toString('base64');
    expect(verifyPaymeAuth(header, 'secretkey')).toBe(true);
    expect(verifyPaymeAuth(header, 'wrong')).toBe(false);
    expect(verifyPaymeAuth(header, undefined)).toBe(false);
    expect(verifyPaymeAuth(null, 'secretkey')).toBe(false);
  });

  it('paymeCheckoutUrl encodes m/ac.order_id/a as base64', () => {
    const url = paymeCheckoutUrl('merch123', 'order1', 41400000);
    const b64 = url.replace('https://checkout.paycom.uz/', '');
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('m=merch123;ac.order_id=order1;a=41400000');
  });
});
