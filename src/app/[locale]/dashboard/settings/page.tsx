import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SettingsPanel } from '@/components/dashboard/settings-panel';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  const { role, companyId } = (session?.user ?? {}) as {
    role?: string;
    companyId?: string | null;
  };

  let company: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    telegram: string | null;
  } | null = null;

  if (role === 'COMPANY_ADMIN' && companyId) {
    const c = await prisma.company.findUnique({ where: { id: companyId } });
    if (c) {
      company = {
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        telegram: c.telegram,
      };
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Настройки
      </h1>
      <SettingsPanel user={session?.user} company={company} />
    </div>
  );
}
