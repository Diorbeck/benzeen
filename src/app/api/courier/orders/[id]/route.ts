import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';
import { applyCourierAction } from '@/lib/courier-actions';

const schema = z.object({
  action: z.enum(['TAKE', 'ON_ROUTE', 'DELIVERED']),
  volume: z.number().int().min(1).max(FULL_TANK_MAX_LITERS).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as { role?: string };
    if (role !== 'COURIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const courierId = (session.user as { id: string }).id;
    const { id } = await params;
    const body = await req.json();
    const data = schema.parse(body);

    const result = await applyCourierAction(courierId, id, data.action, data.volume);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.order);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
