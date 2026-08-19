'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TASHKENT_CENTER } from '@/components/map/provider';
import { haversineKm } from '@/lib/geo';

// Один источник данных для первого экрана: карта и список «Заправки рядом»
// читают те же АЗС и тот же центр, поэтому не могут разойтись между собой и не
// дублируют запрос к /api/stations.

export type Stock = {
  fuelType: string;
  litersAvailable: number;
  capacityL: number;
  dataFresh: boolean;
  tanksCount: number;
  priceUzs: number | null;
};

export type Station = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  region: string | null;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'PAUSED';
  online: boolean;
  isDemo?: boolean;
  lastSeenAt: string | null;
  stocks: Stock[];
};

export type LatLng = { lat: number; lng: number };

/** По умолчанию видно только ближайшие 5 км: человек ищет, где заправиться сейчас. */
export const DEFAULT_RADIUS_KM = 5;
const REFRESH_MS = 30_000;

export type HomeStations = {
  stations: Station[];
  /** АЗС в текущей области видимости (радиус 5 км или все, если раскрыли). */
  visible: (Station & { distanceKm: number })[];
  state: 'loading' | 'ready' | 'error';
  reload: () => void;
  center: LatLng;
  /** Геолокация подтверждена браузером (иначе центр — Ташкент). */
  located: boolean;
  locate: () => void;
  expanded: boolean;
  expand: () => void;
  collapse: () => void;
};

export function useHomeStations(): HomeStations {
  const [stations, setStations] = useState<Station[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [center, setCenter] = useState<LatLng>(TASHKENT_CENTER);
  const [located, setLocated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocated(true);
        setExpanded(false);
      },
      // Отказ в геолокации — не ошибка: остаёмся на центре Ташкента.
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const reload = useCallback(() => {
    setState((prev) => (prev === 'ready' ? prev : 'loading'));
    fetchStations()
      .then((list) => {
        setStations(list);
        setState('ready');
      })
      .catch(() => setState((prev) => (prev === 'ready' ? prev : 'error')));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = (silent: boolean) => {
      if (!silent) setState('loading');
      fetchStations()
        .then((list) => {
          if (cancelled) return;
          setStations(list);
          setState('ready');
        })
        // Молчаливое обновление не стирает уже показанные данные: одна неудачная
        // попытка на плохой связи — не причина обнулять карту.
        .catch(() => {
          if (!cancelled) setState((prev) => (silent && prev === 'ready' ? prev : 'error'));
        });
    };
    run(false);
    const id = setInterval(() => run(true), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const withDistance = useMemo(
    () =>
      stations
        .map((s) => ({ ...s, distanceKm: haversineKm(center, { lat: s.lat, lng: s.lng }) }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [stations, center],
  );

  const visible = useMemo(
    () => (expanded ? withDistance : withDistance.filter((s) => s.distanceKm <= DEFAULT_RADIUS_KM)),
    [withDistance, expanded],
  );

  return {
    stations,
    visible,
    state,
    reload,
    center,
    located,
    locate,
    expanded,
    expand: useCallback(() => setExpanded(true), []),
    collapse: useCallback(() => setExpanded(false), []),
  };
}

async function fetchStations(): Promise<Station[]> {
  const res = await fetch('/api/stations');
  if (!res.ok) throw new Error('request failed');
  const data = (await res.json()) as { stations: Station[] };
  return data.stations ?? [];
}

/** Заполненность резервуаров по виду топлива, % — как в карточке «в наличии». */
export function fillPercent(stock: Stock): number | null {
  if (!stock.capacityL) return null;
  return Math.max(0, Math.min(100, Math.round((stock.litersAvailable / stock.capacityL) * 100)));
}
