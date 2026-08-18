'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { asGasoline, calcOrderPrice, type FuelType } from '@/lib/pricing';
import { B2C_MIN_ORDER_LITERS } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { track } from '@/lib/analytics';

// Левая карточка первого экрана — главное действие: доставить топливо к машине.
// Цена считается по тем же ценам из таблицы Price, что и в полном флоу заказа,
// поэтому сумма на главной не расходится с суммой на шаге оплаты.

const FUELS: FuelType[] = ['AI_92', 'AI_95', 'AI_100'];
const FUEL_LABEL: Record<FuelType, string> = {
  AI_92: 'АИ-92',
  AI_95: 'АИ-95',
  AI_100: 'АИ-100',
};
const MAX_LITERS = 100;

export function OrderPanel({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  const router = useRouter();
  const [fuel, setFuel] = useState<FuelType>('AI_92');
  const [liters, setLiters] = useState(40);
  const [prices, setPrices] = useState<Partial<Record<FuelType, number>>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/prices')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('request failed'))))
      .then((rows: { fuelType: string; priceUzs: number }[]) => {
        if (cancelled) return;
        const next: Partial<Record<FuelType, number>> = {};
        for (const row of rows) {
          const f = asGasoline(row.fuelType);
          if (f) next[f] = row.priceUzs;
        }
        setPrices(next);
      })
      // Без цен карточка всё равно работает: сумма скрывается, заказ доступен.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const pricePerLiter = prices[fuel];
  const total = useMemo(
    () => (pricePerLiter ? calcOrderPrice({ pricePerLiter, volume: liters }).total : null),
    [pricePerLiter, liters],
  );

  const startOrder = (where: string) => {
    track('gasoline_order_clicked', { where });
    router.push(`/${locale}/benzin?fuel=${fuel}&volume=${liters}`);
  };

  const fillRatio = (liters - B2C_MIN_ORDER_LITERS) / (MAX_LITERS - B2C_MIN_ORDER_LITERS);

  return (
    <section className="flex flex-col rounded-card border border-gray-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">
            {t('console.orderEyebrow')}
          </p>
          <h2 className="mt-2 text-subheading text-navy dark:text-white sm:text-heading">
            {t('console.orderTitle')}
          </h2>
        </div>
        <p className="flex items-center gap-1.5 text-caption font-medium text-success-600 dark:text-success-500">
          <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden />
          {t('console.couriersOnline')}
        </p>
      </div>

      <div className="mt-5 flex-1 space-y-5">
        <div>
          <label className="text-caption font-medium text-gray-500 dark:text-gray-400" htmlFor="order-address">
            {t('console.addressLabel')}
          </label>
          <button
            id="order-address"
            type="button"
            onClick={() => startOrder('console_address')}
            className="mt-1.5 flex h-12 w-full items-center gap-2.5 rounded-control border border-gray-200 bg-canvas px-3.5 text-left text-body text-gray-500 transition-colors hover:border-sky-400 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-400 dark:hover:border-sky-400 dark:hover:text-white"
          >
            <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
            {t('widgetWhere')}
          </button>
        </div>

        <div>
          <p className="text-caption font-medium text-gray-500 dark:text-gray-400">{t('console.fuelLabel')}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {FUELS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFuel(f)}
                aria-pressed={fuel === f}
                className={`h-11 rounded-control text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 ${
                  fuel === f
                    ? 'bg-navy text-white dark:bg-primary-600'
                    : 'border border-gray-200 bg-white text-gray-700 hover:border-sky-400 hover:text-navy dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200 dark:hover:border-sky-400 dark:hover:text-white'
                }`}
              >
                {FUEL_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-caption font-medium text-gray-500 dark:text-gray-400" htmlFor="order-liters">
              {t('console.volumeLabel')}
            </label>
            <output
              htmlFor="order-liters"
              className="text-base font-bold tabular-nums text-sky-600 dark:text-sky-300"
            >
              {t('console.liters', { n: liters })}
            </output>
          </div>
          <input
            id="order-liters"
            type="range"
            min={B2C_MIN_ORDER_LITERS}
            max={MAX_LITERS}
            step={5}
            value={liters}
            onChange={(e) => setLiters(Number(e.target.value))}
            className="benzeen-range mt-2.5 w-full"
            style={{ ['--range-fill' as string]: `${Math.round(fillRatio * 100)}%` }}
          />
          <div className="mt-1 flex justify-between text-caption text-gray-400 dark:text-gray-500">
            <span>{t('console.liters', { n: B2C_MIN_ORDER_LITERS })}</span>
            <span>{t('console.liters', { n: MAX_LITERS })}</span>
          </div>
        </div>

        <dl className="space-y-2 border-t border-gray-100 pt-4 dark:border-navy-700">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-gray-600 dark:text-gray-400">{t('console.costLabel')}</dt>
            <dd className="text-lg font-bold tabular-nums text-navy dark:text-white">
              {total === null ? '—' : formatMoney(total, locale)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-gray-600 dark:text-gray-400">{t('console.etaLabel')}</dt>
            <dd className="text-sm font-semibold text-sky-600 dark:text-sky-300">{t('console.etaValue')}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {t('console.orderNote')}
      </p>
      <Button size="lg" className="mt-3 w-full" onClick={() => startOrder('console_cta')}>
        {t('console.cta')}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </section>
  );
}
