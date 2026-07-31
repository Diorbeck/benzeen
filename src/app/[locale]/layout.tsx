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
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('title');
  const description = t('description');
  const ogLocale = locale === 'ru' ? 'ru_RU' : locale === 'en' ? 'en_US' : 'uz_UZ';
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { uz: '/uz', ru: '/ru', en: '/en' },
    },
    openGraph: { title, description, locale: ogLocale, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ru' | 'en' | 'uz')) {
    notFound();
  }

  setRequestLocale(locale as 'ru' | 'en' | 'uz');

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'seo' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Benzeen',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: t('description'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'UZS' },
    provider: {
      '@type': 'Organization',
      name: 'Benzeen',
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://benzeen.uz',
      areaServed: 'UZ',
    },
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SetLocaleHtml />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </NextIntlClientProvider>
  );
}
