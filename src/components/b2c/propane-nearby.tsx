'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flame, MapPin, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';

type PropanePoint = { id: string; name: string; lat: number; lng: number; pricePerLiter: number | null; status: string };
type State = 'loading' | 'ready' | 'error';

/**
 * Propane "points near you" skeleton (M-pass). Points come from the admin in
 * M4; until then there is no data source, so this resolves to an honest EMPTY
 * state — never fake points. Wiring: replace the effect with a real fetch that
 * sets points/error; the loading/empty/error UI is already here.
 */
export function PropaneNearby() {
  const t = useTranslations('propan');
  const [state, setState] = useState<State>('loading');
  const [points, setPoints] = useState<PropanePoint[]>([]);
  const [query, setQuery] = useState('');

  const load = () => {
    setState('loading');
    // No points API yet (M4). We "check" and land on empty — no invented data.
    const id = setTimeout(() => {
      setPoints([]);
      setState('ready');
    }, 400);
    return () => clearTimeout(id);
  };

  useEffect(() => {
    track('propane_points_clicked', { where: 'propan_page' });
    return load();
  }, []);

  const filtered = points.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden />
        <input
          className="h-12 w-full rounded-control border border-gray-300 dark:border-white/15 bg-white dark:bg-navy-800 py-3 pl-10 pr-4 text-navy dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Map placeholder — real tiles/markers land with the points API (M4). */}
      <div className="relative h-56 overflow-hidden rounded-card border border-gray-200/60 dark:border-white/10 bg-gray-100 dark:bg-navy-900 sm:h-72">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-navy-800 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 shadow-soft dark:shadow-none">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t('mapSoon')}
          </span>
        </div>
      </div>

      {state === 'loading' && (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card border border-gray-100 dark:border-white/10 bg-white dark:bg-navy-900" />
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
          {filtered.map((p) => (
            <li key={p.id} className="rounded-card border border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900 p-5 shadow-soft dark:shadow-none">
              <p className="text-sm font-semibold text-navy dark:text-white">{p.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
