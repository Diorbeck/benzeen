'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Car, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProgressColor } from '@/lib/utils';

const PROGRESS_CLASSES = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
} as const;

export function CarsList({
  cars,
}: {
  cars: {
    id: string;
    plateNumber: string;
    model: string | null;
    fuelType: string;
    monthlyLimit: number;
    usedLiters: number;
    remainingLiters: number;
  }[];
}) {
  const t = useTranslations('cars');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link href={`/${locale}/dashboard/cars/new`}>
            <Plus className="h-4 w-4" />
            {t('addCar')}
          </Link>
        </Button>
      </div>

      {cars.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-premium flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 rounded-2xl bg-primary-500/10 p-5">
            <Car className="h-14 w-14 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('noCars')}
          </h3>
          <p className="mt-2 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
            {t('noCarsDesc')}
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link href={`/${locale}/dashboard/cars/new`}>{t('addCar')}</Link>
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car, i) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-premium p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary-500/10 p-2">
                  <Car className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {car.plateNumber}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {car.model || car.fuelType.replace('_', '-')}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('used')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {car.usedLiters} / {car.monthlyLimit} L
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${PROGRESS_CLASSES[getProgressColor(car.usedLiters, car.monthlyLimit)]}`}
                    style={{
                      width: `${Math.min(100, (car.usedLiters / car.monthlyLimit) * 100)}%`,
                    }}
                  />
                </div>
                <p
                  className={
                    car.remainingLiters <= 0
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : getProgressColor(car.usedLiters, car.monthlyLimit) === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-primary-600 dark:text-primary-400'
                  }
                >
                  {car.remainingLiters <= 0
                    ? t('limitExhausted')
                    : t('remainingShort', { remaining: car.remainingLiters })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
