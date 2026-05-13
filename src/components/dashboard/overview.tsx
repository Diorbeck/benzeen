'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel, Car, Package, TrendingUp, AlertTriangle, Zap, Truck } from 'lucide-react';
import { UsageChart } from './usage-chart';
import { getProgressColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_KEY: Record<string, string> = {
  CREATED: 'created',
  RECEIVED: 'received',
  COURIER_ASSIGNED: 'courierAssigned',
  IN_DELIVERY: 'inDelivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  PENDING_APPROVAL: 'received',
  ASSIGNED: 'courierAssigned',
  ON_ROUTE: 'inDelivery',
  CLOSED: 'delivered',
  REJECTED: 'cancelled',
};

export function DashboardOverview({
  remainingLiters,
  totalLitersUsed,
  recentOrders,
  pendingOrders,
  carsCount,
  deliveredToday,
  perCar,
  role,
}: {
  remainingLiters: number;
  totalLitersUsed: number;
  recentOrders: { id: string; volume: number; status: string; fuelType: string; plateNumber?: string }[];
  pendingOrders: { id: string; volume: number; status: string }[];
  carsCount: number;
  deliveredToday?: number;
  perCar?: { plateNumber: string; used: number; limit: number }[];
  role?: string;
}) {
  const t = useTranslations('dashboard');
  const tStatus = useTranslations('orders.status');
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'ru';

  const kpis = [
    {
      icon: Fuel,
      label: t('kpi.remaining'),
      value: remainingLiters.toLocaleString(),
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-500/10',
    },
    {
      icon: Car,
      label: t('kpi.activeCars'),
      value: String(carsCount),
      color: 'text-amber-accent',
      bg: 'bg-amber-accent/10',
    },
    {
      icon: Package,
      label: t('kpi.pendingApprovals'),
      value: String(pendingOrders.length),
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Truck,
      label: t('kpi.deliveredToday'),
      value: String(deliveredToday ?? 0),
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: TrendingUp,
      label: t('kpi.used'),
      value: totalLitersUsed.toLocaleString(),
      color: 'text-petrol-500',
      bg: 'bg-petrol-500/10',
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      {pendingOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 dark:border-amber-500/20"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t('pendingBanner.text', { count: pendingOrders.length })}
              </p>
              <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                {t('pendingBanner.desc')}
              </p>
              <Link
                href={`/${locale}/dashboard/orders`}
                className="mt-2 inline-flex text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
              >
                {t('pendingBanner.link')} →
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-premium group p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {kpi.value}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {perCar && perCar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-premium p-6"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('perCar.title')}
          </h2>
          <div className="space-y-4">
            {perCar.map((car) => {
              const pct = car.limit > 0 ? (car.used / car.limit) * 100 : 0;
              const colorKey = getProgressColor(car.used, car.limit);
              const colorClass =
                colorKey === 'danger'
                  ? 'bg-red-500'
                  : colorKey === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';
              return (
                <div key={car.plateNumber}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{car.plateNumber}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {car.used} / {car.limit} л
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all', colorClass)}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-premium p-6"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('chart.title')}
          </h2>
          <UsageChart />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card-premium overflow-hidden"
        >
          <div className="border-b border-gray-200/60 px-6 py-4 dark:border-white/[0.07]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('recentOrders.title')}
            </h2>
          </div>
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {recentOrders.map((order, i) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {order.plateNumber ?? order.fuelType.replace('_', '-')}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {order.volume} л · {order.fuelType.replace('_', '-')}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      order.status === 'CREATED' || order.status === 'RECEIVED'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : order.status === 'DELIVERED'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    }`}
                  >
                    {tStatus(STATUS_KEY[order.status] || order.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-2xl bg-gray-100/80 p-4 dark:bg-white/5">
                <Zap className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('recentOrders.empty')}
              </p>
              <p className="mt-1 max-w-[240px] text-sm text-gray-500 dark:text-gray-400">
                {t('recentOrders.emptyDesc')}
              </p>
              <Link
                href={`/${locale}/dashboard/orders`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-500"
              >
                {t('recentOrders.viewOrders')}
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
