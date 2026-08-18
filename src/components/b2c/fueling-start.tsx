'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel, Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

// Базовый сценарий заправки — Модуль 3, уровень 1 ТЗ v2: клиент вручную выбирает
// колонку, топливо и объём. BLE-маячок и камера появятся поверх этого же экрана,
// поэтому подтверждение сразу отделено от способа определения колонки.

type Stock = {
  fuelType: string;
  litersAvailable: number;
  capacityL: number;
  dataFresh: boolean;
  priceUzs: number | null;
};

type Dispenser = {
  id: string;
  number: number;
  status: 'ACTIVE' | 'DISABLED';
  fuelTypes: string[];
  identificationMode: 'MANUAL' | 'BLE' | 'CAMERA';
  online: boolean;
};

type Station = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  status: string;
  online: boolean;
  stocks: Stock[];
  dispensers: Dispenser[];
};

type Mode = 'amount' | 'liters' | 'full';

export function FuelingStart() {
  const t = useTranslations('fueling');
  const tf = useTranslations('stations.fuel');
  const pathname = usePathname() ?? '';
  const seg = pathname.split('/').filter(Boolean)[0];
  const locale = seg === 'ru' || seg === 'en' || seg === 'uz' ? seg : 'ru';
  const router = useRouter();
  const stationId = useSearchParams()?.get('station') ?? '';

  const [station, setStation] = useState<Station | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dispenserNumber, setDispenserNumber] = useState<number | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('amount');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stationId) {
      setLoadError(true);
      return;
    }
    let alive = true;
    fetch(`/api/stations/${stationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d: { station: Station }) => {
        if (!alive) return;
        setStation(d.station);
        const firstActive = d.station.dispensers.find((x) => x.status === 'ACTIVE');
        setDispenserNumber(firstActive?.number ?? null);
        const firstFuel = d.station.stocks.find((s) => s.dataFresh && s.litersAvailable > 0);
        setFuelType(firstFuel?.fuelType ?? d.station.stocks[0]?.fuelType ?? null);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [stationId]);

  const price = useMemo(
    () => station?.stocks.find((s) => s.fuelType === fuelType)?.priceUzs ?? null,
    [station, fuelType],
  );

  const numeric = Number(value.replace(/\s/g, '').replace(',', '.'));
  const canSubmit =
    !!station &&
    station.online &&
    dispenserNumber !== null &&
    !!fuelType &&
    (mode === 'full' || (Number.isFinite(numeric) && numeric > 0)) &&
    !submitting;

  async function submit() {
    if (!canSubmit || !station || !fuelType || dispenserNumber === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/fueling/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: station.id,
          dispenserNumber,
          fuelType,
          liters: mode === 'liters' ? numeric : undefined,
          amountUzs: mode === 'amount' ? Math.round(numeric) : undefined,
          fullTank: mode === 'full' ? true : undefined,
          // Токен карты выдаёт эквайринг банка; до подключения Apex сюда идёт
          // отметка сохранённой карты клиента.
          cardToken: 'primary',
        }),
      });
      if (res.status === 401) {
        router.push(`/${locale}/client-login`);
        return;
      }
      const body = (await res.json()) as { session?: { id: string }; error?: string };
      if (!res.ok || !body.session) {
        setError(body.error ?? t('stationError'));
        return;
      }
      router.push(`/${locale}/fueling/${body.session.id}`);
    } catch {
      setError(t('stationError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('stationError')}</p>
        <a
          href={`/${locale}/stations`}
          className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:underline dark:text-primary-500"
        >
          {t('back')}
        </a>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('stationLoading')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('title')}
      </p>
      <h1 className="mt-1 text-heading text-navy dark:text-white">{station.name}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{station.address}</p>

      {!station.online && (
        <p className="mt-4 rounded-card bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
          {t('offline')}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-subheading text-navy dark:text-white">{t('stepDispenser')}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('stepDispenserHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {station.dispensers.map((d) => {
            const disabled = d.status !== 'ACTIVE';
            const active = d.number === dispenserNumber;
            return (
              <button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => setDispenserNumber(d.number)}
                className={`h-11 rounded-control px-4 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-navy hover:bg-gray-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {t('dispenser', { n: d.number })}
                {d.identificationMode === 'BLE' && (
                  <span className="ml-2 text-xs opacity-70">BLE</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-subheading text-navy dark:text-white">{t('stepFuel')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {station.stocks.map((s) => {
            const active = s.fuelType === fuelType;
            const empty = !s.dataFresh || s.litersAvailable <= 0;
            return (
              <button
                key={s.fuelType}
                type="button"
                disabled={empty}
                onClick={() => setFuelType(s.fuelType)}
                className={`rounded-control px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-navy hover:bg-gray-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                } ${empty ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <span className="block text-sm font-semibold">{tf(s.fuelType)}</span>
                <span className="mt-0.5 block text-xs tabular-nums opacity-80">
                  {s.priceUzs !== null ? formatMoney(s.priceUzs, locale) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-subheading text-navy dark:text-white">{t('stepAmount')}</h2>
        <div className="mt-3 flex gap-2">
          {(['amount', 'liters', 'full'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-11 flex-1 rounded-control text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-950'
                  : 'bg-gray-100 text-navy hover:bg-gray-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
              }`}
            >
              {m === 'amount' ? t('modeAmount') : m === 'liters' ? t('modeLiters') : t('modeFull')}
            </button>
          ))}
        </div>

        {mode === 'full' ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t('fullTankNote')}</p>
        ) : (
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'amount' ? t('amountPlaceholder') : t('litersPlaceholder')}
            className="mt-3 h-12 w-full rounded-control border border-gray-200 bg-white px-4 text-base tabular-nums text-navy outline-none focus:border-primary-600 dark:border-white/10 dark:bg-navy-900 dark:text-white"
          />
        )}

        {price !== null && mode !== 'full' && Number.isFinite(numeric) && numeric > 0 && (
          <p className="mt-2 text-sm tabular-nums text-gray-600 dark:text-gray-300">
            {mode === 'amount'
              ? `≈ ${(numeric / price).toFixed(1)} л`
              : `≈ ${formatMoney(Math.round(numeric * price), locale)}`}
          </p>
        )}
      </section>

      <p className="mt-6 rounded-card bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-600 dark:bg-white/5 dark:text-gray-300">
        {t('holdNote')}
      </p>

      {error && <p className="mt-3 text-sm text-warning-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-primary-600 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('submitting')}
          </>
        ) : (
          <>
            <Fuel className="h-4 w-4" aria-hidden /> {t('confirm')}
          </>
        )}
      </button>

      <a
        href={`/${locale}/fueling/history`}
        className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:underline dark:text-primary-500"
      >
        {t('history')}
      </a>
    </div>
  );
}
