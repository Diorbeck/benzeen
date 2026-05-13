import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        usedLiters: used,
        limit: car.monthlyLimit,
      };
    });
    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
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
        Здесь суперадминистратор регистрирует компании и курьеров и видит, сколько машин и литров
        топлива у каждой компании.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
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
              await prisma.company.create({
                data: { name, address, phone, telegram },
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

        <div className="card-premium space-y-3 p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Зарегистрировать курьера
          </h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const email = String(formData.get('email') || '').trim();
              const password = String(formData.get('password') || '').trim();
              const name = String(formData.get('name') || '').trim() || undefined;
              const phone = String(formData.get('phone') || '').trim() || undefined;
              if (!email || !password) return;
              const existing = await prisma.user.findUnique({ where: { email } });
              if (existing) return;
              const bcrypt = await import('bcryptjs');
              const passwordHash = await bcrypt.hash(password, 10);
              await prisma.user.create({
                data: {
                  email,
                  name,
                  passwordHash,
                  phone,
                  role: 'COURIER',
                },
              });
            }}
            className="grid gap-3 text-sm md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Email курьера *
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="courier@example.com"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Имя курьера
              </label>
              <input
                name="name"
                placeholder="ФИО (необязательно)"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Телефон
              </label>
              <input
                name="phone"
                placeholder="+998 90 000 00 00"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Пароль для входа *
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="Минимум 6 символов"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                Добавить курьера
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {companiesWithStats.map((company) => (
          <div key={company.id} className="card-premium space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {company.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Машин зарегистрировано: {company.carsCount}
                </p>
              </div>
            </div>
            {company.carsCount === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                В этой компании пока нет машин.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2">Машина</th>
                      <th className="px-4 py-2">Израсходовано, л</th>
                      <th className="px-4 py-2">Лимит, л</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.cars.map((car) => (
                      <tr
                        key={car.id}
                        className="border-t border-gray-100 text-gray-700 dark:border-white/[0.06] dark:text-gray-200"
                      >
                        <td className="px-4 py-2 text-sm font-medium">{car.plateNumber}</td>
                        <td className="px-4 py-2 text-sm">{car.usedLiters}</td>
                        <td className="px-4 py-2 text-sm">{car.limit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

