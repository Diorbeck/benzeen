'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

// SUPER_ADMIN client deletion: anonymize by default, physical delete only for
// spam accounts (no orders / no ledger). The API writes an AuditLog row.
export function ClientDelete({ clientId, deleted }: { clientId: string; deleted: boolean }) {
  const t = useTranslations('dashboard.clients');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [hard, setHard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (deleted) {
    return (
      <div className="card-premium p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t('deletedBadge')}
        </span>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined, hard: hard || undefined }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      switch (d?.error) {
        case 'active_order':
          setError(t('deleteBlockedOrder'));
          break;
        case 'active_booking':
          setError(t('deleteBlockedBooking'));
          break;
        case 'not_eligible':
          setError(t('deleteNotEligible'));
          break;
        case 'already_deleted':
          setError(t('deletedBadge'));
          break;
        default:
          setError(t('deleteError'));
      }
    } catch {
      setError(t('deleteError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-premium space-y-3 p-5">
      {!open ? (
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          {t('deleteClient')}
        </Button>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
            {t('deleteClient')}
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="client-delete-reason" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('deleteReason')}
            </label>
            <textarea
              id="client-delete-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{t('deleteAnonymizeHint')}</p>
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={hard}
                onChange={(e) => setHard(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              {t('deleteHard')}
            </label>
            <p className="mt-1 pl-6 text-[11px] text-gray-400 dark:text-gray-500">{t('deleteHardHint')}</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {/* Destructive confirm — sanctioned red override of Button. */}
            <Button
              size="sm"
              disabled={busy}
              onClick={submit}
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600/60"
            >
              {busy ? t('deleting') : t('deleteConfirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError('');
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
