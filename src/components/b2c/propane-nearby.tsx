'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { Flame, Search, RefreshCw, X, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapProvider } from '@/components/map/provider';
import { formatMoney } from '@/lib/format';
import { spring } from '@/lib/motion';
import { track } from '@/lib/analytics';
import 'maplibre-gl/dist/maplibre-gl.css';

type PropanePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'PAUSED';
  priceUzs: number;
  postsCount: number;
};
type Slot = { start: string; free: number };
type MyBooking = {
  id: string;
  slotStart: string;
  status: 'BOOKED' | 'SERVED' | 'CANCELLED';
  code: string;
  point: { id: string; name: string; lat: number; lng: number; priceUzs: number };
};
type State = 'loading' | 'ready' | 'error';

const TASHKENT: [number, number] = [69.2401, 41.2995];

export function PropaneNearby() {
  const t = useTranslations('propan');
  const pathname = usePathname() ?? '';
  const seg = pathname.split('/').filter(Boolean)[0];
  const locale = seg === 'ru' || seg === 'en' || seg === 'uz' ? seg : 'ru';
  const { data: session } = useSession();
  const isClient = (session?.user as { role?: string } | undefined)?.role === 'CLIENT';

  const [state, setState] = useState<State>('loading');
  const [points, setPoints] = useState<PropanePoint[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PropanePoint | null>(null);
  const [myBooking, setMyBooking] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setState('loading');
    fetch('/api/propane/points')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { points: PropanePoint[] }) => {
        setPoints(d.points);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  const loadMyBooking = useCallback(() => {
    if (!isClient) return;
    fetch('/api/propane/bookings')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { bookings: MyBooking[] }) => {
        const active = d.bookings.find(
          (b) => b.status === 'BOOKED' && new Date(b.slotStart).getTime() > Date.now() - 30 * 60 * 1000,
        );
        setMyBooking(active ?? null);
      })
      .catch(() => {});
  }, [isClient]);

  useEffect(() => {
    track('propane_points_clicked', { where: 'propan_page' });
    load();
  }, [load]);
  useEffect(loadMyBooking, [loadMyBooking]);

  const cancelBooking = async () => {
    if (!myBooking) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/propane/bookings/${myBooking.id}/cancel`, { method: 'POST' });
      if (res.ok) {
        setMyBooking(null);
        track('propane_booking_cancelled');
      }
    } finally {
      setCancelling(false);
    }
  };

  const filtered = points.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Active booking banner */}
      {myBooking && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.default}
          className="rounded-card border border-primary-200 bg-primary-50 p-5 dark:border-primary-500/30 dark:bg-primary-500/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('yourBooking')}</p>
              <p className="mt-1 text-subheading text-navy dark:text-white">
                {t('bookedAt', {
                  point: myBooking.point.name,
                  time: new Date(myBooking.slotStart).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </p>
              <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-primary-700 dark:text-primary-300">
                {myBooking.code}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('showCode')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
              onClick={cancelBooking}
              disabled={cancelling}
            >
              {cancelling ? t('cancelling') : t('cancelBooking')}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden />
        <input
          className="h-12 w-full rounded-control border border-gray-300 dark:border-white/15 bg-white dark:bg-navy-800 py-3 pl-10 pr-4 text-navy dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <PointsMap points={filtered} onSelect={(p) => setSelected(p)} />

      {state === 'loading' && (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer relative h-20 overflow-hidden rounded-card border border-gray-100 dark:border-white/10 bg-white dark:bg-navy-900" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-card border border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900 p-8 text-center shadow-soft dark:shadow-none">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('error')}</p>
          <Button variant="secondary" className="mt-4" onClick={load}>
            <RefreshCw className="h-4 w-4" /> {t('retry')}
          </Button>
        </div>
      )}

      {state === 'ready' && filtered.length === 0 && (
        <div className="rounded-card border border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900 p-10 text-center shadow-soft dark:shadow-none">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500">
            <Flame className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-subheading text-navy dark:text-white">{t('emptyTitle')}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-600 dark:text-gray-300">{t('emptyDesc')}</p>
        </div>
      )}

      {state === 'ready' && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.default, delay: i * 0.05 }}
              className="rounded-card border border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900 p-5 shadow-soft dark:shadow-none"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-subheading text-navy dark:text-white">{p.name}</p>
                    <span
                      className={
                        p.status === 'ACTIVE'
                          ? 'shrink-0 rounded-full bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-600 dark:text-success-500'
                          : 'shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400'
                      }
                    >
                      {p.status === 'ACTIVE' ? t('active') : t('paused')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold tabular-nums text-navy dark:text-white">
                      {formatMoney(p.priceUzs, locale)}
                    </span>{' '}
                    {t('pricePerLiter')} · {t('postsFree', { n: p.postsCount })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                    aria-label={t('openInMaps')}
                  >
                    <Navigation className="h-5 w-5" aria-hidden />
                  </a>
                  <Button size="sm" disabled={p.status !== 'ACTIVE'} onClick={() => setSelected(p)}>
                    {t('chooseSlot')}
                  </Button>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {selected && (
          <SlotSheet
            point={selected}
            locale={locale}
            isClient={isClient}
            onClose={() => setSelected(null)}
            onBooked={(b) => {
              setMyBooking(b);
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Read-only map of points; tapping a marker selects the point. */
function PointsMap({ points, onSelect }: { points: PropanePoint[]; onSelect: (p: PropanePoint) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapProvider.getStyle({ dark: document.documentElement.classList.contains('dark') }),
        center: TASHKENT,
        zoom: 11,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(containerRef.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with the (filtered) points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (disposed || !mapRef.current) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = points.map((p) => {
        const marker = new maplibregl.Marker({ color: p.status === 'ACTIVE' ? '#2E5BFF' : '#9ca3af' })
          .setLngLat([p.lng, p.lat])
          .addTo(mapRef.current!);
        marker.getElement().style.cursor = 'pointer';
        marker.getElement().addEventListener('click', () => onSelectRef.current(p));
        return marker;
      });
      if (points.length > 0) {
        const lats = points.map((p) => p.lat);
        const lngs = points.map((p) => p.lng);
        mapRef.current!.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, maxZoom: 13, duration: 600 },
        );
      }
    })();
    return () => {
      disposed = true;
    };
  }, [points]);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-card border border-gray-200/60 dark:border-white/10 sm:h-72">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

/** Bottom sheet: pick a 15-minute slot and book it. */
function SlotSheet({
  point,
  locale,
  isClient,
  onClose,
  onBooked,
}: {
  point: PropanePoint;
  locale: string;
  isClient: boolean;
  onClose: () => void;
  onBooked: (b: MyBooking) => void;
}) {
  const t = useTranslations('propan');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadSlots = useCallback(() => {
    setFailed(false);
    setSlots(null);
    fetch(`/api/propane/points/${point.id}/slots`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { slots: Slot[] }) => setSlots(d.slots))
      .catch(() => setFailed(true));
  }, [point.id]);

  useEffect(loadSlots, [loadSlots]);

  const book = async () => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/propane/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointId: point.id, slotStart: chosen }),
      });
      if (res.status === 201) {
        const d = (await res.json()) as { booking: { id: string; code: string } };
        track('propane_slot_booked');
        onBooked({
          id: d.booking.id,
          code: d.booking.code,
          slotStart: chosen,
          status: 'BOOKED',
          point: { id: point.id, name: point.name, lat: point.lat, lng: point.lng, priceUzs: point.priceUzs },
        });
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (d.error === 'slot_full') {
        setError(t('slotFull'));
        setChosen(null);
        loadSlots(); // refresh availability after losing the race
      } else if (d.error === 'already_booked') {
        setError(t('alreadyBooked'));
      } else {
        setError(t('loadError'));
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toDateString();
  const free = (slots ?? []).filter((s) => s.free > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-modal flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.5 }}
        transition={spring.sheet}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-sheet bg-white/95 p-6 backdrop-blur-md dark:bg-navy-900/95 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-subheading text-navy dark:text-white">{point.name}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('slotsTitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isClient ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('loginToBook')}</p>
            <Button asChild className="w-full" size="lg">
              <Link href={`/${locale}/client-login`}>{t('signIn')}</Link>
            </Button>
          </div>
        ) : failed ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('loadError')}</p>
            <Button variant="secondary" onClick={loadSlots}>
              <RefreshCw className="h-4 w-4" /> {t('retry')}
            </Button>
          </div>
        ) : slots === null ? (
          <div className="grid grid-cols-4 gap-2" aria-busy>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer relative h-11 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" />
            ))}
          </div>
        ) : free.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-300">{t('slotsEmpty')}</p>
        ) : (
          <>
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1">
              {free.map((s) => {
                const d = new Date(s.start);
                const isToday = d.toDateString() === today;
                const label = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                const dayTag = isToday ? '' : d.toLocaleDateString(locale, { weekday: 'short' });
                const activeChip = chosen === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => setChosen(s.start)}
                    className={`min-h-[44px] rounded-full border px-2 text-sm font-medium tabular-nums transition active:scale-[0.97] motion-reduce:active:scale-100 ${
                      activeChip
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 dark:border-white/10 dark:bg-navy-900 dark:text-gray-200 dark:hover:border-primary-500/40'
                    }`}
                  >
                    {dayTag ? `${dayTag} ` : ''}
                    {label}
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mt-3 rounded-control bg-warning-500/10 px-3 py-2 text-sm text-warning-600 dark:text-warning-500" role="alert">
                {error}
              </p>
            )}

            <Button className="mt-5 w-full" size="lg" disabled={!chosen || busy} onClick={book}>
              {busy ? t('booking') : t('book')}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
