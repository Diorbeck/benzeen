import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { tashkentRangeToUtc, formatAvgDuration } from '@/lib/courier-stats';
import { courierExportAggregates, buildCourierCsv } from '@/lib/courier-admin';

export const runtime = 'nodejs';

/**
 * Privacy-critical courier CSV export (SUPER_ADMIN only, admin UI only — there
 * is deliberately NO courier self-export). Exports per-courier AGGREGATES for a
 * chosen period. Columns are ONLY: courier name, courier phone, orders
 * delivered, total liters, average delivery time. NEVER any client data (no
 * client names/phones/addresses) — same privacy bar as the DB backups. Every
 * export is written to the AuditLog.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { role, id: actorId, email: actorEmail } = session.user as {
    role?: string;
    id?: string;
    email?: string;
  };
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const locale = url.searchParams.get('locale') || 'ru';
  const { start, end } = tashkentRangeToUtc(from, to);

  const t = await getTranslations({ locale, namespace: 'adminCouriers.csv' });
  const aggregates = await courierExportAggregates(start, end);

  const csv = buildCourierCsv(
    aggregates,
    [t('colName'), t('colPhone'), t('colOrders'), t('colLiters'), t('colAvgTime'), t('colAvgRating')],
    formatAvgDuration,
  );

  // Audit the export itself (privacy-sensitive). Metadata carries only the
  // period + row count — no courier or client PII.
  await writeAuditLog({
    action: 'COURIER_CSV_EXPORT',
    targetType: 'CourierExport',
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    metadata: {
      from: from ?? null,
      to: to ?? null,
      couriers: aggregates.length,
    },
  });

  const stamp = `${(from || 'start').slice(0, 10)}_${(to || 'today').slice(0, 10)}`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="couriers_${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
