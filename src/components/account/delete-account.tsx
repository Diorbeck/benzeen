'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spring } from '@/lib/motion';
import { inputCls } from '@/components/account/shared';

type Notice = { tone: 'warning' | 'error'; text: string } | null;

// «Опасная зона» профиля: самоудаление аккаунта (= анонимизация) через SMS-код.
export function DeleteAccount({ locale }: { locale: string }) {
  const t = useTranslations('account');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'info' | 'code'>('info');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const openSheet = () => {
    setStep('info');
    setCode('');
    setNotice(null);
    setOpen(true);
  };

  // 409 blockers are shared by both steps: an active order/booking must be
  // finished or cancelled before the account can go.
  const blockedNotice = (error?: string): Notice =>
    error === 'active_booking'
      ? { tone: 'warning', text: t('deletion.blockedBooking') }
      : { tone: 'warning', text: t('deletion.blockedOrder') };

  const sendCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/account/delete/send-code', { method: 'POST' });
      if (res.ok) {
        setStep('code');
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setNotice(blockedNotice(data?.error));
        return;
      }
      setNotice({ tone: 'error', text: t('deletion.genericError') });
    } catch {
      setNotice({ tone: 'error', text: t('deletion.genericError') });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setNotice({ tone: 'error', text: t('deletion.invalidCode') });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/account/delete/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });
      if (res.ok) {
        // The account no longer exists — end the session and go home.
        await signOut({ callbackUrl: `/${locale}` });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setNotice(blockedNotice(data?.error));
        return;
      }
      if (res.status === 400 && data?.error === 'invalid_code') {
        setNotice({ tone: 'error', text: t('deletion.invalidCode') });
        return;
      }
      setNotice({ tone: 'error', text: t('deletion.genericError') });
    } catch {
      setNotice({ tone: 'error', text: t('deletion.genericError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-white/10 pt-6">
      <h3 className="text-subheading text-navy dark:text-white">{t('deletion.title')}</h3>
      <Button
        type="button"
        variant="ghost"
        className="mt-3 -ml-4 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        onClick={openSheet}
      >
        {t('deletion.cta')}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-modal flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => !busy && setOpen(false)}
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
              aria-label={t('deletion.title')}
            >
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-navy dark:text-white">{t('deletion.title')}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-control p-2 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
                  aria-label={t('deletion.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {notice && (
                <p
                  role="alert"
                  className={`mb-3 rounded-control px-3 py-2 text-sm ${
                    notice.tone === 'warning'
                      ? 'bg-warning-500/10 text-warning-600 dark:text-warning-500'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  {notice.text}
                </p>
              )}

              {step === 'info' ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-navy dark:text-white">{t('deletion.whatGoesTitle')}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('deletion.whatGoes')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy dark:text-white">{t('deletion.whatStaysTitle')}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('deletion.whatStays')}</p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={sendCode}>
                      {busy ? t('deletion.sending') : t('deletion.sendCode')}
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => setOpen(false)}>
                      {t('deletion.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirm();
                  }}
                  className="space-y-3"
                >
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('deletion.codeSentTo')}</p>
                  <input
                    className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t('deletion.codePlaceholder')}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  {/* Destructive confirm — the one sanctioned color override of Button. */}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600/60"
                  >
                    {busy ? t('deletion.deleting') : t('deletion.confirm')}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => setOpen(false)}>
                    {t('deletion.cancel')}
                  </Button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
