'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LifeBuoy, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/lib/site-config';
import { cardCls, inputCls } from '@/components/account/shared';

const TYPES = ['COMPLAINT', 'SUGGESTION', 'QUESTION'] as const;
const MAX_TEXT = 1000;

// Поддержка: ticket form (type + text ≤1000) + call button + 24/7 note.
export function SupportSection() {
  const t = useTranslations('account');
  const [type, setType] = useState<(typeof TYPES)[number]>('QUESTION');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error' | 'limited'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/account/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text: text.trim() }),
      });
      if (res.ok) {
        setStatus('ok');
        setText('');
      } else if (res.status === 429) {
        setStatus('limited');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={cardCls}>
        <div className="mb-3 flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden />
          <h2 className="text-heading text-navy dark:text-white">{t('support.title')}</h2>
        </div>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">{t('support.desc')}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="sup-type" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('support.type')}
            </label>
            <select
              id="sup-type"
              className={inputCls}
              value={type}
              onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`support.type${ty}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sup-text" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('support.text')}
            </label>
            <textarea
              id="sup-text"
              className={`${inputCls} min-h-[8rem] resize-y`}
              value={text}
              maxLength={MAX_TEXT}
              placeholder={t('support.textPlaceholder')}
              onChange={(e) => {
                setText(e.target.value);
                setStatus('idle');
              }}
            />
            <p className="mt-1 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {t('support.charsLeft', { n: MAX_TEXT - text.length })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? t('support.submitting') : t('support.submit')}
            </Button>
            {status === 'ok' && <span className="text-sm text-success-600 dark:text-success-500">{t('support.submitted')}</span>}
            {status === 'error' && <span className="text-sm text-red-600 dark:text-red-400">{t('support.error')}</span>}
            {status === 'limited' && <span className="text-sm text-warning-600 dark:text-warning-500">{t('support.rateLimited')}</span>}
          </div>
        </form>
      </section>

      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-subheading text-navy dark:text-white">{t('support.callTitle')}</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t('support.available247')}</p>
          </div>
          <Button asChild variant="secondary">
            <a href={`tel:${siteConfig.supportPhone}`}>
              <Phone className="h-4 w-4" /> {t('support.call')}
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
