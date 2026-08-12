'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type Ticket = {
  id: string;
  type: 'COMPLAINT' | 'SUGGESTION' | 'QUESTION';
  text: string;
  status: string;
  needsHuman: boolean;
  hasAiReply: boolean;
  hasSupportReply: boolean;
  messagesCount: number;
  lastAuthorType: string;
  createdAt: string;
  userName: string;
  userPhone: string;
};

type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

// Legacy statuses map onto the new lifecycle: NEW → OPEN, RESOLVED → CLOSED.
function normalizeStatus(status: string): TicketStatus {
  if (status === 'ANSWERED') return 'ANSWERED';
  if (status === 'CLOSED' || status === 'RESOLVED') return 'CLOSED';
  return 'OPEN';
}

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400',
  ANSWERED: 'bg-success-600/10 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  CLOSED: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

type ThreadMessage = {
  id: string;
  authorType: 'CLIENT' | 'ADMIN' | 'AI';
  text: string;
  createdAt: string;
};

type TicketThread = {
  id: string;
  type: string;
  status: string;
  needsHuman: boolean;
  createdAt: string;
  user: { name: string | null; phone: string | null } | null;
  messages: ThreadMessage[];
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export function SupportList({ tickets }: { tickets: Ticket[] }) {
  const t = useTranslations('dashboard');
  const tb = useTranslations('adminBonus');
  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [threadError, setThreadError] = useState(false);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(false);

  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closing, setClosing] = useState(false);

  const loadThread = useCallback(async (id: string) => {
    setThreadError(false);
    try {
      const res = await fetch(`/api/admin/support/${id}`);
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { ticket: TicketThread };
      setThread(data.ticket);
    } catch {
      setThreadError(true);
    }
  }, []);

  const openThread = (id: string) => {
    setExpandedId(id);
    setThread(null);
    setReply('');
    setActionError(false);
    setConfirmingClose(false);
    void loadThread(id);
  };

  const closeThreadView = () => {
    setExpandedId(null);
    setThread(null);
    router.refresh();
  };

  const sendReply = async () => {
    if (!expandedId || !reply.trim() || sending) return;
    setSending(true);
    setActionError(false);
    try {
      const res = await fetch(`/api/admin/support/${expandedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply.trim() }),
      });
      if (res.ok) {
        setReply('');
        await loadThread(expandedId);
        router.refresh();
      } else if (res.status === 409) {
        await loadThread(expandedId);
      } else {
        setActionError(true);
      }
    } catch {
      setActionError(true);
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!expandedId || closing) return;
    setClosing(true);
    setActionError(false);
    try {
      const res = await fetch(`/api/admin/support/${expandedId}/close`, { method: 'POST' });
      if (res.ok || res.status === 409) {
        await loadThread(expandedId);
        router.refresh();
      } else {
        setActionError(true);
      }
    } catch {
      setActionError(true);
    } finally {
      setClosing(false);
      setConfirmingClose(false);
    }
  };

  if (tickets.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{tb('noTickets')}</p>;
  }

  const openCount = tickets.filter((tk) => normalizeStatus(tk.status) !== 'CLOSED').length;

  const renderBubble = (m: ThreadMessage) => {
    // Admin view mirrors the client view: client on the left, support on the right.
    const isClient = m.authorType === 'CLIENT';
    const isAi = m.authorType === 'AI';
    const bubbleCls = isClient
      ? 'border border-gray-200/60 bg-white dark:border-white/10 dark:bg-navy-800'
      : isAi
        ? 'border border-primary-200 bg-white dark:border-primary-500/30 dark:bg-navy-800'
        : 'bg-primary-50 dark:bg-primary-500/15';
    return (
      <div key={m.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
        <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-gray-500 dark:text-gray-400">
          {isAi && <Sparkles className="h-3 w-3 text-primary-600 dark:text-primary-400" aria-hidden />}
          {isClient ? t('support2.clientName') : isAi ? t('support2.aiName') : t('support2.adminName')}
        </span>
        <div
          className={`max-w-[85%] rounded-card px-4 py-3 text-sm text-gray-800 dark:text-gray-100 ${bubbleCls}`}
        >
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
        </div>
        <span className="mt-0.5 px-1 text-xs text-gray-400">{fmtDate(m.createdAt)}</span>
      </div>
    );
  };

  const threadStatus = thread ? normalizeStatus(thread.status) : null;
  const threadClosed = threadStatus === 'CLOSED';

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium tabular-nums text-gray-600 dark:text-gray-300">
        {t('support2.openCount', { n: openCount })}
      </p>

      {tickets.map((tk) => {
        const st = normalizeStatus(tk.status);
        const expanded = expandedId === tk.id;
        const unanswered = !tk.hasAiReply && !tk.hasSupportReply;
        const lastFromAi = tk.lastAuthorType === 'AI';
        return (
          <div key={tk.id} className="card-premium space-y-3 p-4">
            <button
              type="button"
              onClick={() => (expanded ? closeThreadView() : openThread(tk.id))}
              aria-expanded={expanded}
              className="-m-1 block w-full min-h-11 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary-500/10 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:text-primary-400">
                  {tb(`type${tk.type}`)}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[st]}`}>
                  {t(`support2.status${st}`)}
                </span>
                {st !== 'CLOSED' &&
                  (tk.needsHuman ? (
                    <span className="rounded-md bg-warning-600/10 px-2 py-0.5 text-[11px] font-medium text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
                      {t('support2.badgeNeedsHuman')}
                    </span>
                  ) : unanswered ? (
                    <span className="rounded-md bg-red-600/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-500/15 dark:text-red-400">
                      {t('support2.badgeUnanswered')}
                    </span>
                  ) : lastFromAi ? (
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                      {t('support2.badgeAi')}
                    </span>
                  ) : null)}
              </div>
              {!expanded && <p className="mt-2 truncate text-sm text-gray-800 dark:text-gray-100">{tk.text}</p>}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tk.userName || tk.userPhone || '—'} · {fmtDate(tk.createdAt)} ·{' '}
                <span className="tabular-nums">{tk.messagesCount}</span>
              </p>
            </button>

            {expanded && (
              <div className="border-t border-gray-200/60 pt-3 dark:border-white/10">
                {threadError ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('support2.loadError')}</p>
                    <Button variant="secondary" size="sm" onClick={() => void loadThread(tk.id)}>
                      {t('support2.openThread')}
                    </Button>
                  </div>
                ) : thread == null ? (
                  <div className="space-y-3 py-1" aria-hidden>
                    {[0, 1].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-card bg-gray-100 dark:bg-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-4">{thread.messages.map(renderBubble)}</div>

                    {actionError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{t('support2.actionError')}</p>
                    )}

                    {threadClosed ? (
                      <p className="rounded-control bg-gray-100 px-4 py-3 text-center text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                        {t('support2.closedNotice')}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-end gap-2">
                          <textarea
                            rows={Math.min(3, Math.max(1, reply.split('\n').length))}
                            maxLength={2000}
                            className="h-auto min-h-[48px] w-full resize-none rounded-control border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:border-white/15 dark:bg-navy-800 dark:text-gray-100 dark:placeholder-gray-500"
                            value={reply}
                            placeholder={t('support2.replyPlaceholder')}
                            onChange={(e) => {
                              setReply(e.target.value);
                              setActionError(false);
                            }}
                          />
                          <Button onClick={() => void sendReply()} disabled={sending || !reply.trim()}>
                            {sending ? t('support2.sending') : t('support2.send')}
                          </Button>
                        </div>

                        {confirmingClose ? (
                          <div className="flex flex-wrap items-center gap-3 rounded-control bg-gray-100 px-4 py-3 dark:bg-white/5">
                            <p className="text-sm text-gray-700 dark:text-gray-200">{t('support2.closeConfirm')}</p>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 active:bg-red-700"
                                onClick={() => void closeTicket()}
                                disabled={closing}
                              >
                                {t('support2.closeYes')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmingClose(false)}>
                                {t('support2.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Button size="sm" variant="secondary" onClick={() => setConfirmingClose(true)}>
                              {t('support2.close')}
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-start">
                      <Button size="sm" variant="ghost" onClick={closeThreadView}>
                        <ArrowLeft className="h-4 w-4" /> {t('support2.backToList')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
