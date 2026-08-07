'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type Ticket = {
  id: string;
  type: 'COMPLAINT' | 'SUGGESTION' | 'QUESTION';
  text: string;
  status: 'NEW' | 'RESOLVED';
  createdAt: string;
  userName: string;
  userPhone: string;
};

export function SupportList({ tickets }: { tickets: Ticket[] }) {
  const t = useTranslations('adminBonus');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/support/${id}`, { method: 'PATCH' });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (tickets.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('noTickets')}</p>;
  }

  return (
    <div className="space-y-3">
      {tickets.map((tk) => {
        const busy = busyId === tk.id;
        const isNew = tk.status === 'NEW';
        return (
          <div key={tk.id} className="card-premium space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary-500/10 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:text-primary-400">
                    {t(`type${tk.type}`)}
                  </span>
                  <span
                    className={
                      isNew
                        ? 'rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400'
                        : 'rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {isNew ? t('statusNew') : t('statusResolved')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">{tk.text}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tk.userName || tk.userPhone || '—'} ·{' '}
                  {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(
                    new Date(tk.createdAt),
                  )}
                </p>
              </div>
              <MessageSquare className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
            </div>
            {isNew && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => resolve(tk.id)} disabled={busy}>
                  <Check className="h-4 w-4" />
                  {t('resolve')}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
