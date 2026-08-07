import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// Max size accepted server-side (the client already compresses to ~1600px, but we
// re-enforce here so the endpoint is safe on its own). 5 MB per the spec.
const MAX_BYTES = 5 * 1024 * 1024;

async function ownCar(carId: string) {
  const client = await getCurrentClient();
  if (!client) return { error: 'unauthorized' as const };
  const car = await prisma.clientCar.findFirst({
    where: { id: carId, userId: client.id },
    select: { id: true, photoUrl: true },
  });
  if (!car) return { error: 'not_found' as const };
  return { userId: client.id, car };
}

// Upload (or replace) the car photo. The client sends the already-compressed image
// as the raw request body with a Content-Type of image/*. On replace we delete the
// previous blob so storage never leaks.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  try {
    const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg';
    const blob = await put(`cars/${id}/photo.${ext}`, Buffer.from(bytes), {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });

    const previous = owned.car.photoUrl;
    const car = await prisma.clientCar.update({
      where: { id },
      data: { photoUrl: blob.url },
      select: { id: true, photoUrl: true },
    });

    // Delete the old blob after the pointer is safely moved.
    if (previous && previous !== blob.url) {
      try {
        await del(previous);
      } catch (err) {
        console.error('[account/cars photo del-old]', err);
      }
    }

    return NextResponse.json(car);
  } catch (err) {
    console.error('[account/cars photo POST]', err);
    // No BLOB_READ_WRITE_TOKEN (e.g. local dev) surfaces here — report cleanly.
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}

// Remove the car photo (clears the pointer and deletes the blob).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownCar(id);
  if ('error' in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === 'unauthorized' ? 401 : 404 });
  }

  const previous = owned.car.photoUrl;
  await prisma.clientCar.update({ where: { id }, data: { photoUrl: null } });
  if (previous) {
    try {
      await del(previous);
    } catch (err) {
      console.error('[account/cars photo DELETE]', err);
    }
  }
  return NextResponse.json({ ok: true });
}
