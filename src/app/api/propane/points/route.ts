import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public list of propane points for /propan: active + paused (status shown in
// UI so a paused point explains itself instead of disappearing).
export async function GET() {
  const points = await prisma.propanePoint.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      status: true,
      priceUzs: true,
      postsCount: true,
    },
  });
  return NextResponse.json({ points });
}
