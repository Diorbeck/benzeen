'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const LAST_CAR_KEY = 'apexoil_last_car_id';
const LAST_ADDRESS_KEY = 'apexoil_last_address';

export function CreateOrderForm() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'ru';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cars, setCars] = useState<
    { id: string; plateNumber: string; fuelType: string; remainingLiters: number }[]
  >([]);
  const t = useTranslations('createOrder');
  const [selected, setSelected] = useState({
    carId: '',
    fuelType: 'AI_95' as 'AI_92' | 'AI_95',
    address: '',
    notes: '',
    volume: 0,
  });

  useEffect(() => {
    fetch('/api/orders/cars')
      .then((r) => r.json())
      .then((data: { id: string; plateNumber: string; fuelType: string; remainingLiters: number }[]) => {
        setCars(data);
        if (typeof window !== 'undefined') {
          const lastCar = localStorage.getItem(LAST_CAR_KEY);
          const lastAddress = localStorage.getItem(LAST_ADDRESS_KEY) || '';
          const first = data[0];
          const preferred = lastCar ? data.find((c) => c.id === lastCar) : null;
          const car = preferred ?? first;
          setSelected((s) => ({
            ...s,
            carId: car?.id ?? '',
            fuelType: (car as { fuelType?: string })?.fuelType === 'AI_92' ? 'AI_92' : 'AI_95',
            address: lastAddress,
            volume: 0,
          }));
        }
      })
      .catch(() => setCars([]));
  }, []);


  const saveAddress = () => {
    if (typeof window !== 'undefined' && selected.address) {
      localStorage.setItem(LAST_ADDRESS_KEY, selected.address);
    }
  };

  const car = cars.find((c) => c.id === selected.carId);
  const maxLiters = car ? Math.max(0, car.remainingLiters) : 0;
  const step = 5;
  const volumeOptions = Array.from(
    { length: Math.floor(maxLiters / step) + 1 },
    (_, i) => i * step
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.carId) {
      setError(t('errors.selectCarVolume'));
      return;
    }
    if (car && car.remainingLiters <= 0) {
      setError(t('errors.limitExhausted') || 'Limit exhausted for this vehicle.');
      return;
    }
    if (selected.volume <= 0) {
      setError(t('errors.selectVolume') || 'Select fuel quantity.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: selected.carId,
          fuelType: selected.fuelType,
          volume: selected.volume,
          isFullTank: false,
          address: selected.address || undefined,
          notes: selected.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка');
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_CAR_KEY, selected.carId);
        if (selected.address) localStorage.setItem(LAST_ADDRESS_KEY, selected.address);
      }
      router.push(`/${locale}/dashboard/orders`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="max-w-lg space-y-8"
    >
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="card-premium p-6">
        <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('car')}
        </label>
        <select
          value={selected.carId}
          onChange={(e) => {
            const nextCar = cars.find((c) => c.id === e.target.value);
            const nextRemaining = nextCar ? nextCar.remainingLiters : 0;
            setSelected((s) => ({
              ...s,
              carId: e.target.value,
              fuelType: nextCar?.fuelType === 'AI_92' ? 'AI_92' : 'AI_95',
              volume: Math.min(s.volume, nextRemaining),
            }));
          }}
          required
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">{t('carPlaceholder')}</option>
          {cars.map((car) => (
            <option key={car.id} value={car.id}>
              {car.plateNumber} — {car.fuelType.replace('_', '-')} (остаток: {car.remainingLiters} л)
            </option>
          ))}
        </select>
      </div>

      <div className="card-premium p-6">
        <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('quantity')}
        </label>
        <p className="mb-2 text-2xl font-semibold text-primary-600 dark:text-primary-400">
          {t('selected')}: {selected.volume} L
        </p>
        <input
          type="range"
          min={0}
          max={maxLiters}
          step={step}
          value={selected.volume}
          onChange={(e) => setSelected((s) => ({ ...s, volume: Number(e.target.value) }))}
          className="w-full accent-primary-600"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('remaining')} {maxLiters} L · {t('step')} {step} L
        </p>
      </div>

      <div className="card-premium p-6">
        <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('address')}
        </label>
        <input
          type="text"
          value={selected.address}
          onChange={(e) => setSelected((s) => ({ ...s, address: e.target.value }))}
          onBlur={saveAddress}
          placeholder={t('addressPlaceholder')}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>

      <div className="card-premium p-6">
        <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('notes')}
        </label>
        <input
          type="text"
          value={selected.notes}
          onChange={(e) => setSelected((s) => ({ ...s, notes: e.target.value }))}
          placeholder={t('notesPlaceholder')}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="flex-1 min-h-[52px] text-base font-semibold"
        >
          {loading ? t('creating') : t('submit')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
          className="min-h-[52px]"
        >
          {t('cancel')}
        </Button>
      </div>
    </motion.form>
  );
}
