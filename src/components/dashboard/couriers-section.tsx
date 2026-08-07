'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bike,
  Plus,
  Download,
  Check,
  Copy,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Courier = {
  id: string;
  name: string | null;
  phone: string | null;
  vehicleNumber: string | null;
  telegramLinked: boolean;
  onDuty: boolean;
  deactivated: boolean;
  locationFresh: boolean;
  locationUpdatedAt: string | null;
  activeOrders: number;
  deliveredToday: number;
  litersToday: number;
};

type Handoff = {
  login: string;
  tempPassword: string;
  botLink: string | null;
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CouriersSection({
  couriers,
  locale,
}: {
  couriers: Courier[];
  locale: string;
}) {
  const t = useTranslations('adminCouriers');
  const router = useRouter();

  // Create form
  const [form, setForm] = useState({ name: '', phone: '', vehicleNumber: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // CSV export
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const create = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setCreateError(t('fillRequired'));
      return;
    }
    setCreating(true);
    setCreateError('');
    setHandoff(null);
    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          vehicleNumber: form.vehicleNumber.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error || t('createFailed'));
        return;
      }
      setHandoff({ login: data.login, tempPassword: data.tempPassword, botLink: data.botLink ?? null });
      setForm({ name: '', phone: '', vehicleNumber: '' });
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('locale', locale);
      const res = await fetch(`/api/couriers/export?${qs.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `couriers_${from || 'start'}_${to || 'today'}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create courier */}
      <div className="card-premium space-y-3 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('createTitle')}
        </h2>
        {createError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {createError}
          </p>
        )}
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('fioLabel')} *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Иванов Иван"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('phoneLabel')} *
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+998 90 000 00 00"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('vehicleLabel')}
            </label>
            <input
              value={form.vehicleNumber}
              onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
              placeholder="01A123BC"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={create} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? t('adding') : t('addBtn')}
          </Button>
        </div>

        {/* Hand-off block: "Передай курьеру" */}
        {handoff && (
          <div className="mt-2 space-y-3 rounded-xl border border-primary-500/30 bg-primary-500/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                {t('handoffTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setHandoff(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={t('handoffDone')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('handoffHint')}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <HandoffField
                label={t('handoffLogin')}
                value={handoff.login}
                copied={copied === 'login'}
                onCopy={() => copy('login', handoff.login)}
                copyLabel={t('copy')}
                copiedLabel={t('copied')}
              />
              <HandoffField
                label={t('handoffPassword')}
                value={handoff.tempPassword}
                copied={copied === 'pw'}
                onCopy={() => copy('pw', handoff.tempPassword)}
                copyLabel={t('copy')}
                copiedLabel={t('copied')}
                mono
              />
              {handoff.botLink && (
                <HandoffField
                  label={t('handoffBotLink')}
                  value={handoff.botLink}
                  copied={copied === 'bot'}
                  onCopy={() => copy('bot', handoff.botLink!)}
                  copyLabel={t('copy')}
                  copiedLabel={t('copied')}
                />
              )}
            </div>
            <div className="rounded-lg bg-white/60 p-3 dark:bg-white/5">
              <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                {t('cheatsheetTitle')}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-300">
                <li>{t('step1')}</li>
                <li>{t('step2')}</li>
                <li>{t('step3')}</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* CSV export */}
      <div className="card-premium flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('periodFrom')}
            </label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('periodTo')}
            </label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={exporting}>
          <Download className="h-4 w-4" />
          {exporting ? t('exporting') : t('exportCsv')}
        </Button>
      </div>

      {/* Courier list */}
      {couriers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('empty')}</p>
      ) : (
        <div className="card-premium overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="px-4 py-3">{t('colCourier')}</th>
                <th className="px-4 py-3">{t('colTg')}</th>
                <th className="px-4 py-3">{t('colDuty')}</th>
                <th className="px-4 py-3">{t('colLocation')}</th>
                <th className="px-4 py-3">{t('colActive')}</th>
                <th className="px-4 py-3">{t('colToday')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary-500/10 p-2">
                        <Bike className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {c.name || '—'}
                          {c.deactivated && (
                            <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">
                              {t('deactivatedBadge')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {c.phone || '—'}
                          {c.vehicleNumber ? ` · ${c.vehicleNumber}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={c.telegramLinked} yes={t('linked')} no={t('notLinked')} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={c.onDuty} yes={t('yes')} no={t('no')} />
                  </td>
                  <td className="px-4 py-3">
                    <LocationCell
                      fresh={c.locationFresh}
                      updatedAt={c.locationUpdatedAt}
                      freshLabel={t('locationFresh')}
                      staleLabel={t('locationStale')}
                      noneLabel={t('locationNone')}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-white">
                    {c.activeOrders}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-white">
                    {c.deliveredToday}{' '}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      · {c.litersToday} {t('litersUnit')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${locale}/dashboard/couriers/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                    >
                      {t('open')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HandoffField({
  label,
  value,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
  mono,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`truncate text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}
          title={value}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-400'}`} />
      {ok ? yes : no}
    </span>
  );
}

function LocationCell({
  fresh,
  updatedAt,
  freshLabel,
  staleLabel,
  noneLabel,
}: {
  fresh: boolean;
  updatedAt: string | null;
  freshLabel: string;
  staleLabel: string;
  noneLabel: string;
}) {
  if (!updatedAt) {
    return <span className="text-xs text-gray-400">{noneLabel}</span>;
  }
  const label = fresh ? freshLabel : staleLabel;
  const color = fresh ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
  const dot = fresh ? 'bg-green-500' : 'bg-amber-500';
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(updatedAt),
  );
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
      <span className="text-gray-400">· {time}</span>
    </span>
  );
}
