import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bonusBalanceFrom } from '@/lib/bonus';
import { UserRound, Snowflake } from 'lucide-react';

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminBonus');
  const query = (q ?? '').trim();

  const clients = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      lastName: true,
      phone: true,
      bonusFrozen: true,
      bonusLedger: { select: { liters: true, reason: true, status: true } },
      _count: { select: { clientOrders: true, clientCars: true, referrals: true } },
    },
  });

  const rows = clients.map((c) => ({
    id: c.id,
    name: [c.name, c.lastName].filter(Boolean).join(' ') || '—',
    phone: c.phone ?? '—',
    frozen: c.bonusFrozen,
    balance: bonusBalanceFrom(c.bonusLedger),
    orders: c._count.clientOrders,
    cars: c._count.clientCars,
    referrals: c._count.referrals,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('clientsTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('clientsSubtitle')}</p>
      </div>

      <form className="max-w-md">
        <input
          name="q"
          defaultValue={query}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noClients')}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/${locale}/dashboard/clients/${r.id}`}
              className="card-premium flex items-center justify-between gap-4 p-4 transition hover:border-primary-500/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-primary-500/10 p-2.5">
                  <UserRound className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {r.name}
                    {r.frozen && (
                      <Snowflake className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label={t('frozenBadge')} />
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {r.phone} · {t('orders')}: {r.orders} · {t('cars')}: {r.cars} ·{' '}
                    {t('whoTheyReferred')}: {r.referrals}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {r.balance} {t('liters')}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('balance')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
