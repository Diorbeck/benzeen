import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { PendingReviewList, type PendingRow } from '@/components/dashboard/pending-review-list';

const dtf = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

const REASONS = ['FRIEND_FIRST_ORDER', 'TEN_FRIENDS_MILESTONE', 'SPENT', 'REFUND', 'ADMIN_ADJUSTMENT'] as const;

export default async function BonusesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminBonus');

  // Summary from POSTED rows only.
  const byReason = await prisma.bonusLedger.groupBy({
    by: ['reason'],
    where: { status: 'POSTED' },
    _sum: { liters: true },
  });
  let accrued = 0;
  let spent = 0;
  for (const g of byReason) {
    const s = g._sum.liters ?? 0;
    if (g.reason === 'SPENT') spent += s;
    else accrued += s;
  }
  const current = Math.max(0, accrued - spent);

  // Top-10 referrers by POSTED FRIEND_FIRST_ORDER count.
  const top = await prisma.bonusLedger.groupBy({
    by: ['userId'],
    where: { status: 'POSTED', reason: 'FRIEND_FIRST_ORDER' },
    _count: { _all: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 10,
  });
  const topUsers = await prisma.user.findMany({
    where: { id: { in: top.map((x) => x.userId) } },
    select: { id: true, name: true, phone: true },
  });
  const topRows = top.map((x) => {
    const u = topUsers.find((y) => y.id === x.userId);
    return { id: x.userId, name: u?.name || u?.phone || '—', count: x._count._all };
  });

  // PENDING review queue.
  const pending = await prisma.bonusLedger.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, liters: true, createdAt: true, user: { select: { name: true, phone: true } } },
  });
  const pendingRows: PendingRow[] = pending.map((p) => ({
    id: p.id,
    liters: p.liters,
    createdAt: p.createdAt.toISOString(),
    userName: p.user?.name ?? '',
    userPhone: p.user?.phone ?? '',
  }));

  // Filtered full ledger.
  const where: Prisma.BonusLedgerWhereInput = {};
  if (sp.reason && (REASONS as readonly string[]).includes(sp.reason)) {
    where.reason = sp.reason as Prisma.BonusLedgerWhereInput['reason'];
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (sp.from) {
    const d = new Date(sp.from);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (sp.to) {
    const d = new Date(sp.to);
    if (!Number.isNaN(d.getTime())) createdAt.lte = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const ledger = await prisma.bonusLedger.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      liters: true,
      reason: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  });

  const summaryCards = [
    { label: t('accrued'), value: accrued, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('spent'), value: spent, tone: 'text-gray-600 dark:text-gray-300' },
    { label: t('current'), value: current, tone: 'text-primary-600 dark:text-primary-400' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('bonusesTitle')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('bonusesSubtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="card-premium p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>
              {c.value} <span className="text-sm font-medium">{t('liters')}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-premium space-y-3 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('topReferrers')}</h2>
          {topRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('none')}</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {topRows.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/${locale}/dashboard/clients/${r.id}`}
                    className="truncate text-gray-700 hover:text-primary-600 dark:text-gray-200"
                  >
                    {i + 1}. {r.name}
                  </Link>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {r.count} {t('referralsCount')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="card-premium space-y-3 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('pendingTitle')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pendingSubtitle')}</p>
          <PendingReviewList rows={pendingRows} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('fullLedger')}</h2>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('filterReason')}</label>
            <select
              name="reason"
              defaultValue={sp.reason ?? ''}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">{t('filterAll')}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason_${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('date')}</label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ''}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">—</label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ''}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            {t('filterReason')}
          </button>
        </form>

        <div className="card-premium overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">{t('date')}</th>
                  <th className="px-4 py-3 font-medium">{t('user')}</th>
                  <th className="px-4 py-3 font-medium">{t('reason')}</th>
                  <th className="px-4 py-3 font-medium">{t('status')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('liters')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {t('none')}
                    </td>
                  </tr>
                ) : (
                  ledger.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-white/5">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {dtf.format(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/dashboard/clients/${row.user?.id}`}
                          className="text-gray-700 hover:text-primary-600 dark:text-gray-200"
                        >
                          {row.user?.name || row.user?.phone || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t(`reason_${row.reason}`)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t(`status_${row.status}`)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {row.reason === 'SPENT' ? '−' : '+'}
                        {row.liters}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
