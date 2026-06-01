import { setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'uz');
  return <LegalPage type="terms" locale={locale} />;
}
