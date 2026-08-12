'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, Plus, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { type AccountOrder, FUEL_LABEL, cardCls } from '@/components/account/shared';

// История: order history — date, fuel, ordered vs dispensed, amount, status, tracking.
export function HistorySection({ locale, orders }: { locale: string; orders: AccountOrder[] }) {
  const t = useTranslations('account');
  const fmt = (n: number) => formatMoney(n, locale);
  const dtTag = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';

  const nextScheduled = orders
    .filter((o) => o.status === 'SCHEDULED' && o.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];

  const statusLabel = (status: string): string => (t.has(`status.${status}`) ? t(`status.${status}`) : status);

  return (
    <div className="space-y-4">
      {nextScheduled && (
        <Link
          href={`/${locale}/account/orders/${nextScheduled.id}`}
          className="flex min-h-11 items-center gap-2.5 rounded-card bg-gray-100 dark:bg-white/10 px-4 py-3 text-sm text-navy dark:text-white transition-colors hover:bg-gray-200/70 dark:hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
        >
          <Clock className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          {t('history.scheduledBadge', {
            when: new Date(nextScheduled.scheduledFor!).toLocaleString(dtTag, {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/${locale}/benzin`}>
            <Plus className="h-4 w-4" /> {t('history.new')}
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/${locale}/benzin?schedule=1`}>
            <Clock className="h-4 w-4" /> {t('history.schedule')}
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className={`${cardCls} text-center`}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500">
            <Clock className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{t('history.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const repeat = `/${locale}/benzin?fuel=${o.fuelType}&volume=${o.volume}${o.clientCarId ? `&carId=${o.clientCarId}` : ''}`;
            return (
              <li key={o.id} className="rounded-card border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/${locale}/account/orders/${o.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tabular-nums text-navy dark:text-white">
                      {FUEL_LABEL[o.fuelType] ?? o.fuelType}
                      {o.totalAmount != null ? ` · ${fmt(o.totalAmount)} ${t('sum')}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString(dtTag)} · {statusLabel(o.status)}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {t('history.ordered')}: {o.volume} {t('liters')}
                      {o.dispensedVolume != null ? ` · ${t('history.dispensed')}: ${o.dispensedVolume} ${t('liters')}` : ''}
                    </p>
                  </Link>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-gray-100 dark:border-white/10 pt-3">
                  <Link
                    href={`/${locale}/account/orders/${o.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-primary-600 dark:text-primary-400 transition-colors hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
                  >
                    <Clock className="h-4 w-4" /> {t('history.track')}
                  </Link>
                  <Link
                    href={repeat}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-navy dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
                  >
                    <RotateCcw className="h-4 w-4" /> {t('history.repeat')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
