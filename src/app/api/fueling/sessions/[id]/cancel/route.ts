import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FuelingError } from '@/lib/fueling';
import { AcquiringError } from '@/lib/acquiring';
import { cancelFuelingSession } from '@/lib/fueling-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Отмена до начала заливки: резерв размораживается сразу, а не «в течение
// нескольких дней» — иначе клиент второй раз к колонке не подойдёт.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  const userId = (auth?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cancelFuelingSession(id, userId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof FuelingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    if (e instanceof AcquiringError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 503 });
    }
    throw e;
  }
}
