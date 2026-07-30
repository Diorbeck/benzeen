'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Loader2, Navigation } from 'lucide-react';
import { TrackingMap } from '@/components/map/tracking-map';
import { etaProvider, MAX_ETA_MINUTES } from '@/lib/eta';

export type ClientOrder = {
  id: string;
  status: string;
  fuelType: string;
  volume: number;
  dispensedVolume: number | null;
  pricePerLiter: number | null;
  totalAmount: number | null;
  paymentMethod: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plate: string | null;
  createdAt: string;
};

type Courier = { lat: number; lng: number; updatedAt: string } | null;

const STEPS = ['RECEIVED', 'COURIER_ASSIGNED', 'IN_DELIVERY', 'DELIVERED'] as const;
const FUEL_LABEL: Record<string, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95', AI_100: 'АИ-100' };
const TERMINAL = new Set(['DELIVERED', 'CANCELLED', 'REJECTED']);
const ACTIVE = new Set(['COURIER_ASSIGNED', 'IN_DELIVERY']);

export function OrderStatus({
  locale,
  initial,
}: {
  locale: string;
  initial: ClientOrder;
}) {
  const t = useTranslations('orderStatus');
  const [order, setOrder] = useState<ClientOrder>(initial);
  const [courier, setCourier] = useState<Courier>(null);
  const fmt = useMemo(() => new Intl.NumberFormat('ru-RU'), []);

  // Poll status (+ courier tracking while the delivery is active) every 10s,
  // until the order reaches a terminal state.
  useEffect(() => {
    if (TERMINAL.has(order.status)) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          fetch(`/api/orders/client/${initial.id}`, { cache: 'no-store' }),
          fetch(`/api/orders/client/${initial.id}/tracking`, { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (sRes.ok) setOrder((await sRes.json()) as ClientOrder);
        if (tRes.ok) setCourier(((await tRes.json()) as { courier: Courier }).courier);
      } catch {
        /* transient — keep polling */
      }
    };

    const iv = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [initial.id, order.status]);

  const activeIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED';
  const isActive = ACTIVE.has(order.status);
  const destination =
    order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : null;

  // ETA: courier → destination, straight-line v1 (hidden when too far / stale).
  const etaMinutes =
    isActive && courier && destination ? etaProvider.estimateMinutes(courier, destination) : null;
  const showEta = etaMinutes != null && etaMinutes <= MAX_ETA_MINUTES;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      <Link
        href={`/${locale}/account`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('back')}
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t('title')}</h1>

      {/* Live tracking during active delivery */}
      {!cancelled && isActive && destination && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Navigation className="h-4 w-4 text-primary-600" aria-hidden />
              {t('courierComing')}
            </p>
            <span className="text-sm font-semibold text-primary-600">
              {showEta ? t('eta', { minutes: etaMinutes! }) : t('etaCalculating')}
            </span>
          </div>
          <TrackingMap destination={destination} courier={courier} />
        </div>
      )}

      {cancelled ? (
        <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{t('cancelled')}</p>
      ) : (
        <ol className="mt-8 space-y-4">
          {STEPS.map((step, i) => {
            const done = i < activeIndex || order.status === 'DELIVERED';
            const current = i === activeIndex && order.status !== 'DELIVERED';
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : current ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                </span>
                <span className={`text-sm ${done || current ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                  {t(`steps.${step}`)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Order details */}
      <dl className="mt-8 space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm">
        <Row label={t('car')} value={order.plate ?? '—'} />
        <Row label={t('fuel')} value={FUEL_LABEL[order.fuelType] ?? order.fuelType} />
        <Row label={t('volume')} value={`${order.dispensedVolume ?? order.volume} ${t('liters')}`} />
        {order.address && <Row label={t('address')} value={order.address} />}
        {order.totalAmount != null && (
          <Row label={t('total')} value={`${fmt.format(order.totalAmount)} ${t('sum')}`} />
        )}
        <Row label={t('payment')} value={t('payCourier')} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}
