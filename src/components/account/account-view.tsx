'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Fuel, LogOut, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';

export function AccountView({
  locale,
  phone,
  name: initialName,
}: {
  locale: string;
  phone: string;
  name: string;
}) {
  const t = useTranslations('account');
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
              <Fuel className="h-5 w-5 text-white" aria-hidden />
            </div>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              {t('title')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}` })}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 sm:px-8">
        {/* Profile */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <form onSubmit={saveName} className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                {t('phone')}
              </label>
              <p className="text-base font-medium text-gray-900">{phone || '—'}</p>
            </div>
            <div>
              <label
                htmlFor="account-name"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                {t('name')}
              </label>
              <input
                id="account-name"
                type="text"
                value={name}
                maxLength={80}
                placeholder={t('namePlaceholder')}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </Button>
              {saved && <span className="text-sm text-emerald-600">{t('saved')}</span>}
            </div>
          </form>
        </section>

        {/* Order history (placeholder — populated in M2) */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="mb-3 flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="text-base font-semibold text-gray-900">{t('orderHistory')}</h2>
          </div>
          <p className="text-sm text-gray-500">{t('orderHistoryEmpty')}</p>
        </section>

        {/* Saved addresses (placeholder — populated in M5) */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="mb-3 flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="text-base font-semibold text-gray-900">{t('addresses')}</h2>
          </div>
          <p className="text-sm text-gray-500">{t('addressesEmpty')}</p>
        </section>
      </main>
    </div>
  );
}
