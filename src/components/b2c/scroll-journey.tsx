'use client';

import { useEffect, useRef, useState } from 'react';

// Скролл-анимация главной (только десктоп) — метафора продукта: страница
// «заправляется» вместе с пользователем.
//
//   • силуэт машины едет вниз по фону — темнее фонового цвета, приглушённый;
//   • в самом низу страницы машину ждёт заправочная станция;
//   • у правого края — индикатор бака: опустошается при скролле вниз и
//     наполняется при скролле вверх, привязан к позиции скролла.
//
// Всё это слой под контентом и без pointer-events, поэтому не мешает главному
// действию — заказу. На узких экранах и при prefers-reduced-motion выключено:
// на телефоне это только съедало бы кадр и батарею.

export function ScrollJourney() {
  const [progress, setProgress] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = () => setEnabled(wide.matches && !calm.matches);
    sync();
    wide.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const read = () => {
      frame.current = null;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      // Короткая страница (или ещё не отрисованный контент) не должна давать
      // деления на ноль и рывка индикатора в полный бак.
      setProgress(max > 120 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };

    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  // Машина идёт от верхней кромки до площадки заправки внизу экрана.
  const carTop = 12 + progress * 62; // % высоты вьюпорта
  // Станция «проявляется» на последней четверти пути — до этого она за кадром.
  const stationIn = Math.min(1, Math.max(0, (progress - 0.72) / 0.28));
  const fuelLeft = 1 - progress;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden select-none lg:block">
      {/* Полоса дороги, по которой идёт машина. */}
      <div className="absolute inset-y-0 left-[68px] w-px bg-navy/[0.05] dark:bg-white/[0.05]" />
      <div
        className="absolute left-[68px] w-px bg-navy/[0.12] dark:bg-white/[0.12]"
        style={{ top: 0, height: `${progress * 100}%` }}
      />

      {/* Силуэт машины: темнее фона, без деталей — это фон, а не иллюстрация. */}
      <div
        className="absolute left-[68px] -translate-x-1/2 text-navy/[0.09] dark:text-white/[0.09]"
        style={{ top: `${carTop}%`, transition: 'top 120ms linear' }}
      >
        <CarSilhouette />
      </div>

      {/* Заправка в самом низу: машина приезжает к ней в конце страницы. */}
      <div
        className="absolute bottom-6 left-0 text-navy/[0.11] dark:text-white/[0.11]"
        style={{ opacity: stationIn }}
      >
        <StationSilhouette />
      </div>

      {/* Индикатор бака у правого края. */}
      <FuelGauge value={fuelLeft} />
    </div>
  );
}

function CarSilhouette() {
  return (
    <svg width="104" height="70" viewBox="0 0 132 86" fill="currentColor">
      {/* Вид сверху: кузов, стёкла и колёса — узнаётся как машина одним пятном. */}
      <rect x="26" y="4" width="80" height="78" rx="26" />
      <rect x="14" y="18" width="12" height="18" rx="5" />
      <rect x="106" y="18" width="12" height="18" rx="5" />
      <rect x="14" y="50" width="12" height="18" rx="5" />
      <rect x="106" y="50" width="12" height="18" rx="5" />
    </svg>
  );
}

function StationSilhouette() {
  return (
    <svg width="176" height="120" viewBox="0 0 220 150" fill="currentColor">
      {/* Навес на двух опорах, под ним колонка — читаемый силуэт АЗС. */}
      <rect x="0" y="10" width="220" height="16" rx="8" />
      <rect x="14" y="26" width="12" height="118" rx="6" />
      <rect x="194" y="26" width="12" height="118" rx="6" />
      <rect x="63" y="72" width="44" height="72" rx="10" />
      <rect x="73" y="84" width="24" height="20" rx="5" opacity="0.45" />
      <rect x="0" y="144" width="220" height="6" rx="3" />
    </svg>
  );
}

function FuelGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/25 dark:text-white/25">
        F
      </span>
      <div className="relative h-44 w-2 overflow-hidden rounded-full bg-navy/[0.08] dark:bg-white/[0.08]">
        <div
          className="absolute inset-x-0 bottom-0 rounded-full bg-primary-600/70 dark:bg-primary-400/70"
          style={{ height: `${pct}%`, transition: 'height 140ms linear' }}
        />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/25 dark:text-white/25">
        E
      </span>
    </div>
  );
}
