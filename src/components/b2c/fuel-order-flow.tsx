'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapPicker, type LatLng } from '@/components/map/map-picker';
import { B2C_MIN_ORDER_LITERS, B2C_ORDER_VOLUMES } from '@/lib/constants';

type FuelType = 'AI_92' | 'AI_95' | 'AI_100';
const FUELS: FuelType[] = ['AI_92', 'AI_95', 'AI_100'];
const FUEL_LABEL: Record<FuelType, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95', AI_100: 'АИ-100' };

export type ExistingCar = { id: string; plate: string; model: string | null; tankCapacity: number | null };

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function FuelOrderFlow({
  locale,
  prices,
  car,
  paymeAvailable = false,
}: {
  locale: string;
  prices: Record<string, number>;
  car: ExistingCar | null;
  paymeAvailable?: boolean;
}) {
  const t = useTranslations('benzin');
  const router = useRouter();
  const [payment, setPayment] = useState<'COURIER_POS' | 'PAYME'>('COURIER_POS');

  const [point, setPoint] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('AI_92');
  const [volume, setVolume] = useState<number>(B2C_MIN_ORDER_LITERS);
  const [isFullTank, setIsFullTank] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pricePerLiter = prices[fuelType] ?? 0;
  // Known tank capacity — from a saved car or the just-entered value.
  const knownCapacity = car ? car.tankCapacity : tankCapacity ? Number(tankCapacity) : null;
  const liters = isFullTank && knownCapacity ? knownCapacity : volume;
  const total = pricePerLiter * liters;
  const fmt = useMemo(() => new Intl.NumberFormat('ru-RU'), []);

  const canSubmit =
    !!point &&
    (car || plate.trim().length > 0) &&
    (isFullTank ? !!knownCapacity : volume >= B2C_MIN_ORDER_LITERS) &&
    !submitting;

  const submit = async () => {
    setError('');
    if (!point) {
      setError(t('errors.noPoint'));
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fuelType,
        lat: point.lat,
        lng: point.lng,
        address: address.trim() || undefined,
        isFullTank,
        volume: isFullTank ? undefined : volume,
        paymentMethod: paymeAvailable ? payment : 'COURIER_POS',
      };
      if (car) {
        body.clientCarId = car.id;
      } else {
        body.newCar = {
          plate: plate.trim(),
          model: model.trim() || undefined,
          tankCapacity: tankCapacity ? Number(tankCapacity) : undefined,
        };
      }

      const res = await fetch('/api/orders/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(mapError(t, data?.error));
        return;
      }
      // Online payment → hosted Payme checkout; POS → the order status page.
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      router.push(`/${locale}/account/orders/${data.id}`);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Where */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('whereTitle')}</h2>
        <MapPicker value={point} onChange={setPoint} locateLabel={t('locateMe')} />
        <input
          className={inputCls}
          placeholder={t('addressPlaceholder')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={200}
        />
      </section>

      {/* 2. Car (only if the client has none saved) */}
      {!car && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('carTitle')}</h2>
          <input className={inputCls} placeholder={t('platePlaceholder')} value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={20} />
          <input className={inputCls} placeholder={t('modelPlaceholder')} value={model} onChange={(e) => setModel(e.target.value)} maxLength={60} />
          <input
            className={inputCls}
            placeholder={t('tankPlaceholder')}
            value={tankCapacity}
            onChange={(e) => setTankCapacity(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={3}
          />
        </section>
      )}
      {car && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('carTitle')}</h2>
          <p className="text-gray-900">
            <span className="font-medium">{car.plate}</span>
            {car.model ? ` · ${car.model}` : ''}
            {car.tankCapacity ? ` · ${car.tankCapacity} ${t('liters')}` : ''}
          </p>
        </section>
      )}

      {/* 3. Fuel */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('fuelTitle')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {FUELS.map((f) => {
            const active = fuelType === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFuelType(f)}
                className={`rounded-2xl border p-4 text-left transition ${active ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20' : 'border-gray-200 bg-white hover:border-primary-200'}`}
              >
                <span className="block text-base font-semibold text-gray-900">{FUEL_LABEL[f]}</span>
                <span className="mt-1 block text-xs text-gray-500">
                  {prices[f] ? `${fmt.format(prices[f])} ${t('perLiter')}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Volume */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('volumeTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {B2C_ORDER_VOLUMES.map((v) => {
            const active = !isFullTank && volume === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => { setIsFullTank(false); setVolume(v); }}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${active ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'}`}
              >
                {v} {t('liters')}
              </button>
            );
          })}
          {knownCapacity ? (
            <button
              type="button"
              onClick={() => setIsFullTank(true)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${isFullTank ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'}`}
            >
              {t('fullTank')} ({knownCapacity} {t('liters')})
            </button>
          ) : null}
        </div>
        {!isFullTank && (
          <div>
            <input
              className={`${inputCls} max-w-[12rem]`}
              inputMode="numeric"
              value={String(volume)}
              onChange={(e) => setVolume(Number(e.target.value.replace(/\D/g, '')) || 0)}
              aria-label={t('volumeTitle')}
            />
            <p className="mt-1 text-xs text-gray-500">{t('minVolume', { min: B2C_MIN_ORDER_LITERS })}</p>
          </div>
        )}
      </section>

      {/* 5. Summary + payment */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{liters} {t('liters')} × {fmt.format(pricePerLiter)}</span>
          <span>{fmt.format(total)} {t('sum')}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{t('delivery')}</span>
          <span className="font-medium text-emerald-600">{t('deliveryFree')}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-900">
          <span>{t('total')}</span>
          <span>{fmt.format(total)} {t('sum')}</span>
        </div>
        {paymeAvailable ? (
          <div className="space-y-2 border-t border-gray-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('paymentTitle')}</p>
            {(['COURIER_POS', 'PAYME'] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
                <input
                  type="radio"
                  name="payment"
                  checked={payment === m}
                  onChange={() => setPayment(m)}
                  className="h-4 w-4 accent-primary-600"
                />
                {m === 'COURIER_POS' ? t('payCourier') : t('payOnline')}
              </label>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Fuel className="h-4 w-4 text-primary-600" aria-hidden />
            {t('payCourier')}
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600" role="alert">{error}</p>
      )}

      <Button onClick={submit} disabled={!canSubmit} className="w-full bg-primary-600 py-6 text-base font-semibold hover:bg-primary-500">
        {submitting
          ? t('submitting')
          : `${paymeAvailable && payment === 'PAYME' ? t('payOnline') : t('order')} · ${fmt.format(total)} ${t('sum')}`}
      </Button>
    </div>
  );
}

function mapError(t: ReturnType<typeof useTranslations>, code?: string): string {
  switch (code) {
    case 'min_volume':
      return t('errors.minVolumeErr', { min: B2C_MIN_ORDER_LITERS });
    case 'tank_capacity_unknown':
      return t('errors.tankUnknown');
    case 'car_required':
      return t('errors.carRequired');
    default:
      return t('errors.generic');
  }
}
