'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus, X } from 'lucide-react';

// Модуль 7 ТЗ v2: подключение резервуаров и колонок к подписке и правка ставки
// прямо из админки. Отключение закрывает строку подписки датой, поэтому уже
// выставленные счета не меняются.

export type SubscriptionTargetView = {
  targetId: string;
  item: 'TANK' | 'DISPENSER';
  label: string;
  active: boolean;
  dailyRateUzs: number;
};

export function SubscriptionControls({
  stationId,
  targets,
  dailyUzs,
}: {
  stationId: string;
  targets: readonly SubscriptionTargetView[];
  /** Сколько АЗС платит в сутки по текущим подключениям. */
  dailyUzs: number;
}) {
  const t = useTranslations('adminStations');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});

  async function send(target: SubscriptionTargetView, action: 'enable' | 'disable') {
    setBusyId(target.targetId);
    setError(null);
    try {
      const res = await fetch('/api/admin/stations/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          item: target.item,
          targetId: target.targetId,
          action,
          dailyRateUzs: action === 'enable' ? rates[target.targetId] : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t('saveError'));
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError(t('saveError'));
    } finally {
      setBusyId(null);
    }
  }

  const tanks = targets.filter((x) => x.item === 'TANK');
  const dispensers = targets.filter((x) => x.item === 'DISPENSER');

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          {t('subscriptionTitle')}
        </p>
        <p className="text-sm font-semibold tabular-nums text-navy dark:text-white">
          {dailyUzs.toLocaleString('ru-RU')}{' '}
          <span className="text-caption font-medium text-gray-500 dark:text-gray-400">
            {t('perDay')}
          </span>
        </p>
      </div>
      {error && (
        <p className="mt-2 rounded-control bg-warning-500/10 px-2.5 py-1.5 text-caption font-medium text-warning-600">
          {error}
        </p>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Group title={t('tanks')} items={tanks} />
        <Group title={t('dispensers')} items={dispensers} />
      </div>
    </div>
  );

  function Group({ title, items }: { title: string; items: readonly SubscriptionTargetView[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-caption uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <ul className="mt-2 space-y-2">
          {items.map((target) => {
            const busy = busyId === target.targetId || pending;
            return (
              <li
                key={target.targetId}
                className="flex flex-wrap items-center gap-2 rounded-control bg-gray-50 px-3 py-2 dark:bg-white/5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy dark:text-white">
                  {target.label}
                </span>
                {target.active ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-caption font-medium tabular-nums text-success-600 dark:text-success-500">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {target.dailyRateUzs.toLocaleString('ru-RU')}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => send(target, 'disable')}
                      className="inline-flex items-center gap-1 rounded-control border border-gray-200 px-2 py-1 text-caption font-medium text-navy transition-colors hover:border-warning-500 hover:text-warning-600 disabled:opacity-50 dark:border-white/10 dark:text-white"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {t('disable')}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      placeholder={String(target.dailyRateUzs)}
                      value={rates[target.targetId] ?? ''}
                      onChange={(e) =>
                        setRates((prev) => ({ ...prev, [target.targetId]: e.target.value }))
                      }
                      aria-label={t('ratePlaceholder')}
                      className="w-24 rounded-control border border-gray-200 bg-white px-2 py-1 text-caption tabular-nums text-navy focus:outline-none focus:ring-2 focus:ring-primary-600/60 dark:border-white/10 dark:bg-navy-800 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => send(target, 'enable')}
                      className="inline-flex items-center gap-1 rounded-control bg-primary-600 px-2.5 py-1 text-caption font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {t('enable')}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}
