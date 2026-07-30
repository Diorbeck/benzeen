import { NextResponse } from 'next/server';
import { redispatchStale } from '@/lib/order-dispatch';

export const runtime = 'nodejs';

// Daily formal backstop (Hobby plan allows only once-a-day crons). The real
// re-dispatch happens in near-real-time from system activity — every B2C order
// creation and every courier take calls redispatchStale() — so this cron is
// just a safety net for quiet periods. See src/lib/order-dispatch.ts.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const broadcast = await redispatchStale();
  return NextResponse.json({ ok: true, broadcast });
}
