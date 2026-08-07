'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PendingRow = {
  id: string;
  liters: number;
  createdAt: string;
  userName: string;
  userPhone: string;
};

// "На проверку" — PENDING accruals that exceeded the daily cap. Approve → POSTED,
// Reject → REJECTED (flips only status; audited SUPER_ADMIN-only route).
export function PendingReviewList({ rows }: { rows: PendingRow[] }) {
  const t = useTranslations('adminBonus');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/bonus/pending/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('noPending')}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const busy = busyId === r.id;
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {r.userName || r.userPhone || '—'}{' '}
                <span className="font-normal text-gray-500 dark:text-gray-400">
                  +{r.liters} {t('liters')}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(r.createdAt),
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => decide(r.id, 'approve')} disabled={busy}>
                <Check className="h-4 w-4" />
                {t('approve')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => decide(r.id, 'reject')}
                disabled={busy}
                className="text-red-600 dark:text-red-400"
              >
                <X className="h-4 w-4" />
                {t('reject')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
