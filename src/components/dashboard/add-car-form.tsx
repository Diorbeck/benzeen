'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function AddCarForm() {
  const t = useTranslations('addCarForm');
  const tCommon = useTranslations('common.cta');
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    plateNumber: '',
    model: '',
    fuelType: 'AI_95' as 'AI_92' | 'AI_95' | 'AI_100',
    monthlyLimit: 200,
    tankCapacity: 80,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: form.plateNumber.trim().toUpperCase(),
          model: form.model.trim() || undefined,
          fuelType: form.fuelType,
          monthlyLimit: Number(form.monthlyLimit) || 200,
          tankCapacity: Number(form.tankCapacity) || 80,
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
      router.push(`/${locale}/dashboard/cars`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="card-premium max-w-md space-y-6 p-6"
    >
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('plateNumber')} *
        </label>
        <input
          value={form.plateNumber}
          onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
          placeholder="01A123BC"
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('model')}
        </label>
        <input
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          placeholder={t('modelPlaceholder')}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('fuelType')}
        </label>
        <select
          value={form.fuelType}
          onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value as 'AI_92' | 'AI_95' | 'AI_100' }))}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="AI_92">{t('ai92')}</option>
          <option value="AI_95">{t('ai95')}</option>
          <option value="AI_100">{t('ai100')}</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('monthlyLimit')}
        </label>
        <input
          type="number"
          min={1}
          value={form.monthlyLimit}
          onChange={(e) => setForm((f) => ({ ...f, monthlyLimit: parseInt(e.target.value, 10) || 0 }))}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('tankCapacity')}
        </label>
        <input
          type="number"
          min={1}
          max={80}
          value={form.tankCapacity}
          onChange={(e) => setForm((f) => ({ ...f, tankCapacity: parseInt(e.target.value, 10) || 0 }))}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? t('saving') : t('add')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          {tCommon('cancel')}
        </Button>
      </div>
    </motion.form>
  );
}
