import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { buildExportCsv, exportFileName, type ExportKind } from '@/lib/station-export';
import { monthEnd, monthStart } from '@/lib/station-billing';

// Модуль 7 ТЗ v2: выгрузка транзакций через Benzeen для налоговой и для банка.
// Только SUPER_ADMIN: это сводные данные по всем подключённым АЗС страны.

export const dynamic = 'force-dynamic';

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  const params = req.nextUrl.searchParams;
  const kindRaw = params.get('kind') ?? 'soliq';
  if (kindRaw !== 'soliq' && kindRaw !== 'acquiring') {
    return Response.json({ error: 'Unknown export kind' }, { status: 400 });
  }
  const kind: ExportKind = kindRaw;

  const now = new Date();
  const from = parseDate(params.get('from')) ?? monthStart(now);
  const to = parseDate(params.get('to')) ?? monthEnd(now);
  if (from > to) {
    return Response.json({ error: 'Empty period' }, { status: 400 });
  }

  const stationId = params.get('stationId');

  const sessions = await prisma.fuelingSession.findMany({
    where: {
      // В выгрузку идут только рассчитанные заправки и те, что ушли на ручную
      // сверку: резерв без заливки — не транзакция.
      status: { in: ['SETTLED', 'MANUAL_REVIEW'] },
      startedAt: { gte: from, lte: to },
      ...(stationId ? { stationId } : {}),
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      fuelType: true,
      litersDispensed: true,
      amountUzs: true,
      priceUzs: true,
      holdAmountUzs: true,
      refundUzs: true,
      acquirerRef: true,
      soliqSyncedAt: true,
      cashbackUzs: true,
      clientId: true,
      station: { select: { id: true, name: true, tin: true } },
      dispenser: { select: { number: true } },
    },
  });

  const csv = buildExportCsv(kind, sessions);
  // BOM: Excel в Узбекистане открывает CSV в кириллице только с ним.
  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName(kind, from, to)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
