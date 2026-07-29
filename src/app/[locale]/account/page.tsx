import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountView } from '@/components/account/account-view';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const sUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sUser?.id) redirect(`/${locale}/client-login`);
  if (sUser.role !== 'CLIENT') redirect(`/${locale}/dashboard`);

  const user = await prisma.user.findUnique({
    where: { id: sUser.id },
    select: { phone: true, name: true },
  });
  if (!user) redirect(`/${locale}/client-login`);

  return <AccountView locale={locale} phone={user.phone ?? ''} name={user.name ?? ''} />;
}
