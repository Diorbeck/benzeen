import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoicesList } from '@/components/dashboard/invoices-list';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('cars');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const companyId = (session.user as { companyId?: string | null }).companyId;
  if (!companyId) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-amber-600 dark:text-amber-400">{t('noCompany')}</p>
      </div>
    );
  }

  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Счета
      </h1>
      <InvoicesList invoices={invoices} />
    </div>
  );
}
