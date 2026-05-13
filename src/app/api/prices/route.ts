import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const prices = await prisma.price.findMany();
    return NextResponse.json(prices);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
