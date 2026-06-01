import { NextResponse } from 'next/server';
import { getTgContext } from '@/lib/tg-auth';

export const runtime = 'nodejs';

// Returns the link status for the current Telegram user. The Mini App calls
// this on startup to decide whether to show the login form or the dashboard.
export async function GET(req: Request) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }

  if (!ctx.driver) {
    return NextResponse.json({
      linked: false,
      tgName: ctx.tgUser.first_name ?? null,
    });
  }

  return NextResponse.json({
    linked: true,
    driver: {
      id: ctx.driver.id,
      name: ctx.driver.name,
      phone: ctx.driver.phone,
    },
  });
}
