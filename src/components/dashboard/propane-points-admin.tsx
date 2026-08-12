'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Flame, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BookingStatus = 'BOOKED' | 'SERVED' | 'CANCELLED' | 'NO_SHOW';

type Booking = {
  id: string;
  slotStart: string;
  status: BookingStatus;
  code: string;
  client: { name: string | null; phone: string | null };
};

type Point = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'PAUSED';
  priceUzs: number;
  postsCount: number;
  bookings: Booking[];
};

type FormState = {
  name: string;
  lat: string;
  lng: string;
  priceUzs: string;
  postsCount: string;
};

const emptyForm: FormState = { name: '', lat: '', lng: '', priceUzs: '', postsCount: '1' };

const inputClass =
  'h-12 w-full rounded-control border border-gray-300 bg-white px-3 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:border-white/15 dark:bg-navy-800 dark:text-white';

export function PropanePointsAdmin({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('dashboard.propane');

  const [points, setPoints] = useState<Point[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // 'new' = create form open; a point id = editing that point.
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Point ids whose delete was rejected with 409 has_bookings.
  const [blockedIds, setBlockedIds] = useState<Record<string, boolean>>({});
  // Queue open/closed per point; undefined falls back to the role default
  // (operators land on the queue, so it starts open for them).
  const [openQueues, setOpenQueues] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/propane/points');
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { points: Point[] };
      setPoints(data.points);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isQueueOpen = (id: string) => openQueues[id] ?? !isAdmin;

  const startCreate = () => {
    setForm(emptyForm);
    setEditing('new');
  };

  const startEdit = (p: Point) => {
    setForm({
      name: p.name,
      lat: String(p.lat),
      lng: String(p.lng),
      priceUzs: String(p.priceUzs),
      postsCount: String(p.postsCount),
    });
    setEditing(p.id);
  };

  const parseForm = () => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const priceUzs = Number(form.priceUzs);
    const postsCount = Number(form.postsCount);
    const name = form.name.trim();
    if (
      !name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(priceUzs) ||
      !Number.isFinite(postsCount)
    ) {
      return null;
    }
    return { name, lat, lng, priceUzs, postsCount };
  };

  const submitForm = async () => {
    const body = parseForm();
    if (!body || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        editing === 'new' ? '/api/admin/propane/points' : `/api/admin/propane/points/${editing}`,
        {
          method: editing === 'new' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        setEditing(null);
        setForm(emptyForm);
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p: Point) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const next = p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const res = await fetch(`/api/admin/propane/points/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setPoints((prev) =>
          prev ? prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)) : prev,
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const removePoint = async (p: Point) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/propane/points/${p.id}`, { method: 'DELETE' });
      if (res.status === 409) {
        setBlockedIds((prev) => ({ ...prev, [p.id]: true }));
      } else if (res.ok) {
        setPoints((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
      }
    } finally {
      setBusyId(null);
    }
  };

  // Optimistic operator mutation (serve / no-show): apply, roll back on failure.
  const transitionBooking = async (
    pointId: string,
    bookingId: string,
    to: 'SERVED' | 'NO_SHOW',
    endpoint: 'serve' | 'no-show',
  ) => {
    const setStatus = (status: BookingStatus) =>
      setPoints((prev) =>
        prev
          ? prev.map((p) =>
              p.id === pointId
                ? {
                    ...p,
                    bookings: p.bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)),
                  }
                : p,
            )
          : prev,
      );
    setStatus(to);
    const res = await fetch(`/api/propane/bookings/${bookingId}/${endpoint}`, { method: 'POST' });
    if (!res.ok) {
      setStatus('BOOKED');
      await load();
    }
  };

  if (loadError) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">{t('loadError')}</p>;
  }
  if (points === null) {
    return null;
  }

  const formFields = (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('name')}
        </label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('coords')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            step="any"
            className={inputClass}
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          />
          <input
            type="number"
            step="any"
            className={inputClass}
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('price')}
          </label>
          <input
            type="number"
            className={cn(inputClass, 'tabular-nums')}
            value={form.priceUzs}
            onChange={(e) => setForm((f) => ({ ...f, priceUzs: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('posts')}
          </label>
          <input
            type="number"
            className={cn(inputClass, 'tabular-nums')}
            value={form.postsCount}
            onChange={(e) => setForm((f) => ({ ...f, postsCount: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={submitForm} disabled={saving || !parseForm()}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {isAdmin && editing !== 'new' && (
        <Button onClick={startCreate}>
          <Plus aria-hidden />
          {t('addPoint')}
        </Button>
      )}

      {isAdmin && editing === 'new' && (
        <div className="rounded-card border border-gray-200/60 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-navy-900 dark:shadow-none sm:p-5">
          {formFields}
        </div>
      )}

      {points.length === 0 && editing !== 'new' && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('empty')}</p>
      )}

      {points.map((p) => {
        const queueOpen = isQueueOpen(p.id);
        return (
          <div
            key={p.id}
            className="rounded-card border border-gray-200/60 bg-white shadow-soft dark:border-white/10 dark:bg-navy-900 dark:shadow-none"
          >
            <div className="p-4 sm:p-5">
              {editing === p.id ? (
                formFields
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Flame className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                    <h2 className="min-w-0 truncate text-base font-semibold text-navy dark:text-white">
                      {p.name}
                    </h2>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        p.status === 'ACTIVE'
                          ? 'bg-success-500/10 text-success-600 dark:text-success-500'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
                      )}
                    >
                      {p.status === 'ACTIVE' ? t('active') : t('paused')}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      {t('price')}:{' '}
                      <span className="font-medium tabular-nums text-navy dark:text-white">
                        {p.priceUzs.toLocaleString('ru-RU')}
                      </span>
                    </span>
                    <span>
                      {t('posts')}:{' '}
                      <span className="font-medium tabular-nums text-navy dark:text-white">
                        {p.postsCount}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                      <span className="tabular-nums">
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </span>
                    </span>
                  </p>
                  {isAdmin && (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEdit(p)}
                          disabled={busyId === p.id}
                        >
                          {t('edit')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => toggleStatus(p)}
                          disabled={busyId === p.id}
                        >
                          {p.status === 'ACTIVE' ? t('pause') : t('resume')}
                        </Button>
                        <Button
                          variant="secondary"
                          className="text-red-600 dark:text-red-400"
                          onClick={() => removePoint(p)}
                          disabled={busyId === p.id}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                      {blockedIds[p.id] && (
                        <p className="mt-2 text-sm text-warning-600">{t('hasBookings')}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenQueues((prev) => ({ ...prev, [p.id]: !queueOpen }))}
              aria-expanded={queueOpen}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 border-t border-gray-200/60 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5 sm:px-5"
            >
              <span>
                {t('queueToday')}
                <span className="ml-2 tabular-nums text-gray-500">{p.bookings.length}</span>
              </span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', queueOpen && 'rotate-180')}
                aria-hidden
              />
            </button>

            {queueOpen && (
              <div className="border-t border-gray-200/60 dark:border-white/10">
                {p.bookings.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 sm:px-5">
                    {t('queueEmpty')}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200/60 dark:divide-white/10">
                    {p.bookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                      >
                        <span className="font-mono text-sm font-semibold tabular-nums text-navy dark:text-white">
                          {b.code}
                        </span>
                        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                          {new Date(b.slotStart).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-gray-400">
                          {[b.client.name, b.client.phone].filter(Boolean).join(' · ') || '—'}
                        </span>
                        {b.status === 'BOOKED' ? (
                          <div className="flex items-center gap-2">
                            <Button onClick={() => transitionBooking(p.id, b.id, 'SERVED', 'serve')}>
                              {t('serve')}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => transitionBooking(p.id, b.id, 'NO_SHOW', 'no-show')}
                            >
                              {t('noShow')}
                            </Button>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs font-medium',
                              b.status === 'SERVED'
                                ? 'bg-success-500/10 text-success-600 dark:text-success-500'
                                : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
                            )}
                          >
                            {b.status === 'SERVED' ? t('servedBadge') : b.status === 'NO_SHOW' ? t('noShowBadge') : t('cancelledBadge')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
