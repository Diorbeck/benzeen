import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Benzeen — Fuel delivery for business',
    template: '%s | Benzeen',
  },
  description:
    'B2B fuel delivery platform for fleets in Tashkent. Cut fuel costs up to 30% with driver requests, per-vehicle limits, next-day delivery and automated reports.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://benzeen.uz'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Benzeen',
  },
  openGraph: {
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A1F44',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen`}
      >
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
