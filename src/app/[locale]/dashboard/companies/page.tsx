import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { CompaniesList } from '@/components/dashboard/companies-list';

export default async function CompaniesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations('admin');
  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-amber-600 dark:text-amber-400">
          {t('noAccessCompanies')}
        </p>
      </div>
    );
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      cars: {
        orderBy: { plateNumber: 'asc' },
        include: { usage: true },
      },
    },
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const companiesWithStats = companies.map((company) => {
    const cars = company.cars.map((car) => {
      const usage = car.usage.find((u) => u.month === month && u.year === year);
      const used = usage?.usedLiters ?? 0;
      return {
        id: car.id,
        plateNumber: car.plateNumber,
        model: car.model,
        fuelType: car.fuelType,
        usedLiters: used,
        limit: car.monthlyLimit,
      };
    });
    return {
      id: company.id,
      name: company.name,
      address: company.address,
      phone: company.phone,
      telegram: company.telegram,
      carsCount: cars.length,
      cars,
    };
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Компании
      </h1>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Регистрируйте компании, редактируйте или удаляйте их. Нажмите на компанию,
        чтобы увидеть список её машин и расход топлива.
      </p>

      <div className="card-premium space-y-3 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Зарегистрировать компанию
        </h2>
        <form
          action={async (formData: FormData) => {
            'use server';
            const name = String(formData.get('name') || '').trim();
            const address = String(formData.get('address') || '').trim() || undefined;
            const phone = String(formData.get('phone') || '').trim() || undefined;
            const telegram = String(formData.get('telegram') || '').trim() || undefined;
            if (!name) return;
            const actorSession = await getServerSession(authOptions);
            const actor = actorSession?.user as
              | { id?: string; email?: string; role?: string }
              | undefined;
            if (actor?.role !== 'SUPER_ADMIN') return;
            const created = await prisma.company.create({
              data: { name, address, phone, telegram },
            });
            await writeAuditLog({
              action: 'COMPANY_CREATE',
              targetType: 'Company',
              targetId: created.id,
              actorId: actor.id ?? null,
              actorEmail: actor.email ?? null,
              metadata: { name: created.name },
            });
          }}
          className="grid gap-3 text-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Название компании *
            </label>
            <input
              name="name"
              required
              placeholder="ООО «Пример»"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Адрес
            </label>
            <input
              name="address"
              placeholder="Город, улица, офис"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Телефон
            </label>
            <input
              name="phone"
              placeholder="+998 71 000 00 00"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Telegram
            </label>
            <input
              name="telegram"
              placeholder="@company"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              Добавить компанию
            </button>
          </div>
        </form>
      </div>

      <CompaniesList companies={companiesWithStats} />
    </div>
  );
}
