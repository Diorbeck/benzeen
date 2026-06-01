import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoicesList } from '@/components/dashboard/invoices-list';
import { CompanyReports } from '@/components/dashboard/company-reports';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('cars');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role, companyId } = session.user as {
    role?: string;
    companyId?: string | null;
  };

  if (role === 'SUPER_ADMIN') {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const delivered = await prisma.order.findMany({
      where: { status: 'DELIVERED' },
      select: {
        volume: true,
        fuelType: true,
        car: { select: { companyId: true } },
      },
    });

    const stats = new Map<string, { ai92: number; ai95: number }>();
    for (const c of companies) stats.set(c.id, { ai92: 0, ai95: 0 });
    for (const o of delivered) {
      const s = stats.get(o.car.companyId);
      if (!s) continue;
      if (o.fuelType === 'AI_92') s.ai92 += o.volume;
      else s.ai95 += o.volume;
    }

    const rows = companies.map((c) => {
      const s = stats.get(c.id) ?? { ai92: 0, ai95: 0 };
      return { id: c.id, name: c.name, ai92: s.ai92, ai95: s.ai95, total: s.ai92 + s.ai95 };
    });

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Отчёты
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Сколько литров топлива (AI-92 и AI-95) залито по каждой компании за всё время.
        </p>
        <CompanyReports rows={rows} />
      </div>
    );
  }

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
