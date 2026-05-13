'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Gauge, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressColor } from '@/lib/utils';

const STATUS_CLASSES = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
} as const;

type CarLimit = {
  id: string;
  plateNumber: string;
  model: string | null;
  fuelType: string;
  monthlyLimit: number;
  usedLiters: number;
  remainingLiters: number;
};

export function LimitsList({ cars }: { cars: CarLimit[] }) {
  const t = useTranslations('limits');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const startEdit = (car: CarLimit) => {
    setEditingId(car.id);
    setEditValue(String(car.monthlyLimit));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveLimit = async () => {
    if (!editingId) return;
    const value = parseInt(editValue, 10);
    if (!value || value < 1 || value > 10000) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cars/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyLimit: value }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue('');
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  if (cars.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center dark:border-white/10 dark:bg-white/5">
        <Gauge className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 font-medium text-gray-900 dark:text-white">{t('noCars')}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('noCarsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/50">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('vehicle')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('used')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('limit')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('remaining')}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('status')}
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => {
              const color = getProgressColor(car.usedLiters, car.monthlyLimit);
              const isEditing = editingId === car.id;
              return (
                <tr
                  key={car.id}
                  className="border-b border-gray-100 dark:border-white/5"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {car.plateNumber}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      {car.model || car.fuelType.replace('_', '-')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {car.usedLiters} L
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-9 w-24 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={saveLimit}
                          disabled={saving}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900 dark:text-white">
                        {car.monthlyLimit} L
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {car.remainingLiters} L
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[color]}`}
                    >
                      {color === 'success'
                        ? t('statusWithin')
                        : color === 'warning'
                          ? t('statusNear')
                          : t('statusExceeded')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(car)}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
