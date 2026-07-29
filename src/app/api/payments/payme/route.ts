import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchB2COrderToNearest } from '@/lib/order-dispatch';
import {
  handlePaymeRpc,
  verifyPaymeAuth,
  PAYME_ERR,
  type PaymeDb,
  type PaymeHooks,
  type PaymeTxn,
} from '@/lib/payme';

export const runtime = 'nodejs';

// Prisma-backed PaymeDb. BigInt ms-timestamps are converted to/from number at
// this boundary so the pure handler stays number-only.
const db: PaymeDb = {
  async getOrder(orderId) {
    const o = await prisma.order.findFirst({
      where: { id: orderId },
      select: { id: true, totalAmount: true, paymentStatus: true },
    });
    return o ? { id: o.id, totalAmount: o.totalAmount, paymentStatus: o.paymentStatus } : null;
  },
  async getTxnByPaycomId(paycomId) {
    const t = await prisma.paymeTransaction.findUnique({ where: { paycomId } });
    return t ? toTxn(t) : null;
  },
  async getActiveTxnByOrder(orderId) {
    const t = await prisma.paymeTransaction.findFirst({ where: { orderId, state: 1 } });
    return t ? toTxn(t) : null;
  },
  async createTxn(txn) {
    await prisma.paymeTransaction.create({
      data: {
        paycomId: txn.paycomId,
        orderId: txn.orderId,
        amount: txn.amount,
        state: txn.state,
        createTime: BigInt(txn.createTime),
        performTime: txn.performTime != null ? BigInt(txn.performTime) : null,
        cancelTime: txn.cancelTime != null ? BigInt(txn.cancelTime) : null,
        reason: txn.reason,
      },
    });
  },
  async updateTxn(paycomId, data) {
    await prisma.paymeTransaction.update({
      where: { paycomId },
      data: {
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.reason !== undefined ? { reason: data.reason } : {}),
        ...(data.performTime !== undefined ? { performTime: data.performTime != null ? BigInt(data.performTime) : null } : {}),
        ...(data.cancelTime !== undefined ? { cancelTime: data.cancelTime != null ? BigInt(data.cancelTime) : null } : {}),
      },
    });
  },
  async listTxns(from, to) {
    const rows = await prisma.paymeTransaction.findMany({
      where: { createTime: { gte: BigInt(from), lte: BigInt(to) } },
      orderBy: { createTime: 'asc' },
    });
    return rows.map(toTxn);
  },
};

function toTxn(t: {
  paycomId: string; orderId: string; amount: number; state: number;
  createTime: bigint; performTime: bigint | null; cancelTime: bigint | null; reason: number | null;
}): PaymeTxn {
  return {
    paycomId: t.paycomId,
    orderId: t.orderId,
    amount: t.amount,
    state: t.state,
    createTime: Number(t.createTime),
    performTime: t.performTime != null ? Number(t.performTime) : null,
    cancelTime: t.cancelTime != null ? Number(t.cancelTime) : null,
    reason: t.reason,
  };
}

const hooks: PaymeHooks = {
  // Payment confirmed → mark PAID, make it live (RECEIVED), and dispatch couriers.
  async onPerform(orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID', status: 'RECEIVED' },
    });
    await dispatchB2COrderToNearest(orderId);
  },
  // Cancelled/refunded → take the order out of the pipeline.
  async onCancel(orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    }).catch(() => {});
  },
};

export async function POST(req: Request) {
  let body: { method?: string; params?: Record<string, unknown>; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: PAYME_ERR.PARSE, message: 'Parse error' } });
  }

  // HTTP Basic auth; password must equal PAYME_KEY.
  if (!verifyPaymeAuth(req.headers.get('authorization'), process.env.PAYME_KEY)) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: PAYME_ERR.INSUFFICIENT_PRIVILEGE, message: 'Insufficient privilege' },
    });
  }

  const rpc = await handlePaymeRpc(body, { db, hooks });
  return NextResponse.json({ jsonrpc: '2.0', id: body?.id ?? null, ...rpc });
}
