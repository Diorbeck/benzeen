'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Snowflake, Sun, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

// Freeze/unfreeze + manual (+liters) adjustment for one client. Every action
// hits a SUPER_ADMIN-only API route that writes an AuditLog. The adjustment
// creates a NEW ledger row — it never edits existing rows.
export function BonusAdminActions({
  userId,
  frozen,
}: {
  userId: string;
  frozen: boolean;
}) {
  const t = useTranslations('adminBonus');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [liters, setLiters] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const toggleFreeze = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/bonus/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, frozen: !frozen }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t('error'));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const adjust = async () => {
    const n = Number(liters);
    if (!Number.isFinite(n) || n <= 0 || !comment.trim()) {
      setError(t('error'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/bonus/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, liters: Math.floor(n), comment: comment.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t('error'));
        return;
      }
      setLiters('');
      setComment('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-premium space-y-4 p-5">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {frozen ? t('frozenBadge') : t('active')}
          </p>
          {frozen && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('frozenNote')}</p>
          )}
        </div>
        <Button
          size="sm"
          variant={frozen ? 'secondary' : 'ghost'}
          onClick={toggleFreeze}
          disabled={busy}
          className={frozen ? '' : 'text-amber-600 dark:text-amber-400'}
        >
          {frozen ? <Sun className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
          {frozen ? t('unfreeze') : t('freeze')}
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3 dark:border-white/10">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('adjustTitle')}</p>
        <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
          <input
            type="number"
            min={1}
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            placeholder={t('adjustLiters')}
            className={inputClass}
          />
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('adjustComment')}
            className={inputClass}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('adjustHint')}</p>
          <Button size="sm" onClick={adjust} disabled={busy || frozen}>
            <Plus className="h-4 w-4" />
            {busy ? t('saving') : t('adjustSubmit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
