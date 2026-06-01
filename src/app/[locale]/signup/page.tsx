import { redirect } from 'next/navigation';

// Self-service signup is disabled. Accounts (company managers) are created by an
// admin only. Any visit to /signup is sent to the login page.
export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/login`);
}
