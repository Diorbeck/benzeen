'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { IdentificationMode } from '@/lib/dispenser-identification';

// Модуль 6 ТЗ v2: владелец АЗС сам выбирает уровень идентификации на колонке.
// Ручной выбор бесплатен, BLE и камера тарифицируются, поэтому рядом с
// переключателем всегда видно, что это меняет в счёте.

export type DispenserIdentificationView = {
  dispenserId: string;
  mode: IdentificationMode;
  hasBeacon: boolean;
};

const MODES: readonly IdentificationMode[] = ['MANUAL', 'BLE', 'CAMERA'];

export function DispenserIdentificationControls({
  dispenser,
  cameraEnabled,
  dailyRateUzs,
}: {
  dispenser: DispenserIdentificationView;
  /** Модуль камер разрешён платформой. */
  cameraEnabled: boolean;
  dailyRateUzs: number;
}) {
  const t = useTranslations('stationPanel');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function select(mode: IdentificationMode) {
    if (mode === dispenser.mode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/station/dispensers/identification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispenserId: dispenser.dispenserId, mode }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const key = data?.error;
        setError(
          key === 'beaconRequired' || key === 'cameraNotAvailable'
            ? t(`identificationError.${key}`)
            : t('identificationError.generic'),
        );
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError(t('identificationError.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map((mode) => {
          const active = mode === dispenser.mode;
          const blocked =
            (mode === 'BLE' && !dispenser.hasBeacon) || (mode === 'CAMERA' && !cameraEnabled);
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              disabled={busy || pending || (blocked && !active)}
              title={blocked ? t(`identificationHint.${mode}`) : undefined}
              onClick={() => select(mode)}
              className={
                active
                  ? 'rounded-control bg-primary-500 px-2.5 py-1 text-xs font-semibold text-primary-950'
                  : 'rounded-control border border-gray-200 px-2.5 py-1 text-xs font-medium text-navy transition-colors hover:border-primary-600 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white dark:hover:border-sky-300 dark:hover:text-sky-300'
              }
            >
              {t(`identification.${mode}`)}
            </button>
          );
        })}
        {(busy || pending) && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-800 dark:text-sky-300" aria-hidden />
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {dispenser.mode === 'MANUAL'
            ? t('identificationFree')
            : t('billedDaily', { sum: dailyRateUzs.toLocaleString('ru-RU') })}
        </span>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-warning-600">{error}</p>}
    </div>
  );
}
