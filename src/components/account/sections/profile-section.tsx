'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cardCls, inputCls } from '@/components/account/shared';

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

      <div className="mt-8 border-t border-gray-100 dark:border-white/10 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => signOut({ callbackUrl: `/${locale}` })}
        >
          <LogOut className="h-4 w-4" /> {t('logout')}
        </Button>
      </div>
    </section>
  );
}
