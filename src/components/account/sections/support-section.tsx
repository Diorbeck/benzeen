'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, LifeBuoy, Phone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/lib/site-config';
import { cardCls, inputCls } from '@/components/account/shared';

const TYPES = ['COMPLAINT', 'SUGGESTION', 'QUESTION'] as const;
const MAX_TEXT = 1000;

type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

// Legacy statuses map onto the new lifecycle: NEW → OPEN, RESOLVED → CLOSED.
function normalizeStatus(status: string): TicketStatus {
  if (status === 'ANSWERED') return 'ANSWERED';
  if (status === 'CLOSED' || status === 'RESOLVED') return 'CLOSED';
  return 'OPEN';
}

type ThreadMessage = {
  id: string;
  authorType: 'CLIENT' | 'ADMIN' | 'AI';
  text: string;
  createdAt: string;
};

type TicketListItem = {
  id: string;
  type: (typeof TYPES)[number];
  status: string;
  needsHuman: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage: { authorType: string; text: string; createdAt: string } | null;
};

type TicketThread = {
  id: string;
  type: (typeof TYPES)[number];
  status: string;
  needsHuman: boolean;
  createdAt: string;
  messages: ThreadMessage[];
};

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: 'bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-400',
  ANSWERED: 'bg-success-600/10 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  CLOSED: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

// Поддержка 2.0: форма нового обращения + треды переписки (клиент ↔ ИИ/оператор).
export function SupportSection() {
  const t = useTranslations('account');
  const locale = useLocale();
  const dtTag = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';

  const formRef = useRef<HTMLElement | null>(null);

  // --- Новое обращение (existing form) ---
  const [type, setType] = useState<(typeof TYPES)[number]>('QUESTION');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error' | 'limited'>('idle');

  // --- Список тредов ---
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [listError, setListError] = useState(false);

  // --- Выбранный тред ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [threadError, setThreadError] = useState(false);

  // --- Композер треда ---
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'limited' | 'error'>('idle');
  const [escalated, setEscalated] = useState(false);

  const loadTickets = useCallback(async () => {
    setListError(false);
    try {
      const res = await fetch('/api/account/support/tickets');
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { tickets: TicketListItem[] };
      setTickets(data.tickets);
    } catch {
      setListError(true);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setThreadError(false);
    try {
      const res = await fetch(`/api/account/support/tickets/${id}`);
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { ticket: TicketThread };
      setThread(data.ticket);
    } catch {
      setThreadError(true);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openThread = (id: string) => {
    setSelectedId(id);
    setThread(null);
    setMessage('');
    setSendStatus('idle');
    setEscalated(false);
    void loadThread(id);
  };

  const backToList = () => {
    setSelectedId(null);
    setThread(null);
    void loadTickets();
  };

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
        void loadTickets();
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

  const sendMessage = async () => {
    if (!thread || !message.trim() || sending) return;
    setSending(true);
    setSendStatus('idle');
    try {
      const res = await fetch(`/api/account/support/tickets/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.trim() }),
      });
      if (res.ok) {
        setMessage('');
        // ИИ мог ответить сразу — перезагружаем тред целиком.
        await loadThread(thread.id);
      } else if (res.status === 429) {
        setSendStatus('limited');
      } else if (res.status === 409) {
        await loadThread(thread.id);
      } else {
        setSendStatus('error');
      }
    } catch {
      setSendStatus('error');
    } finally {
      setSending(false);
    }
  };

  const callOperator = async () => {
    if (!thread) return;
    try {
      const res = await fetch(`/api/account/support/tickets/${thread.id}/escalate`, {
        method: 'POST',
      });
      if (res.ok) {
        setEscalated(true);
        setThread({ ...thread, needsHuman: true });
      } else if (res.status === 409) {
        await loadThread(thread.id);
      }
    } catch {
      // Тихо: кнопка остаётся, можно повторить.
    }
  };

  const scrollToForm = () => {
    backToList();
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(dtTag, { dateStyle: 'short', timeStyle: 'short' });

  const renderBubble = (m: ThreadMessage) => {
    const isClient = m.authorType === 'CLIENT';
    const isAi = m.authorType === 'AI';
    const bubbleCls = isClient
      ? 'bg-gray-100 dark:bg-white/10'
      : isAi
        ? 'border border-primary-200 bg-white dark:border-primary-500/30 dark:bg-navy-800'
        : 'border border-gray-200/60 bg-white dark:border-white/10 dark:bg-navy-800';
    return (
      <div key={m.id} className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
        <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-gray-500 dark:text-gray-400">
          {isAi && <Sparkles className="h-3 w-3 text-primary-800 dark:text-primary-400" aria-hidden />}
          {isClient ? t('support2.youName') : isAi ? t('support2.aiName') : t('support2.operatorName')}
        </span>
        <div className={`max-w-[85%] rounded-card px-4 py-3 text-sm text-navy dark:text-white ${bubbleCls}`}>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
        </div>
        <span className="mt-0.5 px-1 text-xs text-gray-400">{fmtDate(m.createdAt)}</span>
      </div>
    );
  };

  const threadStatus = thread ? normalizeStatus(thread.status) : null;
  const threadOpen = threadStatus === 'OPEN' || threadStatus === 'ANSWERED';
  const showCallOperator = thread != null && threadOpen && !thread.needsHuman && !escalated;

  return (
    <div className="space-y-6">
      <section ref={formRef} className={cardCls}>
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
        {selectedId == null ? (
          <>
            <h3 className="mb-4 text-subheading text-navy dark:text-white">{t('support2.title')}</h3>
            {listError ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('support2.loadError')}</p>
                <Button variant="secondary" size="sm" onClick={() => void loadTickets()}>
                  {t('support2.retry')}
                </Button>
              </div>
            ) : tickets == null ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-card bg-gray-100 dark:bg-white/5" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">{t('support2.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {tickets.map((tk) => {
                  const st = normalizeStatus(tk.status);
                  return (
                    <li key={tk.id}>
                      <button
                        type="button"
                        onClick={() => openThread(tk.id)}
                        className="flex w-full items-center gap-3 rounded-card border border-gray-200/60 bg-white p-4 text-left transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:border-white/10 dark:bg-navy-800 dark:hover:border-white/20"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-navy dark:text-white">
                              {t(`support.type${tk.type}`)}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[st]}`}>
                              {t(`support2.status${st}`)}
                            </span>
                            {tk.needsHuman && st !== 'CLOSED' && (
                              <span className="rounded-md bg-warning-600/10 px-2 py-0.5 text-[11px] font-medium text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
                                {t('support2.needsHuman')}
                              </span>
                            )}
                          </div>
                          {tk.lastMessage && (
                            <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                              {tk.lastMessage.text}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-400">
                            {fmtDate(tk.lastMessage?.createdAt ?? tk.updatedAt)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={backToList}>
                <ArrowLeft className="h-4 w-4" /> {t('support2.back')}
              </Button>
              {thread && (
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[normalizeStatus(thread.status)]}`}
                >
                  {t(`support2.status${normalizeStatus(thread.status)}`)}
                </span>
              )}
            </div>

            {threadError ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('support2.loadError')}</p>
                <Button variant="secondary" size="sm" onClick={() => void loadThread(selectedId)}>
                  {t('support2.retry')}
                </Button>
              </div>
            ) : thread == null ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-card bg-gray-100 dark:bg-white/5" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-4">{thread.messages.map(renderBubble)}</div>

                {threadOpen ? (
                  <div className="mt-6 space-y-3">
                    {(thread.needsHuman || escalated) && (
                      <p className="rounded-control bg-warning-600/10 px-4 py-3 text-sm text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
                        {t('support2.operatorCalled')}
                      </p>
                    )}
                    {sendStatus === 'limited' && (
                      <p className="text-sm text-warning-600 dark:text-warning-500">{t('support2.rateLimited')}</p>
                    )}
                    {sendStatus === 'error' && (
                      <p className="text-sm text-red-600 dark:text-red-400">{t('support2.sendError')}</p>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        rows={Math.min(3, Math.max(1, message.split('\n').length))}
                        maxLength={MAX_TEXT}
                        className={`${inputCls} h-auto min-h-[48px] resize-none`}
                        value={message}
                        placeholder={t('support2.composerPlaceholder')}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          setSendStatus('idle');
                        }}
                      />
                      <Button onClick={() => void sendMessage()} disabled={sending || !message.trim()}>
                        {sending ? t('support2.sending') : t('support2.send')}
                      </Button>
                    </div>
                    {showCallOperator && (
                      <Button variant="ghost" size="sm" onClick={() => void callOperator()}>
                        {t('support2.callOperator')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <p className="rounded-control bg-gray-100 px-4 py-3 text-center text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {t('support2.closedNotice')}
                    </p>
                    <p className="text-center text-xs text-gray-400">{t('support2.closedReadOnly')}</p>
                    <Button variant="secondary" onClick={scrollToForm}>
                      {t('support2.newTicket')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
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
