// Payme (Paycom) Merchant API — JSON-RPC 2.0 core logic.
// https://developer.help.paycom.uz/metody-merchant-api
//
// Pure and dependency-injected: all persistence goes through `PaymeDb` and all
// side effects through `PaymeHooks`, so this is unit-tested with an in-memory
// fake (see payme.test.ts). Amounts are in tiyin (order total UZS × 100).

export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED_AFTER_CREATE: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;

// JSON-RPC / Payme error codes.
export const PAYME_ERR = {
  TRANSPORT: -32300,
  PARSE: -32700,
  RPC: -32600,
  METHOD_NOT_FOUND: -32601,
  INSUFFICIENT_PRIVILEGE: -32504, // auth
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ORDER_NOT_FOUND: -31050,
  ORDER_NOT_PAYABLE: -31051, // already paid / wrong state
  ORDER_BUSY: -31099, // another active transaction for the order
} as const;

type Loc = { ru: string; uz: string; en: string };
function msg(ru: string, uz: string, en: string): Loc {
  return { ru, uz, en };
}

export type PaymeOrder = {
  id: string;
  totalAmount: number | null;
  paymentStatus: string | null;
};

export type PaymeTxn = {
  paycomId: string;
  orderId: string;
  amount: number;
  state: number;
  createTime: number;
  performTime: number | null;
  cancelTime: number | null;
  reason: number | null;
};

export interface PaymeDb {
  getOrder(orderId: string): Promise<PaymeOrder | null>;
  getTxnByPaycomId(paycomId: string): Promise<PaymeTxn | null>;
  getActiveTxnByOrder(orderId: string): Promise<PaymeTxn | null>;
  createTxn(txn: PaymeTxn): Promise<void>;
  updateTxn(paycomId: string, data: Partial<PaymeTxn>): Promise<void>;
  listTxns(from: number, to: number): Promise<PaymeTxn[]>;
}

export interface PaymeHooks {
  // Called exactly once when a transaction transitions to PERFORMED.
  onPerform(orderId: string): Promise<void>;
  // Called when a transaction is cancelled. `wasPerformed` = refund of a paid order.
  onCancel(orderId: string, wasPerformed: boolean): Promise<void>;
}

export type RpcRequest = { method?: string; params?: Record<string, unknown>; id?: unknown };
export type RpcError = { code: number; message: Loc | string; data?: string };
export type RpcResponse = { result: unknown } | { error: RpcError };

function rpcError(code: number, message: Loc | string, data?: string): { error: RpcError } {
  return { error: data ? { code, message, data } : { code, message } };
}

type Ctx = { db: PaymeDb; hooks: PaymeHooks; nowMs: () => number };

function getOrderId(params: Record<string, unknown> | undefined): string | null {
  const account = (params?.account ?? {}) as Record<string, unknown>;
  const v = account.order_id;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Shared account/amount validation used by CheckPerform and CreateTransaction. */
async function validateOrderAndAmount(
  db: PaymeDb,
  params: Record<string, unknown> | undefined,
): Promise<{ ok: true; order: PaymeOrder; amount: number } | { ok: false; error: { error: RpcError } }> {
  const orderId = getOrderId(params);
  if (!orderId) {
    return { ok: false, error: rpcError(PAYME_ERR.ORDER_NOT_FOUND, msg('Неверный заказ', 'Notoʻgʻri buyurtma', 'Invalid order'), 'order_id') };
  }
  const amount = Number(params?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: rpcError(PAYME_ERR.INVALID_AMOUNT, msg('Неверная сумма', 'Notoʻgʻri summa', 'Invalid amount')) };
  }
  const order = await db.getOrder(orderId);
  if (!order) {
    return { ok: false, error: rpcError(PAYME_ERR.ORDER_NOT_FOUND, msg('Заказ не найден', 'Buyurtma topilmadi', 'Order not found'), 'order_id') };
  }
  if (order.paymentStatus === 'PAID') {
    return { ok: false, error: rpcError(PAYME_ERR.ORDER_NOT_PAYABLE, msg('Заказ уже оплачен', 'Buyurtma allaqachon toʻlangan', 'Order already paid'), 'order_id') };
  }
  const expected = (order.totalAmount ?? 0) * 100;
  if (amount !== expected) {
    return { ok: false, error: rpcError(PAYME_ERR.INVALID_AMOUNT, msg('Неверная сумма', 'Notoʻgʻri summa', 'Invalid amount'), 'amount') };
  }
  return { ok: true, order, amount };
}

async function checkPerform(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const v = await validateOrderAndAmount(ctx.db, req.params);
  if (!v.ok) return v.error;
  return { result: { allow: true } };
}

async function createTransaction(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const params = req.params ?? {};
  const paycomId = String(params.id ?? '');
  if (!paycomId) return rpcError(PAYME_ERR.TRANSACTION_NOT_FOUND, msg('Нет id транзакции', 'Tranzaksiya id yoʻq', 'Missing transaction id'));

  // Idempotency: re-CreateTransaction with the same id.
  const existing = await ctx.db.getTxnByPaycomId(paycomId);
  if (existing) {
    if (existing.state !== PAYME_STATE.CREATED) {
      return rpcError(PAYME_ERR.CANNOT_PERFORM, msg('Транзакция в недопустимом состоянии', 'Tranzaksiya holati notoʻgʻri', 'Transaction is not in a creatable state'));
    }
    return { result: { create_time: existing.createTime, transaction: existing.paycomId, state: existing.state } };
  }

  const v = await validateOrderAndAmount(ctx.db, params);
  if (!v.ok) return v.error;

  // One active transaction per order.
  const active = await ctx.db.getActiveTxnByOrder(v.order.id);
  if (active) {
    return rpcError(PAYME_ERR.ORDER_BUSY, msg('Заказ уже обрабатывается', 'Buyurtma qayta ishlanmoqda', 'Order is already in progress'), 'order_id');
  }

  const time = Number.isInteger(Number(params.time)) ? Number(params.time) : ctx.nowMs();
  await ctx.db.createTxn({
    paycomId,
    orderId: v.order.id,
    amount: v.amount,
    state: PAYME_STATE.CREATED,
    createTime: time,
    performTime: null,
    cancelTime: null,
    reason: null,
  });
  return { result: { create_time: time, transaction: paycomId, state: PAYME_STATE.CREATED } };
}

async function performTransaction(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const paycomId = String(req.params?.id ?? '');
  const txn = await ctx.db.getTxnByPaycomId(paycomId);
  if (!txn) return rpcError(PAYME_ERR.TRANSACTION_NOT_FOUND, msg('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found'));

  if (txn.state === PAYME_STATE.PERFORMED) {
    return { result: { transaction: txn.paycomId, perform_time: txn.performTime ?? 0, state: txn.state } };
  }
  if (txn.state !== PAYME_STATE.CREATED) {
    return rpcError(PAYME_ERR.CANNOT_PERFORM, msg('Невозможно выполнить', 'Bajarib boʻlmaydi', 'Unable to perform'));
  }

  const performTime = ctx.nowMs();
  await ctx.db.updateTxn(paycomId, { state: PAYME_STATE.PERFORMED, performTime });
  await ctx.hooks.onPerform(txn.orderId);
  return { result: { transaction: paycomId, perform_time: performTime, state: PAYME_STATE.PERFORMED } };
}

async function cancelTransaction(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const params = req.params ?? {};
  const paycomId = String(params.id ?? '');
  const txn = await ctx.db.getTxnByPaycomId(paycomId);
  if (!txn) return rpcError(PAYME_ERR.TRANSACTION_NOT_FOUND, msg('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found'));

  const reason = Number.isInteger(Number(params.reason)) ? Number(params.reason) : null;

  // Idempotent: already cancelled.
  if (txn.state === PAYME_STATE.CANCELLED_AFTER_CREATE || txn.state === PAYME_STATE.CANCELLED_AFTER_PERFORM) {
    return { result: { transaction: paycomId, cancel_time: txn.cancelTime ?? 0, state: txn.state } };
  }

  const wasPerformed = txn.state === PAYME_STATE.PERFORMED;
  const newState = wasPerformed ? PAYME_STATE.CANCELLED_AFTER_PERFORM : PAYME_STATE.CANCELLED_AFTER_CREATE;
  const cancelTime = ctx.nowMs();
  await ctx.db.updateTxn(paycomId, { state: newState, cancelTime, reason });
  await ctx.hooks.onCancel(txn.orderId, wasPerformed);
  return { result: { transaction: paycomId, cancel_time: cancelTime, state: newState } };
}

async function checkTransaction(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const paycomId = String(req.params?.id ?? '');
  const txn = await ctx.db.getTxnByPaycomId(paycomId);
  if (!txn) return rpcError(PAYME_ERR.TRANSACTION_NOT_FOUND, msg('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found'));
  return {
    result: {
      create_time: txn.createTime,
      perform_time: txn.performTime ?? 0,
      cancel_time: txn.cancelTime ?? 0,
      transaction: txn.paycomId,
      state: txn.state,
      reason: txn.reason ?? null,
    },
  };
}

async function getStatement(ctx: Ctx, req: RpcRequest): Promise<RpcResponse> {
  const from = Number(req.params?.from);
  const to = Number(req.params?.to);
  const txns = await ctx.db.listTxns(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : ctx.nowMs());
  return {
    result: {
      transactions: txns.map((t) => ({
        id: t.paycomId,
        time: t.createTime,
        amount: t.amount,
        account: { order_id: t.orderId },
        create_time: t.createTime,
        perform_time: t.performTime ?? 0,
        cancel_time: t.cancelTime ?? 0,
        transaction: t.paycomId,
        state: t.state,
        reason: t.reason ?? null,
      })),
    },
  };
}

/** Dispatches a single JSON-RPC request to the right Payme method. */
export async function handlePaymeRpc(
  req: RpcRequest,
  deps: { db: PaymeDb; hooks: PaymeHooks; nowMs?: () => number },
): Promise<RpcResponse> {
  const ctx: Ctx = { db: deps.db, hooks: deps.hooks, nowMs: deps.nowMs ?? (() => Date.now()) };
  switch (req.method) {
    case 'CheckPerformTransaction':
      return checkPerform(ctx, req);
    case 'CreateTransaction':
      return createTransaction(ctx, req);
    case 'PerformTransaction':
      return performTransaction(ctx, req);
    case 'CancelTransaction':
      return cancelTransaction(ctx, req);
    case 'CheckTransaction':
      return checkTransaction(ctx, req);
    case 'GetStatement':
      return getStatement(ctx, req);
    default:
      return rpcError(PAYME_ERR.METHOD_NOT_FOUND, msg('Метод не найден', 'Metod topilmadi', 'Method not found'));
  }
}

/** Verifies Payme HTTP Basic auth. Login is ignored; password must equal PAYME_KEY. */
export function verifyPaymeAuth(authHeader: string | null, key: string | undefined): boolean {
  if (!key) return false;
  if (!authHeader?.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const password = idx >= 0 ? decoded.slice(idx + 1) : decoded;
    return password === key;
  } catch {
    return false;
  }
}

/** Builds the hosted-checkout redirect URL: base64(m=...;ac.order_id=...;a=...). */
export function paymeCheckoutUrl(merchantId: string, orderId: string, amountTiyin: number): string {
  const payload = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`;
  return `https://checkout.paycom.uz/${Buffer.from(payload, 'utf8').toString('base64')}`;
}
