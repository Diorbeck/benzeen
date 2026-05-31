'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { User, Building2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Company = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  telegram: string | null;
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

export function SettingsPanel({
  user,
  company,
}: {
  user?: { name?: string | null; email?: string | null; role?: string } | null;
  company?: Company | null;
}) {
  const t = useTranslations('settings');
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: company?.name ?? '',
    address: company?.address ?? '',
    phone: company?.phone ?? '',
    telegram: company?.telegram ?? '',
  });

  const startEdit = () => {
    setForm({
      name: company?.name ?? '',
      address: company?.address ?? '',
      phone: company?.phone ?? '',
      telegram: company?.telegram ?? '',
    });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          telegram: form.telegram.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-white/5"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary-500/10 p-3">
            <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{user?.name || 'Пользователь'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('role')}: {user?.role}</p>
          </div>
        </div>
      </motion.div>

      {company && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-white/5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary-500/10 p-2">
                <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('editCompany')}
              </h2>
            </div>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={startEdit} className="text-gray-500 dark:text-gray-400">
                <Pencil className="h-4 w-4" />
                {t('edit')}
              </Button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t('companyName')}
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t('address')}
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t('phone')}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t('telegram')}
                </label>
                <input
                  value={form.telegram}
                  onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-4 w-4" />
                  {t('cancel')}
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="h-4 w-4" />
                  {saving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('companyName')}</dt>
                <dd className="text-right font-medium text-gray-900 dark:text-white">{company.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('address')}</dt>
                <dd className="text-right text-gray-900 dark:text-white">{company.address || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('phone')}</dt>
                <dd className="text-right text-gray-900 dark:text-white">{company.phone || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('telegram')}</dt>
                <dd className="text-right text-gray-900 dark:text-white">{company.telegram || '—'}</dd>
              </div>
            </dl>
          )}
        </motion.div>
      )}
    </div>
  );
}
