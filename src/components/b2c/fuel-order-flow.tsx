'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Car, Check, Fuel, MapPin, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapPicker, type LatLng } from '@/components/map/map-picker';
import { calcOrderPrice, type FuelType } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';
import { FUEL_TYPES, VOLUME_PRESETS, resolveLiters, submitBlockReason } from '@/lib/order-form';
import { loadDraft, saveDraft, clearDraft, type OrderDraft } from '@/lib/order-draft';
import { track } from '@/lib/analytics';
import { formatPlate, normalizePhone } from '@/lib/input-format';

const FUEL_LABEL: Record<FuelType, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95', AI_100: 'АИ-100' };

export type ExistingCar = { id: string; plate: string; model: string | null; tankCapacity: number | null };

const inputCls =
  'w-full rounded-control border border-gray-200 bg-white px-4 py-3 text-navy placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function FuelOrderFlow({
  locale,
  prices,
  cars,
  isLoggedIn,
  paymeAvailable = false,
}: {
  locale: string;
  prices: Record<string, number>;
  cars: ExistingCar[];
  isLoggedIn: boolean;
  paymeAvailable?: boolean;
}) {
  const t = useTranslations('benzin');
  const router = useRouter();
  const { status } = useSession();
  const loggedIn = isLoggedIn || status === 'authenticated';

  // --- order state ---
  const [carId, setCarId] = useState<string | null>(cars[0]?.id ?? null);
  const [addingCar, setAddingCar] = useState(cars.length === 0);
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('AI_92');
  const [volume, setVolume] = useState<number>(VOLUME_PRESETS[0]);
  const [isFullTank, setIsFullTank] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<'COURIER_POS' | 'PAYME'>('COURIER_POS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore a guest draft once, on mount.
  useEffect(() => {
    track('order_started');
    const d = loadDraft();
    if (d) {
      if (d.fuelType) setFuelType(d.fuelType);
      if (typeof d.volume === 'number') setVolume(d.volume);
      if (d.isFullTank) setIsFullTank(true);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') setPoint({ lat: d.lat, lng: d.lng });
      if (d.address) setAddress(d.address);
      if (d.car?.plate) {
        setAddingCar(true);
        setCarId(null);
        setPlate(d.car.plate);
        if (d.car.model) setModel(d.car.model);
        if (d.car.tankCapacity) setTankCapacity(String(d.car.tankCapacity));
      }
      setDraftRestored(true);
    }
    hydrated.current = true;
  }, []);

  const usingNewCar = addingCar || !carId;
  const selectedCar = cars.find((c) => c.id === carId) ?? null;
  const knownTankCapacity = usingNewCar
    ? tankCapacity
      ? Number(tankCapacity)
      : null
    : selectedCar?.tankCapacity ?? null;

  // Persist the draft as the guest builds (skip the initial hydration render).
  useEffect(() => {
    if (!hydrated.current) return;
    const d: OrderDraft = {
      fuelType,
      volume,
      isFullTank,
      lat: point?.lat,
      lng: point?.lng,
      address: address || undefined,
      car: usingNewCar && plate ? { plate, model: model || undefined, tankCapacity: tankCapacity ? Number(tankCapacity) : undefined } : undefined,
    };
    saveDraft(d);
  }, [fuelType, volume, isFullTank, point, address, usingNewCar, plate, model, tankCapacity]);

  const pricePerLiter = prices[fuelType] ?? 0;
  const liters = resolveLiters({ isFullTank, volume, knownTankCapacity });
  const { total } = useMemo(
    () => calcOrderPrice({ pricePerLiter, volume: liters }),
    [pricePerLiter, liters],
  );

  const block = submitBlockReason({
    point,
    hasExistingCar: !usingNewCar && !!selectedCar,
    newPlate: plate,
    fuelType,
    volume,
    isFullTank,
    knownTankCapacity,
  });

  // --- inline login ---
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<'phone' | 'code'>('phone');
  const [loginPhone, setLoginPhone] = useState('+998');
  const [loginCode, setLoginCode] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginInfo, setLoginInfo] = useState('');
  const [loginError, setLoginError] = useState('');

  const placeOrder = async () => {
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fuelType,
        lat: point!.lat,
        lng: point!.lng,
        address: address.trim() || undefined,
        isFullTank,
        volume: isFullTank ? undefined : volume,
        paymentMethod: paymeAvailable ? payment : 'COURIER_POS',
      };
      if (!usingNewCar && selectedCar) body.clientCarId = selectedCar.id;
      else body.newCar = { plate: plate.trim(), model: model.trim() || undefined, tankCapacity: tankCapacity ? Number(tankCapacity) : undefined };

      const res = await fetch('/api/orders/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        track('order_failed', { reason: String(data?.error ?? 'http_' + res.status) });
        setError(mapError(t, data?.error));
        return;
      }
      track('order_submitted', { fuel: fuelType, liters, online: !!data?.checkoutUrl });
      clearDraft();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      router.push(`/${locale}/account/orders/${data.id}`);
    } catch {
      track('order_failed', { reason: 'network' });
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async () => {
    if (block) return;
    track('order_price_calculated', { fuel: fuelType, liters, total });
    if (loggedIn) {
      await placeOrder();
    } else {
      track('login_clicked', { where: 'order' });
      setLoginOpen(true);
      setLoginStep('phone');
    }
  };

  const sendCode = async () => {
    setLoginError('');
    setLoginInfo('');
    const phone = normalizePhone(loginPhone);
    if (!/^\+998\d{9}$/.test(phone)) {
      setLoginError(t('login.invalidPhone'));
      return;
    }
    setLoginBusy(true);
    try {
      const res = await fetch('/api/auth/client/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setLoginError(d?.error === 'invalid_phone' ? t('login.invalidPhone') : t('login.smsUnavailable'));
        return;
      }
      setLoginPhone(phone);
      setLoginStep('code');
      setLoginInfo(t('login.devHint'));
    } catch {
      setLoginError(t('login.smsUnavailable'));
    } finally {
      setLoginBusy(false);
    }
  };

  const verifyAndOrder = async () => {
    setLoginError('');
    const code = loginCode.replace(/\D/g, '');
    if (code.length !== 6) {
      setLoginError(t('login.invalidCode'));
      return;
    }
    setLoginBusy(true);
    try {
      const res = await signIn('credentials', {
        identifier: normalizePhone(loginPhone),
        password: code,
        mode: 'client',
        redirect: false,
      });
      if (res?.error) {
        setLoginError(t('login.invalidCode'));
        return;
      }
      setLoginOpen(false);
      await placeOrder();
    } catch {
      setLoginError(t('login.invalidCode'));
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
      {/* Steps */}
      <div className="space-y-5 pb-40 lg:pb-8">
        {draftRestored && (
          <div className="flex items-center justify-between gap-3 rounded-control border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800">
            <span>{t('draftRestored')}</span>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setDraftRestored(false);
                window.location.reload();
              }}
              className="shrink-0 font-medium text-primary-700 underline-offset-2 hover:underline"
            >
              {t('draftClear')}
            </button>
          </div>
        )}

        {/* 1. Car */}
        <StepCard step={1} title={t('steps.car')} icon={Car}>
          {cars.length > 0 && (
            <div className="mb-3 space-y-2">
              {cars.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCarId(c.id);
                    setAddingCar(false);
                    track('vehicle_selected', { saved: true });
                  }}
                  className={`flex w-full items-center justify-between rounded-control border px-4 py-3 text-left transition ${
                    !usingNewCar && carId === c.id
                      ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20'
                      : 'border-gray-200 bg-white hover:border-primary-200'
                  }`}
                >
                  <span className="text-sm font-medium text-navy">
                    {c.plate}
                    {c.model ? ` · ${c.model}` : ''}
                  </span>
                  {!usingNewCar && carId === c.id && <Check className="h-4 w-4 text-primary-600" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAddingCar(true);
                  setCarId(null);
                }}
                className={`flex w-full items-center gap-2 rounded-control border px-4 py-3 text-left text-sm font-medium transition ${
                  usingNewCar ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-dashed border-gray-300 text-gray-600 hover:border-primary-300'
                }`}
              >
                <Plus className="h-4 w-4" /> {t('addCar')}
              </button>
            </div>
          )}
          {usingNewCar && (
            <div className="space-y-3">
              <Field label={t('plateLabel')}>
                <input
                  className={inputCls}
                  value={plate}
                  onChange={(e) => setPlate(formatPlate(e.target.value))}
                  placeholder={t('platePlaceholder')}
                  onBlur={() => plate.trim() && track('vehicle_selected', { saved: false })}
                  maxLength={12}
                  inputMode="text"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label={t('modelLabel')} optional optionalText={t('optional')}>
                <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('modelPlaceholder')} maxLength={60} />
              </Field>
              <Field label={t('tankLabel')} optional optionalText={t('optional')}>
                <input
                  className={inputCls}
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('tankPlaceholder')}
                  inputMode="numeric"
                  maxLength={3}
                />
              </Field>
            </div>
          )}
        </StepCard>

        {/* 2. Fuel & volume */}
        <StepCard step={2} title={t('steps.fuel')} icon={Fuel}>
          <div className="grid grid-cols-3 gap-2.5">
            {FUEL_TYPES.map((f) => {
              const active = fuelType === f;
              const p = prices[f];
              return (
                <button
                  key={f}
                  type="button"
                  disabled={!p}
                  onClick={() => {
                    setFuelType(f);
                    track('fuel_selected', { fuel: f });
                  }}
                  className={`rounded-control border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    active ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20' : 'border-gray-200 bg-white hover:border-primary-200'
                  }`}
                >
                  <span className="block text-sm font-semibold text-navy">{FUEL_LABEL[f]}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {p ? `${formatMoney(p, locale)} ${t('perLiter')}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {VOLUME_PRESETS.map((v) => {
              const active = !isFullTank && volume === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setIsFullTank(false);
                    setVolume(v);
                    track('volume_selected', { liters: v });
                  }}
                  className={`min-h-[44px] rounded-control border px-4 text-sm font-medium transition ${
                    active ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'
                  }`}
                >
                  {v} {t('liters')}
                </button>
              );
            })}
            {knownTankCapacity ? (
              <button
                type="button"
                onClick={() => {
                  setIsFullTank(true);
                  track('volume_selected', { fullTank: true });
                }}
                className={`min-h-[44px] rounded-control border px-4 text-sm font-medium transition ${
                  isFullTank ? 'border-primary-500 bg-primary-50/50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'
                }`}
              >
                {t('fullTank')}
              </button>
            ) : null}
          </div>

          {isFullTank ? (
            <p className="mt-3 rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {t('fullTankNote', { max: knownTankCapacity ?? 0 })}
            </p>
          ) : (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('customVolume')}</label>
              <input
                className={`${inputCls} max-w-[10rem]`}
                inputMode="numeric"
                value={String(volume)}
                onChange={(e) => setVolume(Number(e.target.value.replace(/\D/g, '')) || 0)}
              />
              <p className="mt-1 text-xs text-gray-500">{t('minVolume', { min: 30 })}</p>
            </div>
          )}
        </StepCard>

        {/* 3. Address */}
        <StepCard step={3} title={t('steps.address')} icon={MapPin}>
          <MapPicker
            value={point}
            onChange={(v) => {
              setPoint(v);
              track('address_selected', { source: 'map' });
            }}
            locateLabel={t('locateMe')}
          />
          <input
            className={`${inputCls} mt-3`}
            placeholder={t('addressPlaceholder')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
          />
        </StepCard>
      </div>

      {/* Summary — sticky on desktop */}
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <Summary
            t={t}
            locale={locale}
            fuelLabel={FUEL_LABEL[fuelType]}
            liters={liters}
            pricePerLiter={pricePerLiter}
            total={total}
            plate={usingNewCar ? plate : selectedCar?.plate ?? ''}
            address={address}
            paymeAvailable={paymeAvailable}
            payment={payment}
            setPayment={setPayment}
            block={block}
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
          />
        </div>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-header border-t border-gray-100 bg-white/95 p-3 backdrop-blur lg:hidden">
        {block && <p className="mb-2 text-center text-xs text-amber-700">{t(`disabled.${block}`)}</p>}
        {error && <p className="mb-2 text-center text-xs text-red-600">{error}</p>}
        <div className="mb-2 flex items-center justify-between px-1 text-sm">
          <span className="text-gray-500">{t('total')}</span>
          <span className="text-lg font-bold text-navy">
            {formatMoney(total, locale)} {t('sum')}
          </span>
        </div>
        <Button
          onClick={onSubmit}
          disabled={!!block || submitting}
          className="h-12 w-full rounded-control bg-primary-600 text-base font-semibold text-white hover:bg-primary-500"
        >
          {submitting ? t('submitting') : t('order')}
        </Button>
      </div>

      {loginOpen && (
        <InlineLogin
          t={t}
          step={loginStep}
          phone={loginPhone}
          code={loginCode}
          busy={loginBusy}
          info={loginInfo}
          error={loginError}
          setPhone={setLoginPhone}
          setCode={setLoginCode}
          onClose={() => setLoginOpen(false)}
          onSend={sendCode}
          onVerify={verifyAndOrder}
          onBack={() => {
            setLoginStep('phone');
            setLoginCode('');
            setLoginError('');
          }}
        />
      )}
    </div>
  );
}

function StepCard({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  icon: typeof Car;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-gray-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-50 text-primary-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-base font-semibold text-navy">
          <span className="mr-1.5 text-gray-400">{step}.</span>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  optional,
  optionalText,
  children,
}: {
  label: string;
  optional?: boolean;
  optionalText?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
        {optional && optionalText ? <span className="ml-1 text-gray-400">· {optionalText}</span> : null}
      </label>
      {children}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function Summary({
  t,
  locale,
  fuelLabel,
  liters,
  pricePerLiter,
  total,
  plate,
  address,
  paymeAvailable,
  payment,
  setPayment,
  block,
  submitting,
  error,
  onSubmit,
}: {
  t: TFn;
  locale: string;
  fuelLabel: string;
  liters: number;
  pricePerLiter: number;
  total: number;
  plate: string;
  address: string;
  paymeAvailable: boolean;
  payment: 'COURIER_POS' | 'PAYME';
  setPayment: (p: 'COURIER_POS' | 'PAYME') => void;
  block: ReturnType<typeof submitBlockReason>;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-5 shadow-soft">
      <h2 className="text-base font-semibold text-navy">{t('summaryTitle')}</h2>
      <dl className="mt-4 space-y-2 text-sm">
        {plate && <SummaryRow label={t('steps.car')} value={plate} />}
        <SummaryRow label={t('fuelTitle')} value={fuelLabel} />
        <SummaryRow label={t('volumeTitle')} value={`${liters} ${t('liters')}`} />
        <SummaryRow label={t('pricePerLiterLabel')} value={`${formatMoney(pricePerLiter, locale)} ${t('sum')}`} />
        {address && <SummaryRow label={t('steps.address')} value={address} />}
        <div className="flex items-center justify-between pt-1">
          <dt className="text-gray-500">{t('delivery')}</dt>
          <dd className="font-medium text-success-600">{t('deliveryFree')}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
        <span className="text-sm font-medium text-gray-500">{t('total')}</span>
        <span className="text-2xl font-bold text-navy">
          {formatMoney(total, locale)} {t('sum')}
        </span>
      </div>

      {/* Payment */}
      <div className="mt-4 space-y-2">
        {paymeAvailable ? (
          (['COURIER_POS', 'PAYME'] as const).map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
              <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} className="h-4 w-4 accent-primary-600" />
              {m === 'COURIER_POS' ? t('payCourier') : t('payOnline')}
            </label>
          ))
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Fuel className="h-4 w-4 text-primary-600" aria-hidden />
            {t('payCourier')}
          </p>
        )}
      </div>

      {block && <p className="mt-3 text-sm text-amber-700">{t(`disabled.${block}`)}</p>}
      {error && <p className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button
        onClick={onSubmit}
        disabled={!!block || submitting}
        className="mt-4 h-12 w-full rounded-control bg-primary-600 text-base font-semibold text-white hover:bg-primary-500"
      >
        {submitting ? t('submitting') : t('order')}
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-navy">{value}</dd>
    </div>
  );
}

function InlineLogin({
  t,
  step,
  phone,
  code,
  busy,
  info,
  error,
  setPhone,
  setCode,
  onClose,
  onSend,
  onVerify,
  onBack,
}: {
  t: TFn;
  step: 'phone' | 'code';
  phone: string;
  code: string;
  busy: boolean;
  info: string;
  error: string;
  setPhone: (v: string) => void;
  setCode: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  onVerify: () => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-sheet bg-white p-6 shadow-soft-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy">{t('login.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {step === 'phone' ? t('login.subtitle') : t('login.subtitleCode', { phone })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-control p-1.5 text-gray-400 hover:bg-gray-100" aria-label={t('login.cancel')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
        {info && !error && <p className="mb-3 rounded-control bg-primary-50 px-3 py-2 text-sm text-primary-700">{info}</p>}

        {step === 'phone' ? (
          <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="space-y-3">
            <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" autoFocus />
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-control text-base font-semibold">
              {busy ? t('login.sending') : t('login.send')}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onVerify(); }} className="space-y-3">
            <input
              className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-control text-base font-semibold">
              {busy ? t('login.verifying') : t('login.verifyAndOrder')}
            </Button>
            <button type="button" onClick={onBack} disabled={busy} className="w-full text-center text-sm text-gray-500 hover:text-primary-600">
              {t('login.changePhone')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function mapError(t: TFn, code?: string): string {
  switch (code) {
    case 'min_volume':
      return t('errors.minVolumeErr', { min: 30 });
    case 'tank_capacity_unknown':
      return t('errors.tankUnknown');
    case 'car_required':
      return t('errors.carRequired');
    default:
      return t('errors.generic');
  }
}
