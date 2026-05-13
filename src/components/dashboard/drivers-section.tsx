'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Users, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DriversSection({
  drivers,
  cars,
}: {
  drivers: { id: string; name: string; email: string; carIds: string[] }[];
  cars: { id: string; plateNumber: string }[];
}) {
  const t = useTranslations('drivers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    carId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          phone: form.phone.trim(),
          password: form.password,
          carId: form.carId.trim(),
        }),
      });
      const contentType = res.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await res.json()
        : { error: res.ok ? t('error') : 'Request failed' };
      if (!res.ok) {
        setError(data.error || t('error'));
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-premium p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          {t('addDriver')}
        </h2>
        {error && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('nameLabel')}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('phoneLabel')}
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder={t('phonePlaceholder')}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('passwordLabel')}
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={t('passwordPlaceholder')}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('carLabel')}
            </label>
            <select
              value={form.carId}
              onChange={(e) => setForm((f) => ({ ...f, carId: e.target.value }))}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">{t('selectCar')}</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.plateNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? t('creating') : t('addDriver')}
            </Button>
          </div>
        </form>
      </div>
      {drivers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-premium flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 rounded-2xl bg-primary-500/10 p-5">
            <Users className="h-14 w-14 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Нет водителей
          </h3>
          <p className="mt-2 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
            Добавьте водителей через настройки компании, чтобы они могли создавать заказы
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver, i) => (
            <motion.div
              key={driver.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-premium p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary-500/10 p-2">
                  <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {driver.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {driver.email}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Привязанные машины:
                </p>
                {driver.carIds.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Нет привязанных машин
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {driver.carIds.map((carId) => {
                      const car = cars.find((c) => c.id === carId);
                      return (
                        <span
                          key={carId}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400"
                        >
                          <Car className="h-3 w-3" />
                          {car?.plateNumber || carId}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
