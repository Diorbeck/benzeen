'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bell, Check, Loader2, Navigation, CalendarClock, Phone, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackingMap } from '@/components/map/tracking-map';
import { etaProvider, MAX_ETA_MINUTES } from '@/lib/eta';
import { CANCEL_REASONS, clientCancelVerdict, type CancelReason } from '@/lib/order-cancel';
import { siteConfig } from '@/lib/site-config';
import { spring } from '@/lib/motion';
import { subscribeToPush } from '@/lib/push-client';

export type ClientOrder = {
  id: string;
  status: string;
  fuelType: string;
  volume: number;
  dispensedVolume: number | null;
  pricePerLiter: number | null;
  totalAmount: number | null;
  paymentMethod: string | null;
  scheduledFor: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plate: string | null;
  createdAt: string;
  rating: number | null;
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
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const fmt = useMemo(() => new Intl.NumberFormat('ru-RU'), []);
  const dtTag = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';

  const cancelVerdict = clientCancelVerdict(order.status);

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
  const scheduled = order.status === 'SCHEDULED';
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
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('back')}
      </Link>

      <h1 className="text-title text-navy dark:text-white">{t('title')}</h1>

      {/* Live tracking during active delivery */}
      {!cancelled && isActive && destination && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-navy dark:text-white">
              <Navigation className="h-4 w-4 text-primary-700 dark:text-primary-400" aria-hidden />
              {t('courierComing')}
            </p>
            <span className="text-sm font-semibold tabular-nums text-primary-700 dark:text-primary-400">
              {showEta ? t('eta', { minutes: etaMinutes! }) : t('etaCalculating')}
            </span>
          </div>
          <TrackingMap destination={destination} courier={courier} />
        </div>
      )}

      {order.status === 'DELIVERED' && (
        <div className="mt-6 flex items-center gap-4 rounded-card border border-success-500/20 bg-success-500/10 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="check-draw"
              />
            </svg>
          </span>
          <p className="text-sm font-medium text-navy dark:text-white">{t('steps.DELIVERED')}</p>
        </div>
      )}

      {order.status === 'DELIVERED' && <RatingCard orderId={order.id} initialRating={order.rating} />}

      {cancelled ? (
        <p className="mt-6 rounded-card bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{t('cancelled')}</p>
      ) : scheduled ? (
        <div className="mt-6 space-y-3 rounded-card bg-gray-100 dark:bg-white/10 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-navy dark:text-white">
            <CalendarClock className="h-4 w-4 text-primary-700 dark:text-primary-400" aria-hidden />
            {t('scheduledFor', {
              when: order.scheduledFor
                ? new Date(order.scheduledFor).toLocaleString(dtTag, {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '',
            })}
          </p>
          <Button variant="secondary" onClick={() => setCancelSheetOpen(true)}>
            {t('cancel.cancelOrder')}
          </Button>
        </div>
      ) : (
        <ol className="mt-8 space-y-4">
          {STEPS.map((step, i) => {
            const done = i < activeIndex || order.status === 'DELIVERED';
            const current = i === activeIndex && order.status !== 'DELIVERED';
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    done ? 'bg-success-500 text-primary-950' : current ? 'bg-primary-500 text-primary-950' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : current ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                </span>
                <span className={`text-sm ${done || current ? 'font-medium text-navy dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {t(`steps.${step}`)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Order details */}
      <dl className="mt-8 space-y-2.5 rounded-card border border-gray-200 bg-white p-5 text-sm dark:border-white/10 dark:bg-navy-900 sm:p-6">
        <Row label={t('car')} value={order.plate ?? '—'} />
        <Row label={t('fuel')} value={FUEL_LABEL[order.fuelType] ?? order.fuelType} />
        <Row label={t('volume')} value={`${order.dispensedVolume ?? order.volume} ${t('liters')}`} />
        {order.address && <Row label={t('address')} value={order.address} />}
        {order.totalAmount != null && (
          <Row label={t('total')} value={`${fmt.format(order.totalAmount)} ${t('sum')}`} />
        )}
        <Row label={t('payment')} value={t('payCourier')} />
      </dl>

      {/* Web-push opt-in — the order page is the first thing a client sees after ordering. */}
      {!cancelled && <PushPrompt />}

      {/* Отмена: RECEIVED — кнопка; курьер в пути — телефон поддержки */}
      {cancelVerdict === 'ok' && order.status === 'RECEIVED' && (
        <div className="mt-6">
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
            onClick={() => setCancelSheetOpen(true)}
          >
            {t('cancel.cancelOrder')}
          </Button>
        </div>
      )}
      {cancelVerdict === 'courier_on_way' && (
        <div className="mt-6 flex flex-col gap-3 rounded-card bg-gray-100 p-5 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('cancel.courierOnWay')}</p>
          <Button variant="secondary" size="sm" className="shrink-0" asChild>
            <a href={`tel:${siteConfig.supportPhone}`}>
              <Phone className="h-4 w-4" aria-hidden /> {t('cancel.callSupport')}
            </a>
          </Button>
        </div>
      )}

      <AnimatePresence>
        {cancelSheetOpen && (
          <CancelSheet
            orderId={order.id}
            onClose={() => setCancelSheetOpen(false)}
            onCancelled={() => {
              setCancelSheetOpen(false);
              setOrder((prev) => ({ ...prev, status: 'CANCELLED' }));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Нижний шит отмены: причина (radio-пилюли) + комментарий для «другое». */
function CancelSheet({
  orderId,
  onClose,
  onCancelled,
}: {
  orderId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const t = useTranslations('orderStatus');
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const canSubmit = reason !== null && (reason !== 'OTHER' || comment.trim().length > 0);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/orders/client/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      if (res.ok) {
        onCancelled();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

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
        className="w-full max-w-md rounded-t-sheet bg-white p-6 shadow-soft-lg dark:bg-navy-900 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-subheading text-navy dark:text-white">{t('cancel.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-2 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
            aria-label={t('cancel.keepOrder')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`flex min-h-[44px] w-full items-center rounded-control border-2 px-4 text-left text-sm font-medium transition active:scale-[0.99] motion-reduce:active:scale-100 ${
                reason === r
                  ? 'border-primary-600 bg-white text-navy dark:bg-white/10 dark:text-white'
                  : 'border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200/70 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
              }`}
            >
              {t(`cancel.reason${r}`)}
            </button>
          ))}
        </div>

        {reason === 'OTHER' && (
          <textarea
            className="mt-3 min-h-[72px] w-full rounded-control border border-transparent bg-gray-100 p-3 text-sm text-navy placeholder-gray-500 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy dark:bg-white/10 dark:text-white dark:placeholder-gray-500 dark:focus:bg-white/15 dark:focus:ring-white/60"
            placeholder={t('cancel.commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
            autoFocus
          />
        )}

        {error && (
          <p className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {t('cancel.error')}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600/60"
            disabled={!canSubmit || busy}
            onClick={submit}
          >
            {busy ? t('cancel.cancelling') : t('cancel.confirm')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            {t('cancel.keepOrder')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Оценка доставки: 5 звёзд + необязательный комментарий, один раз. */
function RatingCard({ orderId, initialRating }: { orderId: string; initialRating: number | null }) {
  const t = useTranslations('orderStatus');
  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initialRating != null);
  const [error, setError] = useState(false);

  const submit = async () => {
    if (rating < 1) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/orders/client/${orderId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (res.ok || res.status === 409) {
        // 409 already_rated — заказ уже оценён, показываем «спасибо».
        setDone(true);
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900 sm:p-6">
      {done ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex" role="img" aria-label={t('rating.title')}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i <= rating ? 'fill-current text-warning-500' : 'text-gray-300 dark:text-gray-600'}`}
                aria-hidden
              />
            ))}
          </span>
          <p className="text-sm font-medium text-success-600 dark:text-success-500">{t('rating.thanks')}</p>
        </div>
      ) : (
        <>
          <h2 className="text-subheading text-navy dark:text-white">{t('rating.title')}</h2>
          <div className="mt-2 -ml-2.5 flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                aria-pressed={i <= rating}
                aria-label={`${i}/5`}
                className="flex h-11 w-11 items-center justify-center rounded-control transition active:scale-[0.92] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
              >
                <Star
                  className={`h-7 w-7 transition-colors ${
                    i <= rating ? 'fill-current text-warning-500' : 'text-gray-300 dark:text-gray-600'
                  }`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="mt-3 space-y-3">
              <textarea
                className="min-h-[72px] w-full rounded-control border border-transparent bg-gray-100 p-3 text-sm text-navy placeholder-gray-500 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy dark:bg-white/10 dark:text-white dark:placeholder-gray-500 dark:focus:bg-white/15 dark:focus:ring-white/60"
                placeholder={t('rating.commentPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
              {error && (
                <p className="rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {t('rating.error')}
                </p>
              )}
              <Button onClick={submit} disabled={busy}>
                {busy ? t('rating.submitting') : t('rating.submit')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Web-push opt-in card. Shown once: only when the browser supports push,
 * permission was never asked, and the client hasn't been prompted before.
 */
function PushPrompt() {
  const t = useTranslations('account');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem('benzeen-push-prompted')) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('benzeen-push-prompted', '1');
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    setError(false);
    try {
      const ok = await subscribeToPush();
      if (ok) dismiss();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="mt-4 rounded-card border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-navy-900 sm:p-6">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-navy dark:text-white">{t('push.promptTitle')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('push.promptBody')}</p>
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {t('push.error')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={enable} disabled={busy}>
          {t('push.enable')}
        </Button>
        <Button variant="ghost" onClick={dismiss} disabled={busy}>
          {t('push.later')}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-navy dark:text-white">{value}</dd>
    </div>
  );
}
