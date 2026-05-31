'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Car, Plus, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProgressColor } from '@/lib/utils';

const PROGRESS_CLASSES = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
} as const;

type CarRow = {
  id: string;
  plateNumber: string;
  model: string | null;
  fuelType: string;
  monthlyLimit: number;
  usedLiters: number;
  remainingLiters: number;
};

export function CarsList({ cars }: { cars: CarRow[] }) {
  const t = useTranslations('cars');
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editModel, setEditModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (car: CarRow) => {
    setEditingId(car.id);
    setEditPlate(car.plateNumber);
    setEditModel(car.model ?? '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const plate = editPlate.trim();
    if (!plate) {
      setError(t('plateRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/cars/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: plate,
          model: editModel.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'PLATE_EXISTS' ? t('plateExists') : t('saveError'));
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

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
          {cars.map((car, i) => {
            const isEditing = editingId === car.id;
            return (
              <motion.div
                key={car.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-premium p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary-500/10 p-2">
                      <Car className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    {!isEditing && (
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {car.plateNumber}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {car.model || car.fuelType.replace('_', '-')}
                        </p>
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(car)}
                      className="text-gray-500 dark:text-gray-400"
                      aria-label={t('edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    {error && (
                      <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                        {error}
                      </p>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        {t('plateLabel')}
                      </label>
                      <input
                        value={editPlate}
                        onChange={(e) => setEditPlate(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                        {t('modelLabel')}
                      </label>
                      <input
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                        {t('cancel')}
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        <Check className="h-4 w-4" />
                        {t('save')}
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
