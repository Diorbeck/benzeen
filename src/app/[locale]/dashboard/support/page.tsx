import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SupportList, type Ticket } from '@/components/dashboard/support-list';

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('adminBonus');

  // Most recent first; the list itself surfaces open/needs-human badges.
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      type: true,
      text: true,
      status: true,
      needsHuman: true,
      createdAt: true,
      user: { select: { name: true, phone: true } },
      // Author sequence only — enough to derive reply/last-author flags.
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { authorType: true },
      },
    },
  });

  const rows: Ticket[] = tickets.map((tk) => {
    const authors = tk.messages.map((m) => m.authorType);
    return {
      id: tk.id,
      type: tk.type,
      text: tk.text,
      status: tk.status,
      needsHuman: tk.needsHuman,
      hasAiReply: authors.includes('AI'),
      hasSupportReply: authors.includes('ADMIN'),
      messagesCount: authors.length,
      lastAuthorType: authors[authors.length - 1] ?? '',
      createdAt: tk.createdAt.toISOString(),
      userName: tk.user?.name ?? '',
      userPhone: tk.user?.phone ?? '',
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('supportTitle')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('supportSubtitle')}</p>
      </div>
      <SupportList tickets={rows} />
    </div>
  );
}
