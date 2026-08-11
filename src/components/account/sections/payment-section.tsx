'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Copy, Check, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLiters } from '@/lib/format';
import { type ReferralStats, cardCls } from '@/components/account/shared';

// Оплата: bonus-liter balance + accrual history + referral link + cards stub.
export function PaymentSection({ locale, referral }: { locale: string; referral?: ReferralStats }) {
  const t = useTranslations('account');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (referral) setLink(`${window.location.origin}/${locale}?ref=${referral.code}`);
  }, [locale, referral]);

  const copy = async () => {
    const url = link || (referral ? `/${locale}?ref=${referral.code}` : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const reasonLabel = (r: string) => (t.has(`bonus.reason.${r}`) ? t(`bonus.reason.${r}`) : r);
  const progress = referral ? Math.min(referral.friendCount, referral.milestoneAt) : 0;

  return (
    <div className="space-y-6">
      {referral && (
        <section className={cardCls}>
          <div className="mb-6 flex items-center gap-2.5">
            <Gift className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden />
            <h2 className="text-heading text-navy dark:text-white">{t('payment.bonusTitle')}</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control bg-primary-50/60 dark:bg-primary-500/15 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('payment.bonusBalance')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-navy dark:text-white">{formatLiters(referral.balance, locale)}</p>
            </div>
            <div className="rounded-control bg-gray-50 dark:bg-white/5 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('payment.referralFriends')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-navy dark:text-white">
                {progress} / {referral.milestoneAt}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-navy dark:text-white">{t('payment.referralTitle')}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('payment.referralDesc')}</p>
            <label className="mt-4 block text-sm font-medium text-gray-500 dark:text-gray-400">{t('payment.referralLink')}</label>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex h-12 min-w-0 flex-1 items-center truncate rounded-control border border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-navy-800 px-4 text-sm text-navy dark:text-white">
                {link || (referral ? `/${locale}?ref=${referral.code}` : '')}
              </code>
              <Button type="button" className="shrink-0" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('payment.copied') : t('payment.copy')}
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">{t('payment.bonusHistory')}</h3>
            {referral.ledger.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('payment.bonusEmpty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10 border-t border-gray-100 dark:border-white/10">
                {referral.ledger.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">{reasonLabel(row.reason)}</span>
                    <span
                      className={`shrink-0 font-medium tabular-nums ${
                        row.reason === 'SPENT' ? 'text-gray-500 dark:text-gray-400' : 'text-success-600 dark:text-success-500'
                      }`}
                    >
                      {row.reason === 'SPENT' ? '−' : '+'}
                      {formatLiters(row.liters, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Bank cards — stub, groundwork for future Payme tokens. */}
      <section className={cardCls}>
        <div className="mb-4 flex items-center gap-2.5">
          <CreditCard className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden />
          <h2 className="text-heading text-navy dark:text-white">{t('payment.cardsTitle')}</h2>
        </div>
        <p className="rounded-control border border-dashed border-gray-300 dark:border-white/15 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('payment.cardsStub')}
        </p>
      </section>
    </div>
  );
}
