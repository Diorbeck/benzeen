import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SetLocaleHtml } from '@/components/set-locale-html';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hero' });
  const title = `${t('headline')} | NeoOil`;
  const description = t('subtext');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: locale === 'ru' ? 'ru_RU' : locale === 'en' ? 'en_US' : 'uz_UZ',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ru' | 'en' | 'uz')) {
    notFound();
  }

  setRequestLocale(locale as 'ru' | 'en' | 'uz');

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SetLocaleHtml />
      {children}
    </NextIntlClientProvider>
  );
}
