import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { clientFuelingHistory } from '@/lib/fueling-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// История заправок клиента: чек, объём, сумма, АЗС, дата — Модуль 2 ТЗ v2.

export async function GET() {
  const auth = await getServerSession(authOptions);
  const userId = (auth?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessions = await clientFuelingHistory(userId);
  return NextResponse.json({ sessions });
}
