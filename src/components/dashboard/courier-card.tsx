'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bike, Package, Droplet, Timer, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Courier = {
  id: string;
  name: string | null;
  phone: string | null;
  vehicleNumber: string | null;
  telegramLinked: boolean;
  onDuty: boolean;
  deactivated: boolean;
};

type HistoryRow = {
  id: string;
  fuelType: string;
  liters: number;
  taken: string;
  delivered: string;
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

export function CourierCard({
  courier,
  stats,
  history,
  range,
  locale,
}: {
  courier: Courier;
  stats: { orders: number; liters: number; avgTime: string };
  history: HistoryRow[];
  range: { from: string; to: string };
  locale: string;
}) {
  const t = useTranslations('adminCouriers');
  const router = useRouter();

  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const applyRange = () => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    router.push(`/${locale}/dashboard/couriers/${courier.id}?${qs.toString()}`);
  };

  const toggle = async () => {
    if (!courier.deactivated && !window.confirm(t('confirmDeactivate'))) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/couriers/${courier.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deactivated: !courier.deactivated }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t('toggleFailed'));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-premium flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary-500/10 p-3">
            <Bike className="h-6 w-6 text-primary-800 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              {courier.name || '—'}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                  courier.deactivated
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400'
                }`}
              >
                {courier.deactivated ? t('statusDeactivated') : t('statusActive')}
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {courier.phone || '—'}
              {courier.vehicleNumber ? ` · ${courier.vehicleNumber}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant={courier.deactivated ? 'primary' : 'secondary'}
            size="sm"
            onClick={toggle}
            disabled={busy}
            className={courier.deactivated ? '' : 'border-red-500/30 text-red-600 dark:text-red-400'}
          >
            {courier.deactivated ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            {busy ? t('working') : courier.deactivated ? t('activate') : t('deactivate')}
          </Button>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      {/* Stats + range */}
      <div className="card-premium space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('statsTitle')}</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('periodFrom')}
              </label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('periodTo')}
              </label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
            <Button variant="secondary" size="sm" onClick={applyRange}>
              {t('applyRange')}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={<Package className="h-4 w-4" />} label={t('statOrders')} value={String(stats.orders)} />
          <StatTile icon={<Droplet className="h-4 w-4" />} label={t('statLiters')} value={`${stats.liters} ${t('litersUnit')}`} />
          <StatTile icon={<Timer className="h-4 w-4" />} label={t('statAvgTime')} value={stats.avgTime} />
        </div>
      </div>

      {/* Order history */}
      <div className="card-premium p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('historyTitle')}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <th className="px-3 py-2">{t('histFuel')}</th>
                  <th className="px-3 py-2">{t('histLiters')}</th>
                  <th className="px-3 py-2">{t('histTaken')}</th>
                  <th className="px-3 py-2">{t('histDelivered')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{h.fuelType}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-900 dark:text-white">{h.liters}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{h.taken}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{h.delivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
