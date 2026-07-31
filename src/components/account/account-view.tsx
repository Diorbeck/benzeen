'use client';

import { useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel, LogOut, Car, Plus, Pencil, Trash2, ChevronRight, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { formatMoney } from '@/lib/format';
import { formatPlate } from '@/lib/input-format';

export type AccountOrder = {
  id: string;
  status: string;
  fuelType: string;
  volume: number;
  dispensedVolume: number | null;
  totalAmount: number | null;
  clientCarId: string | null;
  scheduledFor: string | null;
  createdAt: string;
};
export type AccountCar = { id: string; plate: string; model: string | null; tankCapacity: number | null };

const FUEL_LABEL: Record<string, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95', AI_100: 'АИ-100' };
const inputCls =
  'w-full rounded-control border border-gray-200 bg-white px-4 py-3 text-navy placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export function AccountView({
  locale,
  phone,
  name,
  lastName,
  orders = [],
  cars = [],
}: {
  locale: string;
  phone: string;
  name: string;
  lastName: string;
  orders?: AccountOrder[];
  cars?: AccountCar[];
}) {
  const t = useTranslations('account');
  const [tab, setTab] = useState<'profile' | 'orders'>('profile');

  return (
    <div className="min-h-screen bg-gray-50 text-navy">
      <header className="sticky top-0 z-header border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary-600">
              <Fuel className="h-5 w-5 text-white" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-navy">{t('title')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}` })}
              className="flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-control border border-gray-200 bg-white p-1">
          {(['profile', 'orders'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-[0.55rem] px-4 py-2 text-sm font-medium transition ${
                tab === k ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-navy'
              }`}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>

        {tab === 'profile' ? (
          <ProfileTab phone={phone} name={name} lastName={lastName} cars={cars} />
        ) : (
          <OrdersTab locale={locale} orders={orders} />
        )}
      </main>
    </div>
  );
}

function ProfileTab({
  phone,
  name: initialName,
  lastName: initialLast,
  cars,
}: {
  phone: string;
  name: string;
  lastName: string;
  cars: AccountCar[];
}) {
  const t = useTranslations('account');
  const [name, setName] = useState(initialName);
  const [lastName, setLastName] = useState(initialLast);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), lastName: lastName.trim() }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-gray-200 bg-white p-6 sm:p-8">
        <form onSubmit={save} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('phone')}</label>
            <p className="text-base font-medium text-navy">{phone || '—'}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-name" className="mb-1 block text-xs font-medium text-gray-500">{t('name')}</label>
              <input id="acc-name" className={inputCls} value={name} maxLength={80} placeholder={t('namePlaceholder')} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
            </div>
            <div>
              <label htmlFor="acc-last" className="mb-1 block text-xs font-medium text-gray-500">{t('lastName')}</label>
              <input id="acc-last" className={inputCls} value={lastName} maxLength={80} placeholder={t('lastNamePlaceholder')} onChange={(e) => { setLastName(e.target.value); setSaved(false); }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="rounded-control">{saving ? t('saving') : t('save')}</Button>
            {saved && <span className="text-sm text-success-600">{t('saved')}</span>}
          </div>
        </form>
      </section>

      <MyCars cars={cars} />
    </div>
  );
}

function MyCars({ cars }: { cars: AccountCar[] }) {
  const t = useTranslations('account');
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const del = async (id: string) => {
    setError('');
    const res = await fetch(`/api/account/cars/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      setError(t('cars.cannotDelete'));
      return;
    }
    if (res.ok) router.refresh();
  };

  return (
    <section className="rounded-card border border-gray-200 bg-white p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2.5">
        <Car className="h-5 w-5 text-primary-600" aria-hidden />
        <h2 className="text-base font-semibold text-navy">{t('cars.title')}</h2>
      </div>

      {error && <p className="mb-3 rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>}

      <ul className="space-y-2">
        {cars.map((c) =>
          editingId === c.id ? (
            <li key={c.id}>
              <CarForm car={c} onDone={() => { setEditingId(null); router.refresh(); }} onCancel={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-control border border-gray-200 px-4 py-3">
              <span className="min-w-0 text-sm text-navy">
                <span className="font-medium">{c.plate}</span>
                {c.model ? ` · ${c.model}` : ''}
                {c.tankCapacity ? ` · ${c.tankCapacity} ${t('liters')}` : ''}
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => { setError(''); setEditingId(c.id); setAdding(false); }} className="rounded-control p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600" aria-label={t('cars.edit')}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => del(c.id)} className="rounded-control p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={t('cars.delete')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="mt-3">
          <CarForm onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null); setError(''); }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-primary-300 hover:text-primary-600"
        >
          <Plus className="h-4 w-4" /> {t('cars.add')}
        </button>
      )}
      {cars.length === 0 && !adding && <p className="mt-3 text-sm text-gray-500">{t('cars.empty')}</p>}
    </section>
  );
}

function CarForm({ car, onDone, onCancel }: { car?: AccountCar; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations('account');
  const [plate, setPlate] = useState(car?.plate ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [tank, setTank] = useState(car?.tankCapacity ? String(car.tankCapacity) : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setBusy(true);
    try {
      const body = {
        plate: plate.trim(),
        model: model.trim() || undefined,
        tankCapacity: tank ? Number(tank) : undefined,
      };
      const res = await fetch(car ? `/api/account/cars/${car.id}` : '/api/account/cars', {
        method: car ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-control border border-primary-100 bg-primary-50/40 p-3">
      <input className={inputCls} value={plate} onChange={(e) => setPlate(formatPlate(e.target.value))} placeholder={t('cars.plate')} maxLength={12} autoCapitalize="characters" />
      <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('cars.model')} maxLength={60} />
      <input className={inputCls} value={tank} onChange={(e) => setTank(e.target.value.replace(/\D/g, ''))} placeholder={t('cars.tank')} inputMode="numeric" maxLength={3} />
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={busy} className="rounded-control">{busy ? t('saving') : t('cars.save')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="rounded-control text-gray-600">{t('cars.cancel')}</Button>
      </div>
    </form>
  );
}

function OrdersTab({ locale, orders }: { locale: string; orders: AccountOrder[] }) {
  const t = useTranslations('account');
  const fmt = (n: number) => formatMoney(n, locale);
  const dtTag = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';

  // Nearest upcoming scheduled order (for the badge).
  const nextScheduled = orders
    .filter((o) => o.status === 'SCHEDULED' && o.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];

  return (
    <div className="space-y-4">
      {nextScheduled && (
        <Link
          href={`/${locale}/account/orders/${nextScheduled.id}`}
          className="flex items-center gap-2.5 rounded-card border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800 hover:bg-primary-50"
        >
          <Clock className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
          {t('orders.scheduledBadge', {
            when: new Date(nextScheduled.scheduledFor!).toLocaleString(dtTag, {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-control bg-primary-600 font-semibold text-white hover:bg-primary-500" asChild>
          <Link href={`/${locale}/benzin`}>
            <Plus className="h-4 w-4" /> {t('orders.new')}
          </Link>
        </Button>
        <Button variant="secondary" className="rounded-control" asChild>
          <Link href={`/${locale}/benzin?schedule=1`}>
            <Clock className="h-4 w-4" /> {t('orders.schedule')}
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-card border border-gray-200 bg-white p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-control bg-primary-50 text-primary-600">
            <Clock className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-gray-600">{t('orders.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const repeat = `/${locale}/benzin?fuel=${o.fuelType}&volume=${o.volume}${o.clientCarId ? `&carId=${o.clientCarId}` : ''}`;
            return (
              <li key={o.id} className="rounded-card border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/${locale}/account/orders/${o.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">
                      {FUEL_LABEL[o.fuelType] ?? o.fuelType} ·{' '}
                      {o.dispensedVolume != null
                        ? t('orders.filledN', { n: o.dispensedVolume })
                        : t('orders.orderedN', { n: o.volume })}
                      {o.totalAmount != null ? ` · ${fmt(o.totalAmount)} ${t('sum')}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(o.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU')} ·{' '}
                      {statusLabel(t, o.status)}
                    </p>
                  </Link>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <Link href={repeat} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                    <RotateCcw className="h-4 w-4" /> {t('orders.repeat')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function statusLabel(t: ReturnType<typeof useTranslations>, status: string): string {
  return t.has(`status.${status}`) ? t(`status.${status}`) : status;
}
