'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Phone, Send, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 placeholder-gray-500 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

export function Contact() {
  const t = useTranslations('contact');
  const tForm = useTranslations('contact.form');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  return (
    <section id="contact" className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors duration-300">
            {t('title')}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto grid max-w-4xl gap-12 md:grid-cols-2"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('phone')}</p>
                <a
                  href="tel:+998901234567"
                  className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                >
                  +998 90 123 45 67
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('telegram')}</p>
                <a
                  href="https://t.me/apexoil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                >
                  @apexoil
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('email')}</p>
                <a
                  href="mailto:support@apexoil.uz"
                  className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                >
                  support@apexoil.uz
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('officeHours')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{t('officeHoursValue')}</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setStatus('idle');
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              try {
                const res = await fetch('/api/contact', {
                  method: 'POST',
                  body: JSON.stringify(Object.fromEntries(fd)),
                });
                if (res.ok) {
                  setStatus('success');
                  form.reset();
                } else {
                  setStatus('error');
                }
              } catch {
                setStatus('error');
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            {status === 'success' && (
              <div
                className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400"
                role="status"
              >
                <CheckCircle className="h-4 w-4 shrink-0" />
                {t('success')}
              </div>
            )}
            {status === 'error' && (
              <div
                className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {t('error')}
              </div>
            )}
            <input
              name="name"
              placeholder={tForm('name')}
              required
              className={inputClass}
              aria-label={tForm('name')}
            />
            <input
              name="company"
              placeholder={tForm('company')}
              className={inputClass}
              aria-label={tForm('company')}
            />
            <input
              name="phone"
              type="tel"
              placeholder={tForm('phone')}
              required
              className={inputClass}
              aria-label={tForm('phone')}
            />
            <textarea
              name="message"
              placeholder={tForm('message')}
              rows={4}
              className={cn(inputClass, 'resize-none')}
              aria-label={tForm('message')}
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 py-6 font-semibold text-white hover:bg-primary-400"
            >
              {loading ? t('sending') : t('submit')}
            </Button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
