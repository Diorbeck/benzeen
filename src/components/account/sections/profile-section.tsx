'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cardCls, inputCls } from '@/components/account/shared';
import { DeleteAccount } from '@/components/account/delete-account';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';

// Профиль: read-only phone + optional name/lastName + sign-out.
export function ProfileSection({
  locale,
  phone,
  name: initialName,
  lastName: initialLast,
}: {
  locale: string;
  phone: string;
  name: string;
  lastName: string;
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
    <section className={cardCls}>
      <h2 className="mb-6 text-heading text-navy dark:text-white">{t('profile.title')}</h2>
      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">{t('phone')}</label>
          <p className="text-base font-medium text-navy dark:text-white">{phone || '—'}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-name" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('name')}
            </label>
            <input
              id="acc-name"
              className={inputCls}
              value={name}
              maxLength={80}
              placeholder={t('namePlaceholder')}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div>
            <label htmlFor="acc-last" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('lastName')}
            </label>
            <input
              id="acc-last"
              className={inputCls}
              value={lastName}
              maxLength={80}
              placeholder={t('lastNamePlaceholder')}
              onChange={(e) => {
                setLastName(e.target.value);
                setSaved(false);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
          {saved && <span className="text-sm text-success-600 dark:text-success-500">{t('saved')}</span>}
        </div>
      </form>

      <PushToggle />

      <div className="mt-8 border-t border-gray-100 dark:border-white/10 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => signOut({ callbackUrl: `/${locale}` })}
        >
          <LogOut className="h-4 w-4" /> {t('logout')}
        </Button>
      </div>

      <DeleteAccount locale={locale} />
    </section>
  );
}

/**
 * Push-тумблер: состояние — реальная подписка этого устройства
 * (pushManager.getSubscription). Скрыт, если браузер не поддерживает push.
 */
function PushToggle() {
  const t = useTranslations('account');
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    setSupported(true);
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEnabled(Boolean(sub));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(false);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        const ok = await subscribeToPush();
        if (ok) setEnabled(true);
        else setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-white/10 pt-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy dark:text-white">{t('push.profileLabel')}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {enabled ? t('push.profileHintOn') : t('push.profileHintOff')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('push.profileLabel')}
          disabled={busy}
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
        >
          <span
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
              enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-white/20'
            }`}
            aria-hidden
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200 ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {t('push.error')}
        </p>
      )}
    </div>
  );
}
