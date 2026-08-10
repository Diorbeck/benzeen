// Server-side helpers for the SUPER_ADMIN "Курьеры" section (Курьер 2.0 PR-2).
// DB-aware wrappers around the pure computeBucket helper from courier-stats.ts.
import { prisma } from '@/lib/prisma';
import { COURIER_LOCATION_MAX_AGE_MS } from '@/lib/constants';
import { computeBucket, startOfTashkentDay, type StatBucket } from '@/lib/courier-stats';

/** Statuses that count as an active (in-flight) delivery for a courier. */
export const ACTIVE_COURIER_STATUSES = ['COURIER_ASSIGNED', 'IN_DELIVERY'] as const;

export interface CourierListRow {
  id: string;
  name: string | null;
  phone: string | null;
  vehicleNumber: string | null;
  telegramLinked: boolean;
  onDuty: boolean;
  deactivatedAt: Date | null;
  /** Last known live-location timestamp, or null if the courier never shared. */
  locationUpdatedAt: Date | null;
  /** Whether the last location is fresh enough to receive orders. */
  locationFresh: boolean;
  activeOrders: number;
  deliveredToday: number;
  litersToday: number;
}

/**
 * Fetches the full courier roster with the per-courier signals the admin list
 * needs: TG-linked, on-duty, location freshness, active-order count, and
 * today's delivered orders + liters. Uses grouped aggregates to avoid N+1.
 */
export async function fetchCourierList(now: Date = new Date()): Promise<CourierListRow[]> {
  const todayStart = startOfTashkentDay(now);

  const [couriers, activeGroups, deliveredGroups] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'COURIER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleNumber: true,
        telegramId: true,
        onDuty: true,
        deactivatedAt: true,
        courierLocation: { select: { updatedAt: true } },
      },
    }),
    prisma.order.groupBy({
      by: ['assignedToId'],
      where: { assignedToId: { not: null }, status: { in: [...ACTIVE_COURIER_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { not: null },
        status: 'DELIVERED',
        deliveredAt: { gte: todayStart },
      },
      _count: { _all: true },
      _sum: { dispensedVolume: true },
    }),
  ]);

  const activeBy = new Map(activeGroups.map((g) => [g.assignedToId, g._count._all]));
  const deliveredBy = new Map(
    deliveredGroups.map((g) => [
      g.assignedToId,
      { count: g._count._all, liters: g._sum.dispensedVolume ?? 0 },
    ]),
  );

  const freshCutoff = now.getTime() - COURIER_LOCATION_MAX_AGE_MS;

  return couriers.map((c) => {
    const locUpdated = c.courierLocation?.updatedAt ?? null;
    const delivered = deliveredBy.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      vehicleNumber: c.vehicleNumber,
      telegramLinked: c.telegramId != null,
      onDuty: c.onDuty,
      deactivatedAt: c.deactivatedAt,
      locationUpdatedAt: locUpdated,
      locationFresh: locUpdated != null && locUpdated.getTime() >= freshCutoff,
      activeOrders: activeBy.get(c.id) ?? 0,
      deliveredToday: delivered?.count ?? 0,
      litersToday: delivered?.liters ?? 0,
    };
  });
}

/**
 * Delivery stats (count / liters / avg TAKE→DELIVERED) for one courier over a
 * half-open UTC window `[start, end)`.
 */
export async function courierRangeStats(
  courierId: string,
  start: Date,
  end: Date,
): Promise<StatBucket> {
  const rows = await prisma.order.findMany({
    where: {
      assignedToId: courierId,
      status: 'DELIVERED',
      deliveredAt: { gte: start, lt: end },
    },
    select: { deliveredAt: true, takenAt: true, dispensedVolume: true },
  });
  return computeBucket(rows);
}

export interface CourierExportAggregate {
  name: string | null;
  phone: string | null;
  bucket: StatBucket;
}

/**
 * Per-courier delivery AGGREGATES for the CSV export over `[start, end)`.
 * Returns ONLY courier identity + their own aggregate numbers — never any
 * client data. One row per courier that delivered at least one order.
 */
export async function courierExportAggregates(
  start: Date,
  end: Date,
): Promise<CourierExportAggregate[]> {
  const rows = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { gte: start, lt: end },
      assignedToId: { not: null },
      // Only real couriers (defensive — assignedToId should already be one).
      assignedTo: { role: 'COURIER' },
    },
    select: {
      assignedToId: true,
      deliveredAt: true,
      takenAt: true,
      dispensedVolume: true,
      assignedTo: { select: { name: true, phone: true } },
    },
  });

  const byCourier = new Map<
    string,
    { name: string | null; phone: string | null; rows: { deliveredAt: Date | null; takenAt: Date | null; dispensedVolume: number | null }[] }
  >();
  for (const r of rows) {
    if (!r.assignedToId) continue;
    let entry = byCourier.get(r.assignedToId);
    if (!entry) {
      entry = { name: r.assignedTo?.name ?? null, phone: r.assignedTo?.phone ?? null, rows: [] };
      byCourier.set(r.assignedToId, entry);
    }
    entry.rows.push({
      deliveredAt: r.deliveredAt,
      takenAt: r.takenAt,
      dispensedVolume: r.dispensedVolume,
    });
  }

  return [...byCourier.values()]
    .map((e) => ({ name: e.name, phone: e.phone, bucket: computeBucket(e.rows) }))
    .sort((a, b) => b.bucket.count - a.bucket.count);
}

/** Escapes one CSV cell (RFC 4180): quote when it contains `" , \n`. */
export function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds the privacy-critical courier CSV. Columns are ONLY: courier name,
 * courier phone, orders delivered, total liters, average delivery time. NO
 * client data of any kind (no client names/phones/addresses). `avgLabel`
 * formats the average duration into a human string.
 */
export function buildCourierCsv(
  aggregates: CourierExportAggregate[],
  headers: [string, string, string, string, string],
  avgLabel: (ms: number | null) => string,
): string {
  const body = aggregates.map((a) => [
    a.name ?? '',
    a.phone ?? '',
    a.bucket.count,
    a.bucket.liters,
    avgLabel(a.bucket.avgTakeToDeliverMs),
  ]);
  // Prepend a UTF-8 BOM so Excel reads Cyrillic correctly.
  return (
    '﻿' +
    [headers, ...body].map((r) => r.map(csvCell).join(',')).join('\n')
  );
}
